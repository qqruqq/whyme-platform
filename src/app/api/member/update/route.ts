import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const memberUpdateSchema = z.object({
    editToken: z.string().min(1, "editToken is required"),

    // 수정 가능한 필드들 (모두 optional)
    childName: z.string().min(1, "학생 이름을 입력해주세요").optional(),
    childGrade: z.string().optional(),
    priorStudentAttended: z.boolean().optional(),
    siblingsPriorAttended: z.boolean().optional(),
    parentPriorAttended: z.boolean().optional(),
    parentName: z.string().optional(),
    parentPhone: z.string().min(10, "연락처는 10자리 이상이어야 합니다").optional().or(z.literal('')),
    noteToInstructor: z.string().optional(),
});

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

        // 2. Member 및 Group 상태 조회
        const member = await prisma.groupMember.findUnique({
            where: { editToken: data.editToken },
            include: {
                group: true,
                child: true
            }
        });

        if (!member) {
            return NextResponse.json({ error: 'Invalid edit token' }, { status: 404 });
        }

        // 2-1. Roster Status 확인
        if (member.group.rosterStatus === 'locked') {
            return NextResponse.json(
                { error: 'Roster is locked. Modifications are not allowed.' },
                { status: 409 }
            );
        }

        // 3. 업데이트 수행 (Member + Child)
        const updatedMember = await prisma.$transaction(async (tx) => {
            // Child 정보 업데이트 (입력된 값만)
            if (data.childName || data.childGrade || data.priorStudentAttended !== undefined || data.siblingsPriorAttended !== undefined || data.parentPriorAttended !== undefined) {
                await tx.child.update({
                    where: { childId: member.childId },
                    data: {
                        name: data.childName,
                        grade: data.childGrade,
                        priorStudentAttended: data.priorStudentAttended,
                        siblingsPriorAttended: data.siblingsPriorAttended,
                        parentPriorAttended: data.parentPriorAttended,
                    },
                });
            }

            // GroupMember 정보 업데이트 (입력된 값만)
            const updated = await tx.groupMember.update({
                where: { groupMemberId: member.groupMemberId },
                data: {
                    parentName: data.parentName,
                    parentPhone: data.parentPhone,
                    noteToInstructor: data.noteToInstructor,
                },
            });

            return updated;
        });

        return NextResponse.json({
            success: true,
            groupMemberId: updatedMember.groupMemberId,
            message: 'Updated successfully'
        });

    } catch (error) {
        console.error('Member Update Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
