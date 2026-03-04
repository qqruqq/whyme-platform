import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractInstructorMemos, extractLocationFromMemo, extractOpsMemos } from '@/lib/group-memo';
import { requireInternalUser } from '@/lib/internal-auth-server';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function parseDateInput(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return todayKey();
}

function parseDayRange(value: string): { start: Date; end: Date } {
  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const auth = await requireInternalUser(request, { roles: ['admin', 'super_admin'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const { searchParams } = new URL(request.url);
    const selectedDate = parseDateInput(searchParams.get('date'));
    const { start, end } = parseDayRange(selectedDate);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const [instructorRows, groups] = await Promise.all([
      prisma.reservationSlot.groupBy({
        by: ['instructorId'],
      }),
      prisma.groupPass.findMany({
        where: {
          slot: {
            startAt: {
              gte: start,
              lte: end,
            },
          },
        },
        include: {
          slot: {
            select: {
              slotId: true,
              startAt: true,
              endAt: true,
              instructorId: true,
            },
          },
          leader: {
            select: {
              parentId: true,
              name: true,
              phone: true,
            },
          },
          inviteLinks: {
            where: {
              purpose: 'leader_only',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              token: true,
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
        orderBy: {
          slot: {
            startAt: 'asc',
          },
        },
      }),
    ]);

    const instructors = instructorRows
      .map((row) => row.instructorId)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const rows = groups.map((group) => {
      const members = group.groupMembers;
      const completedCount = members.filter((member) => member.status === 'completed').length;
      const pendingCount = members.filter((member) => member.status === 'pending').length;
      const leaderManageToken = group.inviteLinks[0]?.token ?? null;

      return {
        groupId: group.groupId,
        slotId: group.slotId,
        classStartAt: group.slot.startAt,
        classEndAt: group.slot.endAt,
        instructorName: group.slot.instructorId,
        status: group.status,
        rosterStatus: group.rosterStatus,
        location: extractLocationFromMemo(group.memoToInstructor),
        headcountDeclared: group.headcountDeclared,
        headcountFinal: group.headcountFinal,
        memberCount: members.length,
        completedCount,
        pendingCount,
        leaderParent: {
          parentId: group.leader.parentId,
          name: group.leader.name,
          phone: group.leader.phone,
        },
        leaderManageUrl: leaderManageToken ? `${baseUrl}/manage/${leaderManageToken}` : null,
        instructorMemos: extractInstructorMemos(group.memoToInstructor),
        opsMemos: extractOpsMemos(group.memoToInstructor),
        members: members.map((member) => ({
          groupMemberId: member.groupMemberId,
          childId: member.childId,
          childName: member.child.name,
          childGrade: member.child.grade,
          parentName: member.parentName,
          parentPhone: member.parentPhone,
          noteToInstructor: member.noteToInstructor,
          status: member.status,
        })),
      };
    });

    const summaryByStatus = {
      pending_info: rows.filter((row) => row.status === 'pending_info').length,
      pending_payment: rows.filter((row) => row.status === 'pending_payment').length,
      confirmed: rows.filter((row) => row.status === 'confirmed').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length,
    };

    return NextResponse.json({
      success: true,
      selectedDate,
      instructors,
      summary: {
        totalGroups: rows.length,
        totalMembers: rows.reduce((acc, row) => acc + row.memberCount, 0),
        status: summaryByStatus,
      },
      rows,
    });
  } catch (error) {
    console.error('Ops Dashboard Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
