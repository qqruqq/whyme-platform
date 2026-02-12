import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiStatusError } from '@/lib/api/errors';
import { assertInviteTokenClaimed } from '@/lib/api/guards';
import { isSerializationConflictError, shouldRetrySerializableError } from '@/lib/api/retry';
import { normalizeNullablePhone } from '@/lib/phone';
import { isValidOptionalPhoneInput } from '@/lib/phone-validation';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const inviteSubmitSchema = z.object({
    token: z.string().min(1, "Token is required"),
    childName: z.string().min(1, "학생 이름을 입력해주세요"),
    childGrade: z.string().optional(),

    // checkbox or boolean inputs
    priorStudentAttended: z.boolean().optional(),
    siblingsPriorAttended: z.boolean().optional(),
    parentPriorAttended: z.boolean().optional(),

    parentName: z.string().optional(),
    parentPhone: z
        .string()
        .trim()
        .optional()
        .refine(isValidOptionalPhoneInput, '연락처는 숫자 10~11자리 형식이어야 합니다.'),

    noteToInstructor: z.string().optional(),
});

const MAX_SERIALIZABLE_RETRIES = 2;

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. 유효성 검사
        const validation = inviteSubmitSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        // Zod 파싱 결과
        const data = validation.data;
        let result:
            | {
                  member: { groupMemberId: string };
                  currentCount: number;
                  editToken: string;
                  groupId: string;
              }
            | null = null;

        for (let attempt = 0; attempt <= MAX_SERIALIZABLE_RETRIES; attempt += 1) {
            try {
                // 트랜잭션 내에서 invite token 사용을 원자적으로 점유한다.
                result = await prisma.$transaction(async (tx) => {
                    const invite = await tx.inviteLink.findUnique({
                        where: { token: data.token },
                        include: { group: true },
                    });

                    if (!invite) {
                        throw new ApiStatusError(404, 'Invalid token');
                    }

                    if (invite.purpose !== 'roster_entry') {
                        throw new ApiStatusError(403, 'Invalid token purpose');
                    }

                    const now = new Date();
                    if (invite.expiresAt && now > invite.expiresAt) {
                        throw new ApiStatusError(410, 'Token expired');
                    }

                    if (invite.group.rosterStatus === 'locked') {
                        throw new ApiStatusError(409, 'Group roster is locked');
                    }

                    const claimed = await tx.inviteLink.updateMany({
                        where: {
                            inviteId: invite.inviteId,
                            usedCount: { lt: invite.maxUses },
                            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                        },
                        data: {
                            usedCount: { increment: 1 },
                            usedAt: now,
                            usedBy: data.parentName ? `Parent:${data.parentName}` : `Child:${data.childName}`,
                        },
                    });

                    assertInviteTokenClaimed(claimed.count);

                    const child = await tx.child.create({
                        data: {
                            name: data.childName,
                            grade: data.childGrade,
                            priorStudentAttended: data.priorStudentAttended,
                            siblingsPriorAttended: data.siblingsPriorAttended,
                            parentPriorAttended: data.parentPriorAttended,
                        },
                    });

                    // 3-2. GroupMember 생성 (editToken 포함)
                    const editToken = uuidv4();
                    const member = await tx.groupMember.create({
                        data: {
                            groupId: invite.groupId, // inviteLink가 group에 연결되어 있음
                            childId: child.childId,
                            parentName: data.parentName,
                            parentPhone: normalizeNullablePhone(data.parentPhone) ?? null,
                            noteToInstructor: data.noteToInstructor,
                            editToken: editToken, // 수정용 토큰 저장을 여기서 함
                            status: 'completed', // 입력 완료 상태
                        },
                    });

                    // 첫 등록 시 draft -> collecting 전환.
                    await tx.groupPass.updateMany({
                        where: {
                            groupId: invite.groupId,
                            rosterStatus: 'draft',
                        },
                        data: {
                            rosterStatus: 'collecting',
                        },
                    });

                    const currentCount = await tx.groupMember.count({
                        where: { groupId: invite.groupId },
                    });

                    return { member, currentCount, editToken, groupId: invite.groupId };
                }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

                break;
            } catch (error) {
                if (shouldRetrySerializableError(error, attempt, MAX_SERIALIZABLE_RETRIES)) {
                    continue;
                }

                throw error;
            }
        }

        if (!result) {
            throw new ApiStatusError(503, 'Temporary concurrency issue. Please retry.');
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const editUrl = `${baseUrl}/member/edit/${result.editToken}`;

        return NextResponse.json({
            success: true,
            groupId: result.groupId,
            groupMemberId: result.member.groupMemberId,
            currentMemberCount: result.currentCount,
            editToken: result.editToken,
            editUrl,
        }, { status: 201 });

    } catch (error) {
        if (error instanceof ApiStatusError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if (isSerializationConflictError(error)) {
            return NextResponse.json(
                { error: 'Temporary concurrency issue. Please retry.' },
                { status: 503 }
            );
        }

        console.error('Invite Submit Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
