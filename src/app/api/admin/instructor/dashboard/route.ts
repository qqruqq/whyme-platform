import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractInstructorMemos, extractLocationFromMemo } from '@/lib/group-memo';
import { normalizeInstructorName } from '@/lib/instructor-auth';
import { requireInternalUser } from '@/lib/internal-auth-server';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDateKey(value: Date): string {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function parseMonthInput(value: string | null): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    if (year >= 2000 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function parseDateInput(value: string | null, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return fallback;
}

function formatTimeLabel(startAt: Date, endAt: Date): string {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatter.format(startAt)} ~ ${formatter.format(endAt)}`;
}

type GroupWithMembers = {
  groupMembers: Array<{
    child: {
      name: string;
      grade: string | null;
    };
  }>;
};

function toTeamName(group: GroupWithMembers): string {
  const firstChildName = group.groupMembers[0]?.child?.name?.trim() || '';
  return firstChildName ? `${firstChildName} 팀` : '팀 미정';
}

function toGradeSummary(group: GroupWithMembers): string {
  const grades = Array.from(
    new Set(
      group.groupMembers
        .map((member) => member.child.grade?.trim() || '')
        .filter((grade): grade is string => Boolean(grade))
    )
  );

  return grades.length ? grades.join(', ') : '-';
}

function toSlotTitle(group: GroupWithMembers): string {
  return `${toTeamName(group)} / ${toGradeSummary(group)}`;
}

type CalendarSummary = {
  date: string;
  mySlotCount: number;
  myGroupCount: number;
  allSlotCount: number;
  allGroupCount: number;
};

type CalendarPreviewItem = {
  slotId: string;
  timeLabel: string;
  groupCount: number;
  instructorName: string;
  teamName: string;
  title: string;
};

type StudentHistoryItem = {
  groupId: string;
  classStartAt: Date;
  classEndAt: Date;
  instructorName: string;
  location: string | null;
  groupStatus: string;
  rosterStatus: string;
  parentRequestNote: string | null;
  priorStudentAttended: boolean | null;
  siblingsPriorAttended: boolean | null;
  parentPriorAttended: boolean | null;
  instructorMemos: ReturnType<typeof extractInstructorMemos>;
};

type LeaderMemoHistoryItem = {
  groupId: string;
  classStartAt: Date;
  createdAtIso: string;
  instructorName: string;
  content: string;
};

export async function GET(request: Request) {
  try {
    const auth = await requireInternalUser(request, { roles: ['instructor'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const { searchParams } = new URL(request.url);
    const { year, month } = parseMonthInput(searchParams.get('month'));
    const fallbackDate = `${year}-${pad2(month)}-01`;
    const selectedDate = parseDateInput(searchParams.get('date'), fallbackDate);

    const selectedSlotInput = searchParams.get('slotId')?.trim() || '';
    const includeAllRaw = searchParams.get('includeAll');
    const includeAll =
      includeAllRaw === '1' || includeAllRaw === 'true' || includeAllRaw === 'yes' || includeAllRaw === 'on';
    const selectedInstructor = normalizeInstructorName(auth.user.name);

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const [instructorRows, slots] = await Promise.all([
      prisma.reservationSlot.groupBy({
        by: ['instructorId'],
      }),
      prisma.reservationSlot.findMany({
        where: {
          startAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        include: {
          groupPasses: {
            include: {
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
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          startAt: 'asc',
        },
      }),
    ]);

    const discoveredInstructors = Array.from(
      new Set(
        instructorRows
          .map((row) => normalizeInstructorName(row.instructorId))
          .filter((name): name is string => Boolean(name))
      )
    ).sort((a, b) => a.localeCompare(b));
    const instructors = discoveredInstructors.length ? discoveredInstructors : [selectedInstructor];
    if (!instructors.includes(selectedInstructor)) {
      instructors.unshift(selectedInstructor);
    }
    const mySlotsInMonth = slots.filter(
      (slot) => normalizeInstructorName(slot.instructorId) === selectedInstructor
    );
    const firstAvailableDate = mySlotsInMonth[0]?.startAt
      ? formatLocalDateKey(mySlotsInMonth[0].startAt)
      : slots[0]?.startAt
      ? formatLocalDateKey(slots[0].startAt)
      : null;

    const daysInMonth = new Date(year, month, 0).getDate();

    const calendarMap = new Map<string, CalendarSummary>();
    const calendarPreviewMap = new Map<string, CalendarPreviewItem[]>();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${pad2(month)}-${pad2(day)}`;
      calendarMap.set(key, {
        date: key,
        mySlotCount: 0,
        myGroupCount: 0,
        allSlotCount: 0,
        allGroupCount: 0,
      });
      calendarPreviewMap.set(key, []);
    }

    for (const slot of slots) {
      const dateKey = formatLocalDateKey(slot.startAt);
      const cell = calendarMap.get(dateKey);
      if (!cell) continue;

      cell.allSlotCount += 1;
      cell.allGroupCount += slot.groupPasses.length;

      const slotInstructor = normalizeInstructorName(slot.instructorId);
      const isMySlot = slotInstructor === selectedInstructor;
      if (isMySlot) {
        cell.mySlotCount += 1;
        cell.myGroupCount += slot.groupPasses.length;
      }

      const previews = calendarPreviewMap.get(dateKey);
      if (previews && (includeAll || isMySlot)) {
        const firstGroup = slot.groupPasses[0] ?? null;
        const teamName = firstGroup ? (isMySlot ? toTeamName(firstGroup) : '전체 일정') : '일정';
        const title = firstGroup ? (isMySlot ? toSlotTitle(firstGroup) : '타 강사 일정') : '일정';

        previews.push({
          slotId: slot.slotId,
          timeLabel: `${pad2(slot.startAt.getHours())}:${pad2(slot.startAt.getMinutes())}`,
          groupCount: slot.groupPasses.length,
          instructorName: slotInstructor,
          teamName,
          title,
        });
      }
    }

    const allDateSlots = slots.filter((slot) => formatLocalDateKey(slot.startAt) === selectedDate);
    const myDateSlots = allDateSlots.filter(
      (slot) => normalizeInstructorName(slot.instructorId) === selectedInstructor
    );

    const daySchedules = myDateSlots.map((slot) => ({
      slotId: slot.slotId,
      classStartAt: slot.startAt,
      classEndAt: slot.endAt,
      classTimeLabel: formatTimeLabel(slot.startAt, slot.endAt),
      groupCount: slot.groupPasses.length,
    }));

    const allSchedules = allDateSlots.map((slot) => ({
      slotId: slot.slotId,
      instructorName: normalizeInstructorName(slot.instructorId),
      classStartAt: slot.startAt,
      classEndAt: slot.endAt,
      classTimeLabel: formatTimeLabel(slot.startAt, slot.endAt),
      groupCount: slot.groupPasses.length,
    }));

    const selectedSlotInMonth = mySlotsInMonth.find((slot) => slot.slotId === selectedSlotInput);
    const selectedSlotId = selectedSlotInMonth ? selectedSlotInput : '';
    const selectedSlot = selectedSlotInMonth ?? null;

    const historyCache = new Map<string, StudentHistoryItem[]>();
    const leaderMemoCache = new Map<string, LeaderMemoHistoryItem[]>();

    const loadStudentHistory = async (
      currentGroupId: string,
      childName: string,
      parentPhone: string | null
    ): Promise<StudentHistoryItem[]> => {
      const normalizedParentPhone = parentPhone?.trim() || '';
      if (!normalizedParentPhone || !childName.trim()) {
        return [];
      }

      const cacheKey = `${currentGroupId}|${normalizedParentPhone}|${childName.trim()}`;
      const cached = historyCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const rows = await prisma.groupMember.findMany({
        where: {
          groupId: {
            not: currentGroupId,
          },
          parentPhone: normalizedParentPhone,
          status: {
            not: 'removed',
          },
          child: {
            name: {
              equals: childName,
              mode: 'insensitive',
            },
          },
        },
        include: {
          child: true,
          group: {
            include: {
              slot: {
                select: {
                  startAt: true,
                  endAt: true,
                  instructorId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 8,
      });

      const histories = rows
        .sort((a, b) => b.group.slot.startAt.getTime() - a.group.slot.startAt.getTime())
        .map((row) => ({
          groupId: row.groupId,
          classStartAt: row.group.slot.startAt,
          classEndAt: row.group.slot.endAt,
          instructorName: normalizeInstructorName(row.group.slot.instructorId),
          location: extractLocationFromMemo(row.group.memoToInstructor),
          groupStatus: row.group.status,
          rosterStatus: row.group.rosterStatus,
          parentRequestNote: row.noteToInstructor,
          priorStudentAttended: row.child.priorStudentAttended,
          siblingsPriorAttended: row.child.siblingsPriorAttended,
          parentPriorAttended: row.child.parentPriorAttended,
          instructorMemos: extractInstructorMemos(row.group.memoToInstructor),
        }));

      historyCache.set(cacheKey, histories);
      return histories;
    };

    const loadLeaderMemoHistory = async (leaderParentId: string): Promise<LeaderMemoHistoryItem[]> => {
      const normalizedLeaderParentId = leaderParentId.trim();
      if (!normalizedLeaderParentId) {
        return [];
      }

      const cached = leaderMemoCache.get(normalizedLeaderParentId);
      if (cached) {
        return cached;
      }

      const rows = await prisma.groupPass.findMany({
        where: {
          leaderParentId: normalizedLeaderParentId,
          memoToInstructor: {
            not: null,
          },
        },
        include: {
          slot: {
            select: {
              startAt: true,
            },
          },
        },
        orderBy: [
          {
            slot: {
              startAt: 'desc',
            },
          },
          {
            updatedAt: 'desc',
          },
        ],
        take: 20,
      });

      const historyItems = rows
        .flatMap((row) => {
          const memos = extractInstructorMemos(row.memoToInstructor);
          return memos.map((memo) => ({
            groupId: row.groupId,
            classStartAt: row.slot.startAt,
            createdAtIso: memo.createdAtIso,
            instructorName: memo.instructorName,
            content: memo.content,
          }));
        })
        .sort((a, b) => {
          const byClassDate = b.classStartAt.getTime() - a.classStartAt.getTime();
          if (byClassDate !== 0) return byClassDate;
          return b.createdAtIso.localeCompare(a.createdAtIso);
        });

      leaderMemoCache.set(normalizedLeaderParentId, historyItems);
      return historyItems;
    };

    const selectedSchedule = selectedSlot
      ? {
          slotId: selectedSlot.slotId,
          classStartAt: selectedSlot.startAt,
          classEndAt: selectedSlot.endAt,
          classTimeLabel: formatTimeLabel(selectedSlot.startAt, selectedSlot.endAt),
          groupCount: selectedSlot.groupPasses.length,
          groups: await Promise.all(
            selectedSlot.groupPasses.map(async (group) => {
              const members = group.groupMembers;
              const leaderMemoHistory = await loadLeaderMemoHistory(group.leaderParentId);
              const grades = Array.from(new Set(members.map((member) => member.child.grade).filter(Boolean)));
              const students = await Promise.all(
                members.map(async (member) => ({
                  groupMemberId: member.groupMemberId,
                  childId: member.childId,
                  childName: member.child.name,
                  childGrade: member.child.grade,
                  parentName: member.parentName,
                  parentPhone: member.parentPhone,
                  noteToInstructor: member.noteToInstructor,
                  priorStudentAttended: member.child.priorStudentAttended,
                  siblingsPriorAttended: member.child.siblingsPriorAttended,
                  parentPriorAttended: member.child.parentPriorAttended,
                  history: await loadStudentHistory(group.groupId, member.child.name, member.parentPhone),
                }))
              );

              return {
                groupId: group.groupId,
                status: group.status,
                rosterStatus: group.rosterStatus,
                location: extractLocationFromMemo(group.memoToInstructor),
                gradeSummary: grades.join(', ') || '-',
                headcountDeclared: group.headcountDeclared,
                headcountFinal: group.headcountFinal,
                memberCount: members.length,
                leaderParentName: group.leader.name,
                leaderParentPhone: group.leader.phone,
                leaderMemoHistory: leaderMemoHistory.filter((item) => item.groupId !== group.groupId).slice(0, 8),
                students,
                instructorMemos: extractInstructorMemos(group.memoToInstructor),
              };
            })
          ),
        }
      : null;

    const selectedDateSummary =
      calendarMap.get(selectedDate) ??
      ({
        date: selectedDate,
        mySlotCount: myDateSlots.length,
        myGroupCount: myDateSlots.reduce((acc, slot) => acc + slot.groupPasses.length, 0),
        allSlotCount: allDateSlots.length,
        allGroupCount: allDateSlots.reduce((acc, slot) => acc + slot.groupPasses.length, 0),
      } satisfies CalendarSummary);

    return NextResponse.json({
      success: true,
      selectedInstructor,
      selectedDate,
      selectedMonth: `${year}-${pad2(month)}`,
      selectedSlotId,
      instructors,
      calendar: Array.from(calendarMap.values()),
      calendarPreviews: Array.from(calendarPreviewMap.entries()).map(([date, items]) => ({ date, items })),
      firstAvailableDate,
      selectedDateSummary,
      daySchedules,
      allSchedules,
      selectedSchedule,
    });
  } catch (error) {
    console.error('Instructor Dashboard Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
