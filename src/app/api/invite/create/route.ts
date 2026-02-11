import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

const inviteCreateSchema = z.object({
    leaderToken: z.string().min(1, "leaderToken is required"),
    count: z.number().int().min(1).max(6).default(1),
    expiresInDays: z.number().int().min(1).max(90).default(14),
});

class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const MAX_SERIALIZABLE_RETRIES = 2;

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. 입력 검증
        const validation = inviteCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const { leaderToken, count, expiresInDays } = validation.data;
        const expiresAt = addDays(new Date(), expiresInDays);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        let createdInvites: { token: string }[] | null = null;
        let groupId: string | null = null;

        for (let attempt = 0; attempt <= MAX_SERIALIZABLE_RETRIES; attempt += 1) {
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const leaderLink = await tx.inviteLink.findUnique({
                        where: { token: leaderToken },
                        include: { group: true },
                    });

                    if (!leaderLink) {
                        throw new ApiError(404, 'Invalid token');
                    }

                    // 2-1. 권한(Purpose) 및 만료 체크
                    if (leaderLink.purpose !== 'leader_only') {
                        throw new ApiError(403, 'Forbidden: Not a leader token');
                    }

                    if (leaderLink.expiresAt && new Date() > leaderLink.expiresAt) {
                        throw new ApiError(410, 'Token expired');
                    }

                    // 2-2. 그룹 상태 체크 (Locked 상태면 초대 생성 불가)
                    if (leaderLink.group.rosterStatus === 'locked') {
                        throw new ApiError(409, 'Roster is locked');
                    }

                    const newInvitesData = Array.from({ length: count }).map(() => ({
                        groupId: leaderLink.groupId,
                        token: uuidv4(),
                        purpose: 'roster_entry' as const,
                        maxUses: 1,
                        usedCount: 0,
                        expiresAt,
                    }));

                    // 3. 초대 링크 생성
                    const invites = await Promise.all(
                        newInvitesData.map((data) =>
                            tx.inviteLink.create({
                                data: {
                                    groupId: data.groupId,
                                    token: data.token,
                                    purpose: data.purpose,
                                    maxUses: data.maxUses,
                                    usedCount: data.usedCount,
                                    expiresAt: data.expiresAt,
                                },
                                select: { token: true },
                            })
                        )
                    );

                    return {
                        groupId: leaderLink.groupId,
                        invites,
                    };
                }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

                createdInvites = result.invites;
                groupId = result.groupId;
                break;
            } catch (error) {
                if (
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === 'P2034' &&
                    attempt < MAX_SERIALIZABLE_RETRIES
                ) {
                    continue;
                }

                throw error;
            }
        }

        if (!createdInvites || !groupId) {
            throw new Error('Failed to create invites');
        }

        // 4. 응답 구성
        const inviteUrls = createdInvites.map(
            (invite) => `${baseUrl}/invite/${invite.token}`
        );

        return NextResponse.json({
            success: true,
            groupId,
            createdCount: createdInvites.length,
            inviteUrls,
        }, { status: 201 });

    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error('Invite Create Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
