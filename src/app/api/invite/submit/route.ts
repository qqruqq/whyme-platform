import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    parentPhone: z.string().min(10, "연락처는 10자리 이상이어야 합니다").optional().or(z.literal('')),

    noteToInstructor: z.string().optional(),
});

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

        // 2. 초대 토큰 조회
        const invite = await prisma.inviteLink.findUnique({
            where: { token: data.token },
            include: { group: true },
        });

        // 2-1. 토큰 존재 여부
        if (!invite) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
        }

        // 2-2. 용도 확인 (roster_entry)
        if (invite.purpose !== 'roster_entry') {
            return NextResponse.json({ error: 'Invalid token purpose' }, { status: 403 });
        }

        // 2-3. 만료 확인
        if (invite.expiresAt && new Date() > invite.expiresAt) {
            return NextResponse.json({ error: 'Token expired' }, { status: 410 });
        }

        // 2-4. 사용 횟수 확인
        if (invite.usedCount >= invite.maxUses) {
            return NextResponse.json({ error: 'Token already used' }, { status: 409 });
        }

        // 2-5. 그룹 Roster 상태 확인
        if (invite.group.rosterStatus === 'locked') {
            return NextResponse.json(
                { error: 'Group roster is locked' },
                { status: 409 }
            );
        }

        // 3. 트랜잭션 수행 (Child 생성 -> Member 생성 -> Token 업데이트 -> 현재 인원 조회)
        // 트랜잭션을 사용해 정합성 보장
        const result = await prisma.$transaction(async (tx) => {
            // 3-1. Child 생성
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
                    parentPhone: data.parentPhone || null, // 빈 문자열이면 null 저장
                    noteToInstructor: data.noteToInstructor,
                    editToken: editToken, // 수정용 토큰 저장을 여기서 함
                    status: 'completed', // 입력 완료 상태
                },
            });

            // 3-3. InviteLink 업데이트
            await tx.inviteLink.update({
                where: { inviteId: invite.inviteId },
                data: {
                    usedCount: { increment: 1 },
                    usedAt: new Date(),
                    usedBy: `Child:${child.name}`, // 간단 식별자 기록
                },
            });

            // 3-4. 현재 그룹에 등록된 전체 멤버 수 확인 (옵션: GroupPass.headcountFinal 업데이트 등)
            const currentCount = await tx.groupMember.count({
                where: { groupId: invite.groupId },
            });

            return { member, currentCount, editToken };
        });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const editUrl = `${baseUrl}/member/edit/${result.editToken}`;

        return NextResponse.json({
            success: true,
            groupId: invite.groupId,
            groupMemberId: result.member.groupMemberId,
            currentMemberCount: result.currentCount,
            editToken: result.editToken,
            editUrl,
        }, { status: 201 });

    } catch (error) {
        console.error('Invite Submit Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
