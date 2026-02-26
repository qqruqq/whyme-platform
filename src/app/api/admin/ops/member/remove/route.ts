import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const removeSchema = z.object({
  groupMemberId: z.string().uuid('groupMemberId 형식이 올바르지 않습니다.'),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const validation = removeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { groupMemberId } = validation.data;

    const member = await prisma.groupMember.findUnique({
      where: {
        groupMemberId,
      },
      select: {
        groupMemberId: true,
        groupId: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.groupMember.update({
      where: {
        groupMemberId,
      },
      data: {
        status: 'removed',
      },
    });

    const activeCount = await prisma.groupMember.count({
      where: {
        groupId: member.groupId,
        status: {
          not: 'removed',
        },
      },
    });

    return NextResponse.json({
      success: true,
      groupId: member.groupId,
      groupMemberId,
      activeCount,
    });
  } catch (error) {
    console.error('Ops Member Remove Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
