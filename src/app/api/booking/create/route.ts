import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits } from '@/lib/phone';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid'; // random UUID for invite token

// 입력값 검증 스키마
const bookingSchema = z.object({
    slotId: z.string().uuid().optional(),
    classDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "교육 일정(날짜) 형식이 올바르지 않습니다")
        .optional(),
    classTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "교육 일정(시간) 형식이 올바르지 않습니다")
        .optional(),
    instructorName: z.string().min(1, "강사명을 입력해주세요").optional(),
    location: z.string().min(1, "교육 장소를 선택해주세요").optional(),
    leaderName: z.string().min(1, "이름을 입력해주세요"),
    leaderPhone: z.string().regex(/^[0-9-]{10,13}$/, "유효한 전화번호 형식이 아닙니다"),
    cashReceiptNumber: z.string().optional(),
    headcountDeclared: z.number().int().min(2).max(6).default(2),
    childName: z.string().min(1, "자녀 이름을 입력해주세요").optional(),
    priorStudentAttended: z.boolean().optional(),
    siblingsPriorAttended: z.boolean().optional(),
    parentPriorAttended: z.boolean().optional(),
    noteToInstructor: z.string().optional(),
    acquisitionChannel: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!data.slotId && !(data.classDate && data.classTime && data.instructorName)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'slotId 또는 교육 일정/강사 정보가 필요합니다.',
            path: ['slotId'],
        });
    }
});

function toClassStartAt(classDate: string, classTime: string): Date | null {
    const date = new Date(`${classDate}T${classTime}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. 유효성 검사
        const validation = bookingSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const {
            slotId,
            classDate,
            classTime,
            instructorName,
            location,
            leaderName,
            leaderPhone,
            cashReceiptNumber,
            headcountDeclared,
            childName,
            priorStudentAttended,
            siblingsPriorAttended,
            parentPriorAttended,
            noteToInstructor,
            acquisitionChannel,
        } = validation.data;

        const normalizedLeaderPhone = normalizePhoneDigits(leaderPhone);
        const derivedStartAt =
            !slotId && classDate && classTime ? toClassStartAt(classDate, classTime) : null;

        if (!slotId && !derivedStartAt) {
            return NextResponse.json(
                { error: 'Invalid schedule format' },
                { status: 400 }
            );
        }

        // 3. 트랜잭션으로 처리 (Parent -> GroupPass -> InviteLink)
        const result = await prisma.$transaction(async (tx) => {
            let resolvedSlot;

            if (slotId) {
                resolvedSlot = await tx.reservationSlot.findUnique({
                    where: { slotId },
                });
            } else {
                const minuteWindowStart = new Date((derivedStartAt as Date).getTime() - 30 * 1000);
                const minuteWindowEnd = new Date((derivedStartAt as Date).getTime() + 30 * 1000);

                resolvedSlot = await tx.reservationSlot.findFirst({
                    where: {
                        instructorId: instructorName as string,
                        startAt: {
                            gte: minuteWindowStart,
                            lte: minuteWindowEnd,
                        },
                    },
                });

                if (!resolvedSlot) {
                    const defaultDurationMinutes = 120;
                    const computedEndAt = new Date(
                        (derivedStartAt as Date).getTime() + defaultDurationMinutes * 60 * 1000
                    );

                    resolvedSlot = await tx.reservationSlot.create({
                        data: {
                            startAt: derivedStartAt as Date,
                            endAt: computedEndAt,
                            instructorId: (instructorName as string).trim(),
                            status: 'open',
                        },
                    });
                }
            }

            if (!resolvedSlot) {
                throw new Error('Reservation slot not found');
            }

            // 3-1. 대표자(Parent) Upsert
            // 전화번호가 같으면 기존 정보 업데이트(이름 등), 없으면 생성
            const parent = await tx.parent.upsert({
                where: { phone: normalizedLeaderPhone },
                update: {
                    name: leaderName,
                    cashReceiptNumber: cashReceiptNumber || undefined, // 값이 있을 때만 업데이트
                },
                create: {
                    name: leaderName,
                    phone: normalizedLeaderPhone,
                    cashReceiptNumber,
                },
            });

            const groupMemoLines = [
                location ? `교육 장소: ${location}` : null,
                acquisitionChannel ? `유입 경로: ${acquisitionChannel}` : null,
            ].filter(Boolean) as string[];

            // 3-2. GroupPass 생성
            const groupPass = await tx.groupPass.create({
                data: {
                    slotId: resolvedSlot.slotId,
                    leaderParentId: parent.parentId,
                    headcountDeclared,
                    status: 'pending_info',
                    rosterStatus: childName ? 'collecting' : 'draft',
                    memoToInstructor: groupMemoLines.length > 0 ? groupMemoLines.join('\n') : null,
                },
            });

            // 3-3. Leader용 관리 링크(InviteLink) 생성
            // purpose: 'leader_only', maxUses: 999 (무제한 접속 가능? 필요시 제한)
            const manageToken = uuidv4();
            const leaderLink = await tx.inviteLink.create({
                data: {
                    groupId: groupPass.groupId,
                    token: manageToken,
                    purpose: 'leader_only',
                    maxUses: 9999, // 관리자는 여러 번 접속 가능해야 함
                }
            });

            let leaderMember: { editToken: string } | null = null;

            if (childName) {
                const child = await tx.child.create({
                    data: {
                        name: childName,
                        priorStudentAttended,
                        siblingsPriorAttended,
                        parentPriorAttended,
                    },
                });

                const editToken = uuidv4();
                await tx.groupMember.create({
                    data: {
                        groupId: groupPass.groupId,
                        childId: child.childId,
                        parentName: leaderName,
                        parentPhone: normalizedLeaderPhone,
                        noteToInstructor: noteToInstructor || null,
                        editToken,
                        status: 'completed',
                    },
                });

                leaderMember = { editToken };
            }

            return { groupPass, leaderLink, resolvedSlot, leaderMember };
        });

        // 4. 응답 구성
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const manageUrl = `${baseUrl}/manage/${result.leaderLink.token}`; // manageToken = inviteLink.token
        const leaderEditUrl = result.leaderMember
            ? `${baseUrl}/member/edit/${result.leaderMember.editToken}`
            : null;

        return NextResponse.json({
            success: true,
            groupId: result.groupPass.groupId,
            slotId: result.resolvedSlot.slotId,
            manageToken: result.leaderLink.token, // 이것이 곧 링크 접속용 토큰
            manageUrl,
            initialMemberCreated: Boolean(result.leaderMember),
            leaderEditToken: result.leaderMember?.editToken ?? null,
            leaderEditUrl,
        }, { status: 201 });

    } catch (error) {
        console.error('Booking Create Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
