import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits } from '@/lib/phone';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid'; // random UUID for invite token

// 입력값 검증 스키마
const bookingSchema = z.object({
    slotId: z.string().min(1, "slotId is required"),
    leaderName: z.string().min(1, "이름을 입력해주세요"),
    leaderPhone: z.string().regex(/^[0-9-]{10,13}$/, "유효한 전화번호 형식이 아닙니다"),
    cashReceiptNumber: z.string().optional(),
    headcountDeclared: z.number().int().min(2).max(6).default(2),
});

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

        const { slotId, leaderName, leaderPhone, cashReceiptNumber, headcountDeclared } = validation.data;
        const normalizedLeaderPhone = normalizePhoneDigits(leaderPhone);

        // 2. 슬롯 존재 여부 확인
        const slot = await prisma.reservationSlot.findUnique({
            where: { slotId }, // 스키마 변경: id -> slotId
        });

        if (!slot) {
            return NextResponse.json(
                { error: 'Reservation slot not found' },
                { status: 404 }
            );
        }

        // 3. 트랜잭션으로 처리 (Parent -> GroupPass -> InviteLink)
        const result = await prisma.$transaction(async (tx) => {
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

            // 3-2. GroupPass 생성
            const groupPass = await tx.groupPass.create({
                data: {
                    slotId,
                    leaderParentId: parent.parentId,
                    headcountDeclared,
                    status: 'pending_info',
                    rosterStatus: 'draft',
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

            return { groupPass, leaderLink };
        });

        // 4. 응답 구성
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const manageUrl = `${baseUrl}/manage/${result.leaderLink.token}`; // manageToken = inviteLink.token

        return NextResponse.json({
            success: true,
            groupId: result.groupPass.groupId,
            manageToken: result.leaderLink.token, // 이것이 곧 링크 접속용 토큰
            manageUrl,
        }, { status: 201 });

    } catch (error) {
        console.error('Booking Create Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
