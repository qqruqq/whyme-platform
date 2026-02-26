import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  appendOpsMemo,
  extractInstructorMemos,
  extractLocationFromMemo,
  extractOpsMemos,
  upsertLocationInMemo,
} from '@/lib/group-memo';
import { z } from 'zod';

const opsGroupUpdateSchema = z
  .object({
    groupId: z.string().uuid('groupId 형식이 올바르지 않습니다.'),
    status: z.enum(['pending_info', 'pending_payment', 'confirmed', 'cancelled']).optional(),
    rosterStatus: z.enum(['draft', 'collecting', 'locked', 'completed']).optional(),
    instructorName: z.string().trim().min(1).optional(),
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'classDate 형식이 올바르지 않습니다.').optional(),
    classTime: z.string().regex(/^\d{2}:\d{2}$/, 'classTime 형식이 올바르지 않습니다.').optional(),
    location: z.string().trim().optional(),
    headcountDeclared: z.number().int().min(2).max(6).optional(),
    opsMemo: z.string().trim().optional(),
    actorName: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.rosterStatus !== undefined ||
      data.instructorName !== undefined ||
      data.classDate !== undefined ||
      data.classTime !== undefined ||
      data.location !== undefined ||
      data.headcountDeclared !== undefined ||
      data.opsMemo !== undefined,
    {
      message: '최소 1개 이상의 변경 항목이 필요합니다.',
      path: ['groupId'],
    }
  );

function mergeDateTime(base: Date, classDate?: string, classTime?: string): Date {
  const currentYear = base.getFullYear();
  const currentMonth = base.getMonth() + 1;
  const currentDate = base.getDate();
  const currentHour = base.getHours();
  const currentMinute = base.getMinutes();

  const [year, month, day] = classDate
    ? classDate.split('-').map(Number)
    : [currentYear, currentMonth, currentDate];
  const [hour, minute] = classTime ? classTime.split(':').map(Number) : [currentHour, currentMinute];

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const validation = opsGroupUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const actorName = data.actorName || '실무자';

    const updated = await prisma.$transaction(async (tx) => {
      const group = await tx.groupPass.findUnique({
        where: {
          groupId: data.groupId,
        },
        include: {
          slot: true,
          leader: {
            select: {
              name: true,
              phone: true,
            },
          },
          groupMembers: {
            where: {
              status: {
                not: 'removed',
              },
            },
            include: {
              child: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!group) {
        return null;
      }

      const groupUpdateData: {
        status?: 'pending_info' | 'pending_payment' | 'confirmed' | 'cancelled';
        rosterStatus?: 'draft' | 'collecting' | 'locked' | 'completed';
        headcountDeclared?: number;
        memoToInstructor?: string | null;
      } = {};

      if (data.status !== undefined) {
        groupUpdateData.status = data.status;
      }
      if (data.rosterStatus !== undefined) {
        groupUpdateData.rosterStatus = data.rosterStatus;
      }
      if (data.headcountDeclared !== undefined) {
        groupUpdateData.headcountDeclared = data.headcountDeclared;
      }

      let nextMemo = group.memoToInstructor;
      if (data.location !== undefined) {
        nextMemo = upsertLocationInMemo(nextMemo, data.location);
      }
      if (data.opsMemo !== undefined && data.opsMemo.trim().length > 0) {
        nextMemo = appendOpsMemo(nextMemo, actorName, data.opsMemo);
      }
      if (nextMemo !== group.memoToInstructor) {
        groupUpdateData.memoToInstructor = nextMemo;
      }

      if (Object.keys(groupUpdateData).length > 0) {
        await tx.groupPass.update({
          where: {
            groupId: data.groupId,
          },
          data: groupUpdateData,
        });
      }

      if (data.instructorName !== undefined || data.classDate !== undefined || data.classTime !== undefined) {
        const slotDurationMs = Math.max(group.slot.endAt.getTime() - group.slot.startAt.getTime(), 120 * 60 * 1000);
        const nextStartAt = mergeDateTime(group.slot.startAt, data.classDate, data.classTime);
        const nextEndAt = new Date(nextStartAt.getTime() + slotDurationMs);

        await tx.reservationSlot.update({
          where: {
            slotId: group.slotId,
          },
          data: {
            instructorId: data.instructorName ?? group.slot.instructorId,
            startAt: nextStartAt,
            endAt: nextEndAt,
          },
        });
      }

      return tx.groupPass.findUnique({
        where: {
          groupId: data.groupId,
        },
        include: {
          slot: {
            select: {
              startAt: true,
              endAt: true,
              instructorId: true,
            },
          },
          leader: {
            select: {
              name: true,
              phone: true,
            },
          },
          groupMembers: {
            where: {
              status: {
                not: 'removed',
              },
            },
            include: {
              child: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
    });

    if (!updated) {
      return NextResponse.json({ error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      row: {
        groupId: updated.groupId,
        classStartAt: updated.slot.startAt,
        classEndAt: updated.slot.endAt,
        instructorName: updated.slot.instructorId,
        status: updated.status,
        rosterStatus: updated.rosterStatus,
        location: extractLocationFromMemo(updated.memoToInstructor),
        headcountDeclared: updated.headcountDeclared,
        headcountFinal: updated.headcountFinal,
        leaderParent: {
          name: updated.leader.name,
          phone: updated.leader.phone,
        },
        instructorMemos: extractInstructorMemos(updated.memoToInstructor),
        opsMemos: extractOpsMemos(updated.memoToInstructor),
        members: updated.groupMembers.map((member) => ({
          groupMemberId: member.groupMemberId,
          childName: member.child.name,
          childGrade: member.child.grade,
          parentName: member.parentName,
          parentPhone: member.parentPhone,
          noteToInstructor: member.noteToInstructor,
          status: member.status,
        })),
      },
    });
  } catch (error) {
    console.error('Ops Group Update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
