import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getAuthenticatedInstructorName } from '@/lib/instructor-auth';

const createScheduleSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, '시작 시간 형식이 올바르지 않습니다.'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, '종료 시간 형식이 올바르지 않습니다.'),
    title: z.string().trim().optional(),
    location: z.string().trim().optional(),
    description: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.date}T${data.startTime}:00`);
    const end = new Date(`${data.date}T${data.endTime}:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '유효한 날짜/시간을 입력해주세요.',
        path: ['startTime'],
      });
      return;
    }

    if (end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '종료 시간은 시작 시간보다 늦어야 합니다.',
        path: ['endTime'],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const instructorName = getAuthenticatedInstructorName(request);
    if (!instructorName) {
      return NextResponse.json({ error: '강사 로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createScheduleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { date, startTime, endTime } = validation.data;

    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);

    const existing = await prisma.reservationSlot.findFirst({
      where: {
        instructorId: instructorName,
        startAt,
        endAt,
      },
      select: {
        slotId: true,
        startAt: true,
        endAt: true,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        created: false,
        slotId: existing.slotId,
        classStartAt: existing.startAt,
        classEndAt: existing.endAt,
      });
    }

    const created = await prisma.reservationSlot.create({
      data: {
        startAt,
        endAt,
        instructorId: instructorName,
        status: 'open',
      },
      select: {
        slotId: true,
        startAt: true,
        endAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        created: true,
        slotId: created.slotId,
        classStartAt: created.startAt,
        classEndAt: created.endAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Instructor Schedule Create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
