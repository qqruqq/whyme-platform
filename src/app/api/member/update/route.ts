import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeNullablePhone, normalizePhoneDigits } from '@/lib/phone';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

function isValidOptionalPhone(value: string | undefined): boolean {
    if (value === undefined || value === '') {
        return true;
    }

    if (!/^[0-9\s\-()+]+$/.test(value)) {
        return false;
    }

    const digits = normalizePhoneDigits(value);
    return digits.length >= 10 && digits.length <= 11;
}

const memberUpdateSchema = z.object({
    editToken: z.string().min(1, "editToken is required"),

    // 수정 가능한 필드들 (모두 optional)
    childName: z.string().min(1, "학생 이름을 입력해주세요").optional(),
    childGrade: z.string().optional(),
    priorStudentAttended: z.boolean().optional(),
    siblingsPriorAttended: z.boolean().optional(),
    parentPriorAttended: z.boolean().optional(),
    parentName: z.string().optional(),
    parentPhone: z
        .string()
        .trim()
        .optional()
        .refine(isValidOptionalPhone, '연락처는 숫자 10~11자리 형식이어야 합니다.'),
    noteToInstructor: z.string().optional(),
});

class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const MAX_SERIALIZABLE_RETRIES = 2;

export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // 1. 입력 검증
        const validation = memberUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }
        const data = validation.data;
        let updatedMember: { groupMemberId: string } | null = null;

        for (let attempt = 0; attempt <= MAX_SERIALIZABLE_RETRIES; attempt += 1) {
            try {
                // 2. Member 및 Group 상태 조회 + 업데이트를 하나의 트랜잭션으로 수행
                updatedMember = await prisma.$transaction(async (tx) => {
                    const member = await tx.groupMember.findUnique({
                        where: { editToken: data.editToken },
                        include: {
                            group: true,
                            child: true,
                        },
                    });

                    if (!member) {
                        throw new ApiError(404, 'Invalid edit token');
                    }

                    // 2-1. Roster Status 확인
                    if (member.group.rosterStatus === 'locked') {
                        throw new ApiError(409, 'Roster is locked. Modifications are not allowed.');
                    }

                    const childUpdateData: Prisma.ChildUpdateInput = {};
                    if (data.childName !== undefined) {
                        childUpdateData.name = data.childName;
                    }
                    if (data.childGrade !== undefined) {
                        childUpdateData.grade = data.childGrade;
                    }
                    if (data.priorStudentAttended !== undefined) {
                        childUpdateData.priorStudentAttended = data.priorStudentAttended;
                    }
                    if (data.siblingsPriorAttended !== undefined) {
                        childUpdateData.siblingsPriorAttended = data.siblingsPriorAttended;
                    }
                    if (data.parentPriorAttended !== undefined) {
                        childUpdateData.parentPriorAttended = data.parentPriorAttended;
                    }

                    if (Object.keys(childUpdateData).length > 0) {
                        await tx.child.update({
                            where: { childId: member.childId },
                            data: childUpdateData,
                        });
                    }

                    const memberUpdateData: Prisma.GroupMemberUpdateManyMutationInput = {};
                    if (data.parentName !== undefined) {
                        memberUpdateData.parentName = data.parentName;
                    }
                    if (data.parentPhone !== undefined) {
                        memberUpdateData.parentPhone = normalizeNullablePhone(data.parentPhone);
                    }
                    if (data.noteToInstructor !== undefined) {
                        memberUpdateData.noteToInstructor = data.noteToInstructor;
                    }

                    if (Object.keys(memberUpdateData).length > 0) {
                        const updatedCount = await tx.groupMember.updateMany({
                            where: {
                                groupMemberId: member.groupMemberId,
                                group: {
                                    rosterStatus: {
                                        not: 'locked',
                                    },
                                },
                            },
                            data: memberUpdateData,
                        });

                        if (updatedCount.count === 0) {
                            throw new ApiError(409, 'Roster is locked. Modifications are not allowed.');
                        }
                    }

                    return {
                        groupMemberId: member.groupMemberId,
                    };
                }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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

        if (!updatedMember) {
            throw new Error('Member update failed after retries');
        }

        return NextResponse.json({
            success: true,
            groupMemberId: updatedMember.groupMemberId,
            message: 'Updated successfully'
        });

    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error('Member Update Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
