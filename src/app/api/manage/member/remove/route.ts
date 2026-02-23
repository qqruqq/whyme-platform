import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiStatusError } from '@/lib/api/errors';
import { subDays } from 'date-fns';
import { z } from 'zod';

const manageMemberRemoveSchema = z.object({
  leaderToken: z.string().min(1, 'leaderToken is required'),
  groupMemberId: z.string().min(1, 'groupMemberId is required'),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const validation = manageMemberRemoveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { leaderToken, groupMemberId } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const leaderLink = await tx.inviteLink.findUnique({
        where: {
          token: leaderToken,
        },
        include: {
          group: {
            select: {
              groupId: true,
              rosterStatus: true,
              slot: {
                select: {
                  startAt: true,
                },
              },
            },
          },
        },
      });

      if (!leaderLink) {
        throw new ApiStatusError(404, '유효하지 않은 대표 학부모 링크입니다.');
      }

      if (leaderLink.purpose !== 'leader_only') {
        throw new ApiStatusError(403, '대표 학부모 링크가 아닙니다.');
      }

      if (leaderLink.expiresAt && new Date() > leaderLink.expiresAt) {
        throw new ApiStatusError(410, '대표 학부모 링크가 만료되었습니다.');
      }

      if (leaderLink.group.rosterStatus === 'locked') {
        throw new ApiStatusError(409, '현재 교육 준비가 완료되어 더 이상 삭제할 수 없습니다.');
      }

      const editDeadline = subDays(leaderLink.group.slot.startAt, 1);
      if (new Date() > editDeadline) {
        throw new ApiStatusError(409, '교육일 전날 이후에는 삭제할 수 없습니다.');
      }

      const member = await tx.groupMember.findFirst({
        where: {
          groupMemberId,
          groupId: leaderLink.group.groupId,
          status: {
            not: 'removed',
          },
        },
        select: {
          groupMemberId: true,
        },
      });

      if (!member) {
        throw new ApiStatusError(404, '삭제할 학생을 찾지 못했습니다.');
      }

      await tx.groupMember.update({
        where: {
          groupMemberId: member.groupMemberId,
        },
        data: {
          status: 'removed',
        },
      });

      return {
        groupId: leaderLink.group.groupId,
        groupMemberId: member.groupMemberId,
      };
    });

    return NextResponse.json({
      success: true,
      groupId: result.groupId,
      groupMemberId: result.groupMemberId,
      message: '학생이 명단에서 삭제되었습니다.',
    });
  } catch (error) {
    if (error instanceof ApiStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Manage Member Remove Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
