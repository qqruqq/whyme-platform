import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractInstructorMemos, extractLocationFromMemo } from '@/lib/group-memo';

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

function getCookieValue(cookieHeader: string | null, key: string): string {
  if (!cookieHeader) return '';

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));

  if (!cookie) return '';

  const value = cookie.slice(key.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeInstructorName(value: string | null | undefined): string {
  return (value || '').trim();
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { year, month } = parseMonthInput(searchParams.get('month'));
    const fallbackDate = `${year}-${pad2(month)}-01`;
    const selectedDate = parseDateInput(searchParams.get('date'), fallbackDate);

    const selectedSlotInput = searchParams.get('slotId')?.trim() || '';
    const queryInstructor = normalizeInstructorName(searchParams.get('instructor'));
    const headerInstructor = normalizeInstructorName(request.headers.get('x-whyme-instructor'));
    const cookieInstructor = normalizeInstructorName(getCookieValue(request.headers.get('cookie'), 'wm_instructor_name'));

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

    const instructorCandidate = normalizeInstructorName(headerInstructor || cookieInstructor || queryInstructor);
    const discoveredInstructors = Array.from(
      new Set([
        ...instructorRows
          .map((row) => normalizeInstructorName(row.instructorId))
          .filter((name): name is string => Boolean(name)),
        ...(instructorCandidate ? [instructorCandidate] : []),
      ])
    ).sort((a, b) => a.localeCompare(b));

    const instructors = discoveredInstructors.length ? discoveredInstructors : ['이시훈 대표강사'];
    const selectedInstructor = normalizeInstructorName(instructorCandidate || instructors[0] || '이시훈 대표강사');
    const hasSelectedInstructorSlots = slots.some(
      (slot) => normalizeInstructorName(slot.instructorId) === selectedInstructor
    );
    const useAllAsMySchedule = !selectedInstructor || !hasSelectedInstructorSlots;

    const [firstInstructorSlot, firstAnySlot] = await Promise.all([
      selectedInstructor
        ? prisma.reservationSlot.findFirst({
            where: {
              instructorId: {
                contains: selectedInstructor,
                mode: 'insensitive',
              },
            },
            orderBy: {
              startAt: 'asc',
            },
            select: {
              startAt: true,
            },
          })
        : Promise.resolve(null),
      prisma.reservationSlot.findFirst({
        orderBy: {
          startAt: 'asc',
        },
        select: {
          startAt: true,
        },
      }),
    ]);
    const firstAvailableDate = firstInstructorSlot?.startAt
      ? formatLocalDateKey(firstInstructorSlot.startAt)
      : firstAnySlot?.startAt
      ? formatLocalDateKey(firstAnySlot.startAt)
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
      const isMySlot = useAllAsMySchedule ? true : slotInstructor === selectedInstructor;
      if (isMySlot) {
        cell.mySlotCount += 1;
        cell.myGroupCount += slot.groupPasses.length;
      }

      const previews = calendarPreviewMap.get(dateKey);
      if (previews) {
        previews.push({
          slotId: slot.slotId,
          timeLabel: `${pad2(slot.startAt.getHours())}:${pad2(slot.startAt.getMinutes())}`,
          groupCount: slot.groupPasses.length,
          instructorName: slotInstructor,
        });
      }
    }

    const allDateSlots = slots.filter((slot) => formatLocalDateKey(slot.startAt) === selectedDate);
    const myDateSlots = useAllAsMySchedule
      ? allDateSlots
      : allDateSlots.filter((slot) => normalizeInstructorName(slot.instructorId) === selectedInstructor);

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

    const selectedSlotInMonth = slots.find((slot) => slot.slotId === selectedSlotInput);
    const selectedSlotId = selectedSlotInMonth ? selectedSlotInput : '';
    const selectedSlot = selectedSlotInMonth ?? null;

    const historyCache = new Map<string, StudentHistoryItem[]>();

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
