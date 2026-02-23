import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiStatusError } from '@/lib/api/errors';
import { assertBookingSlotExists } from '@/lib/api/guards';
import { normalizePhoneDigits } from '@/lib/phone';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const bookingStudentSchema = z.object({
  childName: z.string().min(1, '자녀 이름을 입력해주세요'),
  childGrade: z.string().optional(),
  priorStudentAttended: z.boolean().optional(),
  siblingsPriorAttended: z.boolean().optional(),
  parentPriorAttended: z.boolean().optional(),
});

const bookingSchema = z
  .object({
    slotId: z.string().uuid().optional(),
    classDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '교육 일정(날짜) 형식이 올바르지 않습니다')
      .optional(),
    classTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, '교육 일정(시간) 형식이 올바르지 않습니다')
      .optional(),
    instructorName: z.string().trim().min(1, '강사명을 입력해주세요').optional(),
    location: z.string().min(1, '교육 장소를 선택해주세요').optional(),
    leaderName: z.string().min(1, '이름을 입력해주세요'),
    leaderPhone: z.string().regex(/^[0-9-]{10,13}$/, '유효한 전화번호 형식이 아닙니다'),
    cashReceiptNumber: z.string().optional(),
    headcountDeclared: z.number().int().min(2).max(6).default(2),
    // legacy single-student fields
    childName: z.string().min(1, '자녀 이름을 입력해주세요').optional(),
    childGrade: z.string().optional(),
    priorStudentAttended: z.boolean().optional(),
    siblingsPriorAttended: z.boolean().optional(),
    parentPriorAttended: z.boolean().optional(),
    // preferred multi-student fields
    students: z.array(bookingStudentSchema).min(1).max(2).optional(),
    noteToInstructor: z.string().optional(),
    acquisitionChannel: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.slotId && !(data.classDate && data.classTime && data.instructorName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'slotId 또는 교육 일정/강사 정보가 필요합니다.',
        path: ['slotId'],
      });
    }

    const hasStudents = Array.isArray(data.students) && data.students.length > 0;
    const hasLegacyStudent = Boolean(data.childName);

    if (!hasStudents && !hasLegacyStudent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '최소 1명의 학생 정보를 입력해주세요.',
        path: ['students'],
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
      childGrade,
      priorStudentAttended,
      siblingsPriorAttended,
      parentPriorAttended,
      students,
      noteToInstructor,
      acquisitionChannel,
    } = validation.data;

    const normalizedLeaderPhone = normalizePhoneDigits(leaderPhone);
    const derivedStartAt = !slotId && classDate && classTime ? toClassStartAt(classDate, classTime) : null;
    const normalizedInstructorName = instructorName?.trim();

    if (!slotId && !derivedStartAt) {
      return NextResponse.json({ error: 'Invalid schedule format' }, { status: 400 });
    }

    const normalizedStudents =
      students && students.length > 0
        ? students
        : childName
          ? [
              {
                childName,
                childGrade,
                priorStudentAttended,
                siblingsPriorAttended,
                parentPriorAttended,
              },
            ]
          : [];

    const result = await prisma.$transaction(async (tx) => {
      let resolvedSlot;

      if (slotId) {
        resolvedSlot = await tx.reservationSlot.findUnique({
          where: { slotId },
        });

        assertBookingSlotExists(resolvedSlot);
      } else {
        const minuteWindowStart = new Date((derivedStartAt as Date).getTime() - 30 * 1000);
        const minuteWindowEnd = new Date((derivedStartAt as Date).getTime() + 30 * 1000);

        resolvedSlot = await tx.reservationSlot.findFirst({
          where: {
            instructorId: normalizedInstructorName as string,
            startAt: {
              gte: minuteWindowStart,
              lte: minuteWindowEnd,
            },
          },
        });

        if (!resolvedSlot) {
          const defaultDurationMinutes = 120;
          const computedEndAt = new Date((derivedStartAt as Date).getTime() + defaultDurationMinutes * 60 * 1000);

          resolvedSlot = await tx.reservationSlot.create({
            data: {
              startAt: derivedStartAt as Date,
              endAt: computedEndAt,
              instructorId: normalizedInstructorName as string,
              status: 'open',
            },
          });
        }
      }

      if (!resolvedSlot) {
        throw new Error('Reservation slot not found');
      }

      const parent = await tx.parent.upsert({
        where: { phone: normalizedLeaderPhone },
        update: {
          name: leaderName,
          cashReceiptNumber: cashReceiptNumber || undefined,
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

      const groupPass = await tx.groupPass.create({
        data: {
          slotId: resolvedSlot.slotId,
          leaderParentId: parent.parentId,
          headcountDeclared,
          status: 'pending_info',
          rosterStatus: normalizedStudents.length > 0 ? 'collecting' : 'draft',
          memoToInstructor: groupMemoLines.length > 0 ? groupMemoLines.join('\n') : null,
        },
      });

      const manageToken = uuidv4();
      const leaderLink = await tx.inviteLink.create({
        data: {
          groupId: groupPass.groupId,
          token: manageToken,
          purpose: 'leader_only',
          maxUses: 9999,
        },
      });

      const leaderEditTokens: string[] = [];

      for (const student of normalizedStudents) {
        const child = await tx.child.create({
          data: {
            name: student.childName,
            grade: student.childGrade,
            priorStudentAttended: student.priorStudentAttended,
            siblingsPriorAttended: student.siblingsPriorAttended,
            parentPriorAttended: student.parentPriorAttended,
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

        leaderEditTokens.push(editToken);
      }

      return {
        groupPass,
        leaderLink,
        resolvedSlot,
        leaderEditTokens,
      };
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const manageUrl = `${baseUrl}/manage/${result.leaderLink.token}`;
    const leaderEditToken = result.leaderEditTokens[0] ?? null;
    const leaderEditUrl = leaderEditToken ? `${baseUrl}/member/edit/${leaderEditToken}` : null;

    return NextResponse.json(
      {
        success: true,
        groupId: result.groupPass.groupId,
        slotId: result.resolvedSlot.slotId,
        manageToken: result.leaderLink.token,
        manageUrl,
        initialMemberCreated: Boolean(leaderEditToken),
        leaderEditToken,
        leaderEditUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Booking Create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
