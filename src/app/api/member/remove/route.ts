import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiStatusError } from '@/lib/api/errors';
import { subDays } from 'date-fns';
import { z } from 'zod';

const memberRemoveSchema = z.object({
  editToken: z.string().min(1, 'editToken is required'),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const validation = memberRemoveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.groupMember.findUnique({
        where: {
          editToken: data.editToken,
        },
        include: {
          group: {
            include: {
              slot: {
                select: {
                  startAt: true,
                },
              },
            },
          },
        },
      });

      if (!member || member.status === 'removed') {
        throw new ApiStatusError(404, '해당 학생 정보를 찾을 수 없습니다.');
      }

      if (member.group.rosterStatus === 'locked') {
        throw new ApiStatusError(409, '현재 교육 준비가 완료되어 더 이상 삭제할 수 없습니다.');
      }

      const editDeadline = subDays(member.group.slot.startAt, 1);
      if (new Date() > editDeadline) {
        throw new ApiStatusError(409, '교육일 전날 이후에는 삭제할 수 없습니다.');
      }

      await tx.groupMember.update({
        where: {
          groupMemberId: member.groupMemberId,
        },
        data: {
          status: 'removed',
        },
      });

      const nextMember =
        member.parentPhone
          ? await tx.groupMember.findFirst({
              where: {
                groupId: member.groupId,
                parentPhone: member.parentPhone,
                status: {
                  not: 'removed',
                },
                editToken: {
                  not: null,
                },
                NOT: {
                  groupMemberId: member.groupMemberId,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                editToken: true,
              },
            })
          : null;

      return {
        groupId: member.groupId,
        groupMemberId: member.groupMemberId,
        nextEditToken: nextMember?.editToken ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      groupId: result.groupId,
      groupMemberId: result.groupMemberId,
      nextEditToken: result.nextEditToken,
      message: '학생 정보가 삭제되었습니다.',
    });
  } catch (error) {
    if (error instanceof ApiStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Member Remove Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
