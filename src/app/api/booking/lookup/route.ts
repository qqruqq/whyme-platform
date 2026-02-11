import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits } from '@/lib/phone';
import { z } from 'zod';

const bookingLookupSchema = z.object({
    classDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "교육 일정(날짜) 형식이 올바르지 않습니다"),
    classTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "교육 일정(시간) 형식이 올바르지 않습니다"),
    instructorName: z.string().min(1, "강사명을 입력해주세요"),
    leaderPhone: z.string().regex(/^[0-9-]{10,13}$/, "유효한 대표 연락처 형식이 아닙니다"),
});

function toClassStartAt(classDate: string, classTime: string): Date | null {
    const date = new Date(`${classDate}T${classTime}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = bookingLookupSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const { classDate, classTime, instructorName, leaderPhone } = validation.data;
        const startAt = toClassStartAt(classDate, classTime);

        if (!startAt) {
            return NextResponse.json({ error: 'Invalid schedule format' }, { status: 400 });
        }

        const normalizedLeaderPhone = normalizePhoneDigits(leaderPhone);
        const slotWindowStart = new Date(startAt.getTime() - 30 * 1000);
        const slotWindowEnd = new Date(startAt.getTime() + 30 * 1000);

        const result = await prisma.$transaction(async (tx) => {
            const slot = await tx.reservationSlot.findFirst({
                where: {
                    instructorId: instructorName.trim(),
                    startAt: {
                        gte: slotWindowStart,
                        lte: slotWindowEnd,
                    },
                },
            });

            if (!slot) {
                return null;
            }

            const parent = await tx.parent.findUnique({
                where: { phone: normalizedLeaderPhone },
            });

            if (!parent) {
                return null;
            }

            const group = await tx.groupPass.findFirst({
                where: {
                    slotId: slot.slotId,
                    leaderParentId: parent.parentId,
                },
                include: {
                    inviteLinks: {
                        where: {
                            purpose: 'leader_only',
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    },
                    groupMembers: {
                        where: {
                            parentPhone: normalizedLeaderPhone,
                            editToken: {
                                not: null,
                            },
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        select: {
                            editToken: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            if (!group) {
                return null;
            }

            const leaderInvite = group.inviteLinks[0];
            if (!leaderInvite) {
                return null;
            }

            return {
                slot,
                group,
                manageToken: leaderInvite.token,
                leaderEditToken: group.groupMembers[0]?.editToken ?? null,
            };
        });

        if (!result) {
            return NextResponse.json(
                { error: '예약 내역을 찾지 못했습니다. 입력 정보를 확인해 주세요.' },
                { status: 404 }
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const manageUrl = `${baseUrl}/manage/${result.manageToken}`;
        const leaderEditUrl = result.leaderEditToken
            ? `${baseUrl}/member/edit/${result.leaderEditToken}`
            : null;

        return NextResponse.json({
            success: true,
            groupId: result.group.groupId,
            slotId: result.slot.slotId,
            status: result.group.status,
            rosterStatus: result.group.rosterStatus,
            manageToken: result.manageToken,
            manageUrl,
            leaderEditToken: result.leaderEditToken,
            leaderEditUrl,
        });
    } catch (error) {
        console.error('Booking Lookup Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
