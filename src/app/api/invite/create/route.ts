import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

const inviteCreateSchema = z.object({
    leaderToken: z.string().min(1, "leaderToken is required"),
    count: z.number().int().min(1).max(6).default(1),
    expiresInDays: z.number().int().min(1).max(90).default(14),
});

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

        // 2. Leader Token 검증
        const leaderLink = await prisma.inviteLink.findUnique({
            where: { token: leaderToken },
            include: { group: true },
        });

        if (!leaderLink) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 404 }
            );
        }

        // 2-1. 권한(Purpose) 및 만료 체크
        if (leaderLink.purpose !== 'leader_only') {
            return NextResponse.json(
                { error: 'Forbidden: Not a leader token' },
                { status: 403 }
            );
        }

        if (leaderLink.expiresAt && new Date() > leaderLink.expiresAt) {
            return NextResponse.json(
                { error: 'Token expired' },
                { status: 410 } // Gone
            );
        }

        // 2-2. 그룹 상태 체크 (Locked 상태면 초대 생성 불가)
        if (leaderLink.group.rosterStatus === 'locked') {
            return NextResponse.json(
                { error: 'Roster is locked' },
                { status: 409 } // Conflict
            );
        }

        // 3. 초대 링크 생성 (Loop or CreateMany)
        // createMany는 Postgres에서 지원하지만, return값이 count뿐이라 생성된 UUID를 알 수 없음.
        // 여기서는 생성된 token 목록이 필요하므로 loop나 Promise.all 사용.
        const expiresAt = addDays(new Date(), expiresInDays);

        // 생성할 토큰 데이터 준비
        const newInvitesData = Array.from({ length: count }).map(() => ({
            groupId: leaderLink.groupId,
            token: uuidv4(),
            purpose: 'roster_entry',
            maxUses: 1,
            usedCount: 0,
            expiresAt: expiresAt,
        }));

        // Promise.all로 병렬 실행보다 Transaction 추천 (하나라도 실패하면 롤백)
        // 하지만 Prisma $transaction 내에서 loop create는 가능.
        const createdInvites = await prisma.$transaction(
            newInvitesData.map((data) =>
                prisma.inviteLink.create({
                    data: {
                        // TS safe casting issue may occur with string literal vs enum, assume safe if schema matches
                        groupId: data.groupId,
                        token: data.token,
                        purpose: 'roster_entry',
                        maxUses: data.maxUses,
                        usedCount: data.usedCount,
                        expiresAt: data.expiresAt
                    }
                })
            )
        );

        // 4. 응답 구성
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const inviteUrls = createdInvites.map(
            (invite) => `${baseUrl}/invite/${invite.token}`
        );

        return NextResponse.json({
            success: true,
            groupId: leaderLink.groupId,
            createdCount: createdInvites.length,
            inviteUrls,
        }, { status: 201 });

    } catch (error) {
        console.error('Invite Create Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
