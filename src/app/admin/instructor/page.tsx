'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InlineCalendar, { type InlineCalendarDayBadge, type InlineCalendarDayItem } from '@/components/InlineCalendar';
import styles from './page.module.css';

type InstructorMemo = {
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function yesNoLabel(value: boolean | null): string {
  if (value === true) return '있음';
  if (value === false) return '없음';
  return '미입력';
}

function setInstructorCookie(value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `wm_instructor_name=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export default function InstructorAdminPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [instructorIdentity, setInstructorIdentity] = useState('');

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const latestFetchIdRef = useRef(0);
  const floatingPanelRef = useRef<HTMLDivElement | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition | null>(null);
  const [floatingAnchor, setFloatingAnchor] = useState<FloatingAnchor | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('wm_instructor_name') || '';
    if (stored) {
      setInstructorIdentity(stored);
      setInstructorCookie(stored);
    }
  }, []);

  const monthKey = useMemo(() => selectedDate.slice(0, 7), [selectedDate]);

  const fetchDashboard = useCallback(async () => {
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
      if (instructorIdentity.trim()) {
        params.set('instructor', instructorIdentity.trim());
      }

      const response = await fetch(`/api/admin/instructor/dashboard?${params.toString()}`);

      const payload: unknown = await response.json().catch(() => null);
      if (fetchId !== latestFetchIdRef.current) {
        return;
      }

      if (!response.ok) {
        setLoadingError(parseError(payload));
        return;
      }

      const data = payload as DashboardResponse;
      setDashboard(data);

      if (!instructorIdentity && data.selectedInstructor) {
        setInstructorIdentity(data.selectedInstructor);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('wm_instructor_name', data.selectedInstructor);
        }
        setInstructorCookie(data.selectedInstructor);
      }
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
  }, [instructorIdentity, monthKey, selectedDate, selectedSlotId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const groups = dashboard?.selectedSchedule?.groups ?? [];
    if (!groups.length) {
      if (selectedGroupId) {
        setSelectedGroupId('');
      }
      return;
    }

    if (selectedGroupId && groups.some((group) => group.groupId === selectedGroupId)) {
      return;
    }

    setSelectedGroupId(groups[0]?.groupId ?? '');
  }, [dashboard?.selectedSchedule?.groups, selectedGroupId]);

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
            instructorName: instructorIdentity || dashboard?.selectedInstructor || '담당강사',
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
    [dashboard?.selectedInstructor, fetchDashboard, instructorIdentity, noteDrafts]
  );

  const calendarBadges = useMemo(() => {
    const badgeMap: Record<string, InlineCalendarDayBadge> = {};
    for (const cell of dashboard?.calendar ?? []) {
      const hasMy = cell.mySlotCount > 0;
      const hasAll = cell.allSlotCount > 0;
      if (!hasMy && !hasAll) continue;

      badgeMap[cell.date] = {
        primary: hasMy ? `내 ${cell.mySlotCount}` : undefined,
        secondary: hasAll ? `전체 ${cell.allSlotCount}` : undefined,
      };
    }
    return badgeMap;
  }, [dashboard?.calendar]);

  const activeInstructor = (instructorIdentity.trim() || dashboard?.selectedInstructor || '').trim();

  const calendarItems = useMemo(() => {
    const itemMap: Record<string, InlineCalendarDayItem[]> = {};
    const previewCells = dashboard?.calendarPreviews ?? [];
    const hasAnyForActiveInstructor = activeInstructor
      ? previewCells.some((cell) => cell.items.some((item) => item.instructorName === activeInstructor))
      : false;

    for (const cell of previewCells) {
      const scopedItems =
        hasAnyForActiveInstructor && activeInstructor
          ? cell.items.filter((item) => item.instructorName === activeInstructor)
          : cell.items;

      if (!scopedItems.length) continue;

      itemMap[cell.date] = scopedItems.map((item) => ({
        id: item.slotId,
        label: `${item.timeLabel} / 팀 ${item.groupCount}`,
        selected: cell.date === selectedDate && item.slotId === selectedSlotId,
      }));
    }

    return itemMap;
  }, [activeInstructor, dashboard?.calendarPreviews, selectedDate, selectedSlotId]);

  const firstAvailableDate = dashboard?.firstAvailableDate ?? '';

  useEffect(() => {
    if ((calendarItems[selectedDate]?.length ?? 0) > 0) return;

    const firstDateWithItems = Object.keys(calendarItems)
      .sort((a, b) => a.localeCompare(b))
      .find((date) => (calendarItems[date]?.length ?? 0) > 0);

    const fallbackDate = firstDateWithItems || firstAvailableDate || '';
    if (!fallbackDate || fallbackDate === selectedDate) return;

    setSelectedDate(fallbackDate);
    setSelectedSlotId('');
    setSelectedGroupId('');
    setFloatingPosition(null);
    setFloatingAnchor(null);
  }, [calendarItems, firstAvailableDate, selectedDate]);

  const selectedGroup =
    dashboard?.selectedSchedule?.groups.find((group) => group.groupId === selectedGroupId) ?? null;
  const instructorOptions = useMemo(() => {
    const source = dashboard?.instructors ?? [];
    const set = new Set(
      source
        .map((name) => name.trim())
        .filter((name) => Boolean(name))
    );

    const normalizedIdentity = instructorIdentity.trim();
    if (normalizedIdentity) {
      set.add(normalizedIdentity);
    }

    if (!set.size) {
      set.add('이시훈 대표강사');
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dashboard?.instructors, instructorIdentity]);

  useEffect(() => {
    if (!instructorOptions.length) return;

    const normalizedIdentity = instructorIdentity.trim();
    const identityExists = normalizedIdentity ? instructorOptions.includes(normalizedIdentity) : false;
    if (identityExists) return;

    const fallback =
      dashboard?.selectedInstructor && instructorOptions.includes(dashboard.selectedInstructor)
        ? dashboard.selectedInstructor
        : instructorOptions[0];

    if (!fallback || fallback === instructorIdentity) return;

    setInstructorIdentity(fallback);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('wm_instructor_name', fallback);
    }
    setInstructorCookie(fallback);
  }, [dashboard?.selectedInstructor, instructorIdentity, instructorOptions]);
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

          <label className={styles.field}>
            <span>로그인 강사</span>
            <select
              value={instructorIdentity}
              onChange={(event) => {
                const next = event.target.value;
                setInstructorIdentity(next);
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('wm_instructor_name', next);
                }
                setInstructorCookie(next);
                setSelectedSlotId('');
                setSelectedGroupId('');
                setFloatingPosition(null);
                setFloatingAnchor(null);
              }}
            >
              {instructorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <InlineCalendar
            value={selectedDate}
            onChange={(nextDate) => {
              setSelectedDate(nextDate);
              setSelectedSlotId('');
              setSelectedGroupId('');
              setFloatingPosition(null);
              setFloatingAnchor(null);
            }}
            dayBadges={calendarBadges}
            dayItems={calendarItems}
            onDayItemSelect={({ date, itemId, anchorRect }) => {
              const nextAnchor: FloatingAnchor = {
                top: anchorRect.top,
                bottom: anchorRect.bottom,
                left: anchorRect.left,
                right: anchorRect.right,
              };
              const nextPosition = calculateFloatingPosition(nextAnchor, Math.min(560, window.innerHeight - 24));

              setSelectedDate(date);
              setSelectedSlotId(itemId);
              setSelectedGroupId('');
              setFloatingAnchor(nextAnchor);
              setFloatingPosition(nextPosition);
            }}
          />

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
            </aside>
          ) : null}

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>내 일정</p>
              <p className={styles.summaryValue}>{dashboard?.selectedDateSummary.mySlotCount ?? 0}건</p>
              <p className={styles.summarySub}>팀 {dashboard?.selectedDateSummary.myGroupCount ?? 0}개</p>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>전체 일정</p>
              <p className={styles.summaryValue}>{dashboard?.selectedDateSummary.allSlotCount ?? 0}건</p>
              <p className={styles.summarySub}>팀 {dashboard?.selectedDateSummary.allGroupCount ?? 0}개</p>
            </div>
          </div>
        </article>

      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>선택 일정 팀 정보</h2>
        {noteMessage ? <p className={styles.successText}>{noteMessage}</p> : null}
        {noteError ? <p className={styles.errorText}>{noteError}</p> : null}

        {selectedGroup ? (
          <div className={styles.groupList}>
            <article key={selectedGroup.groupId} className={styles.groupCard}>
              <div className={styles.groupTop}>
                <p className={styles.groupTitle}>팀 {selectedGroup.groupId.slice(0, 8)}</p>
                <p className={styles.groupMeta}>장소: {selectedGroup.location || '-'}</p>
                <p className={styles.groupMeta}>
                  학년: {selectedGroup.gradeSummary} / 인원: {selectedGroup.memberCount}명
                </p>
              </div>

              <div className={styles.studentList}>
                {selectedGroup.students.map((student) => (
                  <article key={student.groupMemberId} className={styles.studentCard}>
                    <p className={styles.studentName}>
                      {student.childName}
                      {student.childGrade ? ` (${student.childGrade})` : ''}
                    </p>
                    <p className={styles.studentMeta}>학부모 연락처: {student.parentPhone || '-'}</p>
                    <p className={styles.studentMeta}>
                      이전 교육경험: 학생 {yesNoLabel(student.priorStudentAttended)} / 형제·자매{' '}
                      {yesNoLabel(student.siblingsPriorAttended)} / 부모 {yesNoLabel(student.parentPriorAttended)}
                    </p>
                    <p className={styles.studentMeta}>교육요청사항: {student.noteToInstructor || '-'}</p>

                    <div className={styles.historyBlock}>
                      <p className={styles.blockLabel}>자동 조회 과거 이력</p>
                      {student.history.length ? (
                        <ul className={styles.historyList}>
                          {student.history.map((history) => (
                            <li
                              key={`${student.groupMemberId}-${history.groupId}-${history.classStartAt}`}
                              className={styles.historyItem}
                            >
                              <p className={styles.historyMeta}>
                                {formatDateTime(history.classStartAt)} / 강사: {history.instructorName} / 장소:{' '}
                                {history.location || '-'}
                              </p>
                              <p className={styles.historyMeta}>당시 요청사항: {history.parentRequestNote || '-'}</p>
                              <p className={styles.historyMeta}>
                                당시 교육경험: 학생 {yesNoLabel(history.priorStudentAttended)} / 형제·자매{' '}
                                {yesNoLabel(history.siblingsPriorAttended)} / 부모 {yesNoLabel(history.parentPriorAttended)}
                              </p>
                              {history.instructorMemos.length ? (
                                <ul className={styles.memoList}>
                                  {history.instructorMemos.map((memo) => (
                                    <li
                                      key={`${history.groupId}-${memo.createdAtIso}-${memo.content}`}
                                      className={styles.memoItem}
                                    >
                                      <p className={styles.memoMeta}>
                                        {formatDateTime(memo.createdAtIso)} / {memo.instructorName}
                                      </p>
                                      <p className={styles.memoContent}>{memo.content}</p>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.infoText}>조회된 과거 이력이 없습니다.</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.memoBlock}>
                <p className={styles.blockLabel}>교육 후 특이사항</p>
                <textarea
                  rows={3}
                  value={noteDrafts[selectedGroup.groupId] ?? ''}
                  onChange={(event) =>
                    setNoteDrafts((prev) => ({
                      ...prev,
                      [selectedGroup.groupId]: event.target.value,
                    }))
                  }
                  placeholder="해당 팀 교육 후 참고할 특이사항을 기록해 주세요."
                />
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    savingGroupId === selectedGroup.groupId || !(noteDrafts[selectedGroup.groupId] || '').trim()
                  }
                  onClick={() => onSaveGroupNote(selectedGroup.groupId)}
                >
                  {savingGroupId === selectedGroup.groupId ? '저장 중...' : '특이사항 저장'}
                </button>
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </main>
  );
}
