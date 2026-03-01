'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import InlineCalendar, {
  type InlineCalendarDateSelectPayload,
  type InlineCalendarDayBadge,
  type InlineCalendarDayItem,
} from '@/components/InlineCalendar';
import styles from './page.module.css';

type InstructorMemo = {
  createdAtIso: string;
  instructorName: string;
  content: string;
};

type LeaderMemoHistoryItem = {
  groupId: string;
  classStartAt: string;
  createdAtIso: string;
  instructorName: string;
  content: string;
};

type StudentHistoryItem = {
  groupId: string;
  classStartAt: string;
  classEndAt: string;
  instructorName: string;
  location: string | null;
  groupStatus: string;
  rosterStatus: string;
  parentRequestNote: string | null;
  priorStudentAttended: boolean | null;
  siblingsPriorAttended: boolean | null;
  parentPriorAttended: boolean | null;
  instructorMemos: InstructorMemo[];
};

type StudentCard = {
  groupMemberId: string;
  childId: string;
  childName: string;
  childGrade: string | null;
  parentName: string | null;
  parentPhone: string | null;
  noteToInstructor: string | null;
  priorStudentAttended: boolean | null;
  siblingsPriorAttended: boolean | null;
  parentPriorAttended: boolean | null;
  history: StudentHistoryItem[];
};

type GroupCard = {
  groupId: string;
  status: string;
  rosterStatus: string;
  location: string | null;
  gradeSummary: string;
  headcountDeclared: number | null;
  headcountFinal: number | null;
  memberCount: number;
  leaderParentName: string | null;
  leaderParentPhone: string | null;
  leaderMemoHistory: LeaderMemoHistoryItem[];
  students: StudentCard[];
  instructorMemos: InstructorMemo[];
};

type ScheduleSummary = {
  slotId: string;
  classStartAt: string;
  classEndAt: string;
  classTimeLabel: string;
  groupCount: number;
};

type ScheduleSummaryAll = ScheduleSummary & {
  instructorName: string;
};

type SelectedSchedule = ScheduleSummary & {
  groups: GroupCard[];
};

type CalendarCell = {
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

type CalendarPreviewCell = {
  date: string;
  items: CalendarPreviewItem[];
};

type DashboardResponse = {
  success: boolean;
  selectedInstructor: string;
  selectedDate: string;
  selectedMonth: string;
  selectedSlotId: string;
  instructors: string[];
  calendar: CalendarCell[];
  calendarPreviews: CalendarPreviewCell[];
  firstAvailableDate: string | null;
  selectedDateSummary: CalendarCell;
  daySchedules: ScheduleSummary[];
  allSchedules: ScheduleSummaryAll[];
  selectedSchedule: SelectedSchedule | null;
};

type FloatingPosition = {
  top: number;
  left: number;
};

type FloatingAnchor = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

type CreateScheduleResponse = {
  success: boolean;
  slotId: string;
  created: boolean;
};

type AuthCheckResponse = {
  success: boolean;
  authenticated: boolean;
  instructorName?: string;
};

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '요청 처리 중 오류가 발생했습니다.';
  }

  const typed = payload as ApiErrorPayload;
  const fieldErrors = typed.details?.fieldErrors;
  if (fieldErrors) {
    const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0);
    if (firstField?.[0]) return firstField[0];
  }

  return typed.error ?? '요청 처리 중 오류가 발생했습니다.';
}

function formatDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10) || '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default function InstructorAdminPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [instructorIdentity, setInstructorIdentity] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAllSchedules, setShowAllSchedules] = useState(true);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const latestFetchIdRef = useRef(0);
  const floatingPanelRef = useRef<HTMLDivElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition | null>(null);
  const [floatingAnchor, setFloatingAnchor] = useState<FloatingAnchor | null>(null);
  const [createPosition, setCreatePosition] = useState<FloatingPosition | null>(null);
  const [createAnchor, setCreateAnchor] = useState<FloatingAnchor | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    date: todayKey(),
    startTime: '10:00',
    endTime: '12:00',
    location: '',
    description: '',
  });
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      setAuthChecking(true);

      try {
        const response = await fetch('/api/admin/instructor/auth', {
          cache: 'no-store',
        });
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok) {
          setIsAuthenticated(false);
          setInstructorIdentity('');
          setDashboard(null);
          setAuthChecking(false);
          router.replace('/admin/login');
          return;
        }

        const data = payload as AuthCheckResponse;
        if (data.authenticated && data.instructorName) {
          const normalizedName = data.instructorName.trim();
          setIsAuthenticated(true);
          setInstructorIdentity(normalizedName);
        } else {
          setIsAuthenticated(false);
          setInstructorIdentity('');
          setDashboard(null);
          router.replace('/admin/login');
        }
      } catch (_error) {
        if (cancelled) return;
        setIsAuthenticated(false);
        setInstructorIdentity('');
        setDashboard(null);
        router.replace('/admin/login');
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    };

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const monthKey = useMemo(() => selectedDate.slice(0, 7), [selectedDate]);

  const fetchDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setDashboard(null);
      setLoading(false);
      setLoadingError(null);
      return;
    }

    const fetchId = latestFetchIdRef.current + 1;
    latestFetchIdRef.current = fetchId;

    setLoading(true);
    setLoadingError(null);

    try {
      const params = new URLSearchParams({
        month: monthKey,
        date: selectedDate,
      });
      if (selectedSlotId) {
        params.set('slotId', selectedSlotId);
      }
      params.set('includeAll', showAllSchedules ? '1' : '0');

      const response = await fetch(`/api/admin/instructor/dashboard?${params.toString()}`);

      const payload: unknown = await response.json().catch(() => null);
      if (fetchId !== latestFetchIdRef.current) {
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          setInstructorIdentity('');
          setDashboard(null);
          setLoadingError('세션이 만료되었습니다. 관리자 로그인 페이지로 이동합니다.');
          router.replace('/admin/login');
          return;
        }
        setLoadingError(parseError(payload));
        return;
      }

      const data = payload as DashboardResponse;
      setDashboard(data);
    } catch (_error) {
      if (fetchId !== latestFetchIdRef.current) {
        return;
      }
      setLoadingError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, monthKey, router, selectedDate, selectedSlotId, showAllSchedules]);

  useEffect(() => {
    if (!authChecking && isAuthenticated) {
      void fetchDashboard();
    }
  }, [authChecking, fetchDashboard, isAuthenticated]);

  const onSaveGroupNote = useCallback(
    async (groupId: string) => {
      const draft = noteDrafts[groupId]?.trim();
      if (!draft) return;

      setSavingGroupId(groupId);
      setNoteMessage(null);
      setNoteError(null);

      try {
        const response = await fetch('/api/admin/instructor/note', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId,
            note: draft,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setNoteError(parseError(payload));
          return;
        }

        setNoteDrafts((prev) => ({
          ...prev,
          [groupId]: '',
        }));
        setNoteMessage('특이사항을 저장했습니다.');
        await fetchDashboard();
      } catch (_error) {
        setNoteError('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setSavingGroupId(null);
      }
    },
    [fetchDashboard, noteDrafts]
  );

  const closeCreatePanel = useCallback(() => {
    setCreatePosition(null);
    setCreateAnchor(null);
  }, []);

  const onCreateSchedule = useCallback(async () => {
    const instructorName = instructorIdentity.trim();
    if (!instructorName) {
      setCreateError('로그인된 강사 정보를 확인할 수 없습니다.');
      return;
    }

    setCreatingSchedule(true);
    setCreateError(null);
    setCreateMessage(null);

    try {
      const response = await fetch('/api/admin/instructor/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: createForm.date,
          startTime: createForm.startTime,
          endTime: createForm.endTime,
          title: createForm.title.trim() || undefined,
          location: createForm.location.trim() || undefined,
          description: createForm.description.trim() || undefined,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setCreateError(parseError(payload));
        return;
      }

      const data = payload as CreateScheduleResponse;
      setCreateMessage(data.created ? '일정을 등록했습니다.' : '동일한 일정이 이미 있어 기존 일정을 불러왔습니다.');
      setSelectedDate(createForm.date);
      setSelectedSlotId(data.slotId);
      setFloatingPosition(null);
      setFloatingAnchor(null);
      closeCreatePanel();
      setCreateForm((prev) => ({
        ...prev,
        title: '',
        location: '',
        description: '',
      }));
      await fetchDashboard();
    } catch (_error) {
      setCreateError('일정 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setCreatingSchedule(false);
    }
  }, [closeCreatePanel, createForm, fetchDashboard, instructorIdentity]);

  const calendarBadges = useMemo(() => {
    const badgeMap: Record<string, InlineCalendarDayBadge> = {};
    for (const cell of dashboard?.calendar ?? []) {
      const slotCount = showAllSchedules ? cell.allSlotCount : cell.mySlotCount;
      const groupCount = showAllSchedules ? cell.allGroupCount : cell.myGroupCount;
      if (slotCount <= 0 && groupCount <= 0) continue;

      badgeMap[cell.date] = {
        primary: slotCount > 0 ? `일정 ${slotCount}` : undefined,
        secondary: groupCount > 0 ? `팀 ${groupCount}` : undefined,
      };
    }
    return badgeMap;
  }, [dashboard?.calendar, showAllSchedules]);

  const activeInstructor = instructorIdentity.trim();

  const calendarSlotOwnerMap = useMemo(() => {
    const ownerMap: Record<string, string> = {};
    for (const cell of dashboard?.calendarPreviews ?? []) {
      for (const item of cell.items) {
        ownerMap[item.slotId] = item.instructorName;
      }
    }
    return ownerMap;
  }, [dashboard?.calendarPreviews]);

  const calendarItems = useMemo(() => {
    const itemMap: Record<string, InlineCalendarDayItem[]> = {};
    const previewCells = dashboard?.calendarPreviews ?? [];

    for (const cell of previewCells) {
      const scopedItems = showAllSchedules
        ? cell.items
        : cell.items.filter((item) => item.instructorName === activeInstructor);

      if (!scopedItems.length) continue;

      itemMap[cell.date] = scopedItems.map((item) => ({
        id: item.slotId,
        label:
          item.instructorName === activeInstructor
            ? `${item.timeLabel} / ${item.teamName || '팀 미정'}`
            : `${item.timeLabel} / 전체 일정`,
        selected:
          item.instructorName === activeInstructor && cell.date === selectedDate && item.slotId === selectedSlotId,
      }));
    }

    return itemMap;
  }, [activeInstructor, dashboard?.calendarPreviews, selectedDate, selectedSlotId, showAllSchedules]);

  const firstAvailableDate = dashboard?.firstAvailableDate ?? '';
  const todaySummary = useMemo(() => {
    const key = todayKey();
    const cell = (dashboard?.calendar ?? []).find((entry) => entry.date === key);
    const slotCount = showAllSchedules ? cell?.allSlotCount ?? 0 : cell?.mySlotCount ?? 0;
    const groupCount = showAllSchedules ? cell?.allGroupCount ?? 0 : cell?.myGroupCount ?? 0;

    return {
      date: key,
      slotCount,
      groupCount,
    };
  }, [dashboard?.calendar, showAllSchedules]);
  const todayScheduleCards = useMemo(() => {
    const todayDate = todayKey();
    const previewCells = dashboard?.calendarPreviews ?? [];
    const todayCell = previewCells.find((cell) => cell.date === todayDate);
    if (!todayCell) return [];

    const scopedItems = showAllSchedules
      ? todayCell.items
      : todayCell.items.filter((item) => item.instructorName === activeInstructor);

    return scopedItems.map((item) => ({
      id: item.slotId,
      time: item.timeLabel,
      title: item.instructorName === activeInstructor ? item.title || item.teamName || '일정' : '전체 일정',
    }));
  }, [activeInstructor, dashboard?.calendarPreviews, showAllSchedules]);

  useEffect(() => {
    if ((calendarItems[selectedDate]?.length ?? 0) > 0) return;

    const firstDateWithItems = Object.keys(calendarItems)
      .sort((a, b) => a.localeCompare(b))
      .find((date) => (calendarItems[date]?.length ?? 0) > 0);

    const fallbackDate = firstDateWithItems || firstAvailableDate || '';
    if (!fallbackDate || fallbackDate === selectedDate) return;

    setSelectedDate(fallbackDate);
    setSelectedSlotId('');
    setFloatingPosition(null);
    setFloatingAnchor(null);
    closeCreatePanel();
  }, [calendarItems, closeCreatePanel, firstAvailableDate, selectedDate]);
  const selectedScheduleSummary = useMemo(() => {
    if (!dashboard?.selectedSchedule) {
      return null;
    }

    const totalMembers = dashboard.selectedSchedule.groups.reduce((sum, group) => sum + group.memberCount, 0);
    const gradeSet = new Set<string>();
    for (const group of dashboard.selectedSchedule.groups) {
      for (const student of group.students) {
        if (student.childGrade) {
          gradeSet.add(student.childGrade);
        }
      }
    }

    return {
      totalMembers,
      gradeSummary: gradeSet.size ? Array.from(gradeSet).join(', ') : '-',
    };
  }, [dashboard?.selectedSchedule]);
  const selectedScheduleDetail = useMemo(() => {
    if (!dashboard?.selectedSchedule) {
      return null;
    }

    const schedule = dashboard.selectedSchedule;
    const groups = schedule.groups;
    const locations = Array.from(new Set(groups.map((group) => group.location).filter(Boolean)));
    const locationText = locations.length ? locations.join(', ') : '-';

    const teamNames = groups.map((group, index) => {
      const leaderFirstChildName = group.students[0]?.childName?.trim() || '';
      return leaderFirstChildName ? `${leaderFirstChildName} 팀` : `팀 ${index + 1}`;
    });

    const teamBlocks = groups.map((group, index) => {
      const teamName = teamNames[index] || `팀 ${index + 1}`;
      const uniqueGrades = Array.from(
        new Set(group.students.map((student) => student.childGrade?.trim() || '').filter(Boolean))
      );

      return [
        `${teamName} | ${group.memberCount}명`,
        uniqueGrades.length ? uniqueGrades.join(', ') : '-',
        group.location || '-',
      ].join('\n');
    });

    const studentLines = groups.flatMap((group) =>
      group.students.map((student) => {
        const grade = student.childGrade?.trim() || '-';
        const request = student.noteToInstructor?.trim() || '-';
        const historyDates = student.history.length
          ? student.history.slice(0, 5).map((history) => formatDateOnly(history.classStartAt))
          : ['없음'];
        const historyLines = historyDates.map((dateLabel) => `    - ${dateLabel}`);

        return [
          `• ${student.childName} / ${grade}`,
          `  학부모 연락처 ${student.parentPhone || '-'}`,
          `  요청사항 ${request}`,
          `  이전 교육 이력`,
          ...historyLines,
        ].join('\n');
      })
    );

    const studentSection = studentLines.length ? studentLines.join('\n\n') : '• 등록된 학생 정보가 없습니다.';

    const description = [
      `[일정 개요]`,
      ...teamBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', block])),
      '',
      `[팀원 상세정보]`,
      studentSection,
    ].join('\n');

    return {
      title: `${schedule.classTimeLabel} 일정`,
      locationText,
      description,
    };
  }, [dashboard?.selectedSchedule]);

  useEffect(() => {
    if (!floatingPosition) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (floatingPanelRef.current?.contains(target)) return;
      if (target.closest('[data-calendar-item="true"]')) return;
      setFloatingPosition(null);
      setFloatingAnchor(null);
    };

    document.addEventListener('mousedown', handleDocumentClick);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [floatingPosition]);

  useEffect(() => {
    if (!createPosition) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (createPanelRef.current?.contains(target)) return;
      closeCreatePanel();
    };

    document.addEventListener('mousedown', handleDocumentClick);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [closeCreatePanel, createPosition]);

  const calculateFloatingPosition = useCallback((anchor: FloatingAnchor, panelHeight: number): FloatingPosition => {
    const gutter = 12;
    const panelWidth = Math.min(500, window.innerWidth - 24);

    let left = anchor.right + gutter;
    if (left + panelWidth > window.innerWidth - gutter) {
      left = Math.max(gutter, anchor.left - panelWidth - gutter);
    }

    const normalizedHeight = Math.min(panelHeight, window.innerHeight - gutter * 2);
    const spaceBelow = window.innerHeight - anchor.bottom - gutter;
    const spaceAbove = anchor.top - gutter;

    let top: number;
    if (spaceBelow < Math.min(320, normalizedHeight) && spaceAbove > spaceBelow) {
      top = anchor.top - normalizedHeight - gutter;
    } else {
      top = anchor.top - 6;
    }

    const minTop = gutter;
    const maxTop = Math.max(gutter, window.innerHeight - normalizedHeight - gutter);
    top = Math.min(Math.max(minTop, top), maxTop);

    return { top, left };
  }, []);

  useEffect(() => {
    if (!floatingAnchor || !selectedScheduleDetail) return;

    const panelHeight = floatingPanelRef.current?.offsetHeight ?? Math.min(560, window.innerHeight - 24);
    const next = calculateFloatingPosition(floatingAnchor, panelHeight);
    setFloatingPosition((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [calculateFloatingPosition, floatingAnchor, selectedScheduleDetail]);

  useEffect(() => {
    if (!createAnchor || !createPosition) return;

    const panelHeight = createPanelRef.current?.offsetHeight ?? Math.min(560, window.innerHeight - 24);
    const next = calculateFloatingPosition(createAnchor, panelHeight);
    setCreatePosition((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [calculateFloatingPosition, createAnchor, createPosition]);

  const onDateSelect = useCallback(
    ({ date, anchorRect }: InlineCalendarDateSelectPayload) => {
      const nextAnchor: FloatingAnchor = {
        top: anchorRect.top,
        bottom: anchorRect.bottom,
        left: anchorRect.left,
        right: anchorRect.right,
      };

      const nextPosition = calculateFloatingPosition(nextAnchor, Math.min(560, window.innerHeight - 24));
      setCreateForm((prev) => ({
        ...prev,
        date,
      }));
      setCreateAnchor(nextAnchor);
      setCreatePosition(nextPosition);
      setFloatingPosition(null);
      setFloatingAnchor(null);
      setCreateError(null);
      setCreateMessage(null);
    },
    [calculateFloatingPosition]
  );

  const onLogout = useCallback(async () => {
    try {
      await fetch('/api/admin/instructor/auth', {
        method: 'DELETE',
      });
    } catch (_error) {
      // noop
    }

    setIsAuthenticated(false);
    setInstructorIdentity('');
    setDashboard(null);
    setLoading(false);
    setLoadingError(null);
    setSelectedSlotId('');
    setFloatingPosition(null);
    setFloatingAnchor(null);
    setCalendarNotice(null);
    setNoteMessage(null);
    setNoteError(null);
    setCreateError(null);
    setCreateMessage(null);
    closeCreatePanel();
    router.replace('/admin/login');
  }, [closeCreatePanel, router]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Instructor</p>
        <h1 className={`font-display ${styles.title}`}>강사 관리 페이지</h1>
        <p className={styles.description}>
          구글 캘린더처럼 날짜별 일정을 보고, 일정을 선택하면 해당 팀 학생 정보와 과거 이력을 자동으로 확인할 수 있습니다.
        </p>
        <Link href="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>

      <section className={styles.gridLayout}>
        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>캘린더</h2>

          {authChecking ? <p className={styles.infoText}>로그인 상태를 확인하고 있습니다...</p> : null}

          {!authChecking && !isAuthenticated ? (
            <p className={styles.infoText}>관리자 로그인 페이지로 이동 중입니다...</p>
          ) : null}

          {!authChecking && isAuthenticated ? (
            <>
              <div className={styles.authBar}>
                <p className={styles.authText}>
                  로그인 강사: <strong>{activeInstructor}</strong>
                </p>
                <button type="button" className={styles.ghostButton} onClick={onLogout}>
                  로그아웃
                </button>
              </div>

              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={showAllSchedules}
                  onChange={(event) => {
                    setShowAllSchedules(event.target.checked);
                    setSelectedSlotId('');
                    setFloatingPosition(null);
                    setFloatingAnchor(null);
                    setCalendarNotice(null);
                  }}
                />
                <span>와이미 전체 일정 함께 보기</span>
              </label>

              <div className={styles.scheduleBlock}>
                <div className={styles.todayScheduleHead}>
                  <p className={styles.summaryLabel}>오늘의 일정</p>
                  <p className={styles.summarySub}>
                    {todaySummary.slotCount}건 / 팀 {todaySummary.groupCount}개
                  </p>
                </div>
                {todayScheduleCards.length ? (
                  <div className={styles.todayScheduleGrid}>
                    {todayScheduleCards.map((card) => (
                      <article key={`today-card-${card.id}`} className={styles.todayScheduleCard}>
                        <p className={styles.todayScheduleTime}>{card.time}</p>
                        <p className={styles.todayScheduleTitle}>{card.title}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.infoText}>오늘 등록된 일정이 없습니다.</p>
                )}
              </div>

              <InlineCalendar
                value={selectedDate}
                onChange={(nextDate) => {
                  setSelectedDate(nextDate);
                  setSelectedSlotId('');
                  setFloatingPosition(null);
                  setFloatingAnchor(null);
                  setNoteMessage(null);
                  setNoteError(null);
                  setCreateError(null);
                  setCreateMessage(null);
                  closeCreatePanel();
                }}
                onDateSelect={onDateSelect}
                dayBadges={calendarBadges}
                dayItems={calendarItems}
                onDayItemSelect={({ date, itemId, anchorRect }) => {
                  const ownerInstructor = calendarSlotOwnerMap[itemId] || '';
                  const isMySlot = !ownerInstructor || ownerInstructor === activeInstructor;
                  if (!isMySlot) {
                    setSelectedDate(date);
                    setSelectedSlotId('');
                    setFloatingPosition(null);
                    setFloatingAnchor(null);
                    setNoteMessage(null);
                    setNoteError(null);
                    setCreateError(null);
                    setCreateMessage(null);
                    setCalendarNotice('타 강사 일정은 시간만 확인할 수 있습니다.');
                    closeCreatePanel();
                    return;
                  }

                  const nextAnchor: FloatingAnchor = {
                    top: anchorRect.top,
                    bottom: anchorRect.bottom,
                    left: anchorRect.left,
                    right: anchorRect.right,
                  };
                  const nextPosition = calculateFloatingPosition(nextAnchor, Math.min(560, window.innerHeight - 24));

                  setSelectedDate(date);
                  setSelectedSlotId(itemId);
                  setFloatingAnchor(nextAnchor);
                  setFloatingPosition(nextPosition);
                  setNoteMessage(null);
                  setNoteError(null);
                  setCreateError(null);
                  setCreateMessage(null);
                  setCalendarNotice(null);
                  closeCreatePanel();
                }}
              />

              {loading ? <p className={styles.infoText}>일정 데이터를 불러오는 중입니다...</p> : null}
              {loadingError ? <p className={styles.errorText}>{loadingError}</p> : null}
              {calendarNotice ? <p className={styles.infoText}>{calendarNotice}</p> : null}

              {createPosition ? (
                <aside
                  ref={createPanelRef}
                  className={styles.floatingDetail}
                  style={{
                    top: `${createPosition.top}px`,
                    left: `${createPosition.left}px`,
                  }}
                >
              <div className={styles.floatingHead}>
                <p className={styles.groupTitle}>일정 만들기</p>
                <button type="button" className={styles.floatingCloseButton} aria-label="닫기" onClick={closeCreatePanel}>
                  x
                </button>
              </div>

              {createError ? <p className={styles.errorText}>{createError}</p> : null}
              {createMessage ? <p className={styles.successText}>{createMessage}</p> : null}

              <label className={styles.field}>
                <span>제목</span>
                <input
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="제목 및 시간 추가"
                />
              </label>

              <div className={styles.summaryGrid}>
                <label className={styles.field}>
                  <span>날짜</span>
                  <input
                    type="date"
                    value={createForm.date}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>강사</span>
                  <input value={activeInstructor || '-'} readOnly />
                </label>
              </div>

              <div className={styles.summaryGrid}>
                <label className={styles.field}>
                  <span>시작</span>
                  <input
                    type="time"
                    value={createForm.startTime}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>종료</span>
                  <input
                    type="time"
                    value={createForm.endTime}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>위치</span>
                <input
                  value={createForm.location}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="위치 추가"
                />
              </label>

              <div className={styles.memoBlock}>
                <p className={styles.blockLabel}>설명</p>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="설명 또는 메모를 입력하세요."
                />
              </div>

              <div className={styles.summaryGrid}>
                <button type="button" className={styles.scheduleButton} onClick={closeCreatePanel}>
                  취소
                </button>
                <button type="button" className={styles.primaryButton} disabled={creatingSchedule} onClick={onCreateSchedule}>
                  {creatingSchedule ? '저장 중...' : '저장'}
                </button>
              </div>
                </aside>
              ) : null}

          {selectedScheduleDetail && floatingPosition ? (
            <aside
              ref={floatingPanelRef}
              className={styles.floatingDetail}
              style={{
                top: `${floatingPosition.top}px`,
                left: `${floatingPosition.left}px`,
              }}
            >
              <div className={styles.floatingHead}>
                <p className={styles.groupTitle}>{selectedScheduleDetail.title}</p>
                <button
                  type="button"
                  className={styles.floatingCloseButton}
                  aria-label="닫기"
                  onClick={() => {
                    setFloatingPosition(null);
                    setFloatingAnchor(null);
                  }}
                >
                  x
                </button>
              </div>
              <p className={styles.groupMeta}>위치: {selectedScheduleDetail.locationText}</p>
              <p className={styles.groupMeta}>담당 강사: {activeInstructor || '-'}</p>

              {selectedScheduleSummary ? (
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <p className={styles.summaryLabel}>교육 인원</p>
                    <p className={styles.summaryValue}>{selectedScheduleSummary.totalMembers}명</p>
                  </div>
                  <div className={styles.summaryCard}>
                    <p className={styles.summaryLabel}>참여 학년</p>
                    <p className={styles.summarySub}>{selectedScheduleSummary.gradeSummary}</p>
                  </div>
                </div>
              ) : null}

              <div className={styles.scheduleBlock}>
                <pre className={styles.descriptionBlock}>{selectedScheduleDetail.description}</pre>
              </div>

              <div className={styles.scheduleBlock}>
                <p className={styles.blockLabel}>팀별 교육 특이사항</p>
                {noteMessage ? <p className={styles.successText}>{noteMessage}</p> : null}
                {noteError ? <p className={styles.errorText}>{noteError}</p> : null}

                {dashboard?.selectedSchedule?.groups?.length ? (
                  <div className={styles.groupList}>
                    {dashboard.selectedSchedule.groups.map((group, index) => {
                      const leadChildName = group.students[0]?.childName?.trim() || '';
                      const teamName = leadChildName ? `${leadChildName} 팀` : `팀 ${index + 1}`;

                      return (
                        <article key={`floating-note-${group.groupId}`} className={styles.groupCard}>
                          <div className={styles.groupTop}>
                            <p className={styles.groupTitle}>{teamName}</p>
                            <p className={styles.groupMeta}>
                              대표 학부모: {group.leaderParentName || '-'} / {group.leaderParentPhone || '-'}
                            </p>
                            <p className={styles.groupMeta}>
                              학년: {group.gradeSummary} / 인원: {group.memberCount}명
                            </p>
                          </div>

                          <div className={styles.historyBlock}>
                            <p className={styles.blockLabel}>대표 학부모 누적 특이사항</p>
                            {group.leaderMemoHistory.length ? (
                              <ul className={styles.memoList}>
                                {group.leaderMemoHistory.map((memo) => (
                                  <li
                                    key={`${group.groupId}-${memo.groupId}-${memo.createdAtIso}-${memo.content}`}
                                    className={styles.memoItem}
                                  >
                                    <p className={styles.memoMeta}>
                                      {formatDateOnly(memo.classStartAt)} / {memo.instructorName}
                                    </p>
                                    <p className={styles.memoContent}>{memo.content}</p>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.infoText}>대표 학부모 기준으로 저장된 이전 특이사항이 없습니다.</p>
                            )}
                          </div>

                          <div className={styles.memoBlock}>
                            <p className={styles.blockLabel}>이번 교육 특이사항 입력</p>
                            <textarea
                              rows={3}
                              value={noteDrafts[group.groupId] ?? ''}
                              onChange={(event) =>
                                setNoteDrafts((prev) => ({
                                  ...prev,
                                  [group.groupId]: event.target.value,
                                }))
                              }
                              placeholder="입력한 내용은 대표 학부모 기준으로 다음 교육에서도 확인할 수 있습니다."
                            />
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={savingGroupId === group.groupId || !(noteDrafts[group.groupId] || '').trim()}
                              onClick={() => onSaveGroupNote(group.groupId)}
                            >
                              {savingGroupId === group.groupId ? '저장 중...' : '특이사항 저장'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.infoText}>선택된 일정에 팀 정보가 없습니다.</p>
                )}
              </div>
            </aside>
          ) : null}
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
