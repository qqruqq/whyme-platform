import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appendInstructorMemo, extractInstructorMemos } from '@/lib/group-memo';
import { z } from 'zod';
import { getAuthenticatedInstructorName } from '@/lib/instructor-auth';

const instructorNoteSchema = z.object({
  groupId: z.string().uuid('groupId 형식이 올바르지 않습니다.'),
  note: z.string().trim().min(1, '특이사항 내용을 입력해주세요.'),
});

export async function PATCH(request: Request) {
  try {
    const instructorName = getAuthenticatedInstructorName(request);
    if (!instructorName) {
      return NextResponse.json({ error: '강사 로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const validation = instructorNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { groupId, note } = validation.data;

    const group = await prisma.groupPass.findUnique({
      where: {
        groupId,
      },
      select: {
        groupId: true,
        memoToInstructor: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    const nextMemo = appendInstructorMemo(group.memoToInstructor, instructorName, note);

    const updated = await prisma.groupPass.update({
      where: {
        groupId,
      },
      data: {
        memoToInstructor: nextMemo,
      },
      select: {
        groupId: true,
        memoToInstructor: true,
      },
    });

    return NextResponse.json({
      success: true,
      groupId: updated.groupId,
      instructorMemos: extractInstructorMemos(updated.memoToInstructor),
    });
  } catch (error) {
    console.error('Instructor Note Update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
