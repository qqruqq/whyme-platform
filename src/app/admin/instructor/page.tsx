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

type DayScheduleRow = {
  slotId: string;
  classTimeLabel: string;
  groupCount: number;
  instructorName?: string;
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
    if (!selectedGroupId) return;
    const exists = groups.some((group) => group.groupId === selectedGroupId);
    if (!exists) {
      setSelectedGroupId('');
    }
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

  const daySchedulesToRender = useMemo(() => {
    if (!dashboard) return [] as DayScheduleRow[];

    if (dashboard.daySchedules.length) {
      return dashboard.daySchedules.map<DayScheduleRow>((schedule) => ({
        slotId: schedule.slotId,
        classTimeLabel: schedule.classTimeLabel,
        groupCount: schedule.groupCount,
      }));
    }

    return dashboard.allSchedules.map<DayScheduleRow>((schedule) => ({
      slotId: schedule.slotId,
      classTimeLabel: schedule.classTimeLabel,
      groupCount: schedule.groupCount,
      instructorName: schedule.instructorName,
    }));
  }, [dashboard]);

  const usingFallbackScheduleList = Boolean(dashboard && !dashboard.daySchedules.length && dashboard.allSchedules.length);
  const activeDashboardSlotId = dashboard?.selectedSlotId ?? '';

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
            }}
            dayBadges={calendarBadges}
            dayItems={calendarItems}
            onDayItemSelect={({ date, itemId }) => {
              setSelectedDate(date);
              setSelectedSlotId(itemId);
              setSelectedGroupId('');
            }}
          />

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

        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>해당 날짜 일정</h2>
          <p className={styles.infoText}>{selectedDate}</p>

          {loading ? <p className={styles.infoText}>불러오는 중...</p> : null}
          {loadingError ? <p className={styles.errorText}>{loadingError}</p> : null}

          {!loading && !loadingError ? (
            <>
              <div className={styles.scheduleBlock}>
                <p className={styles.blockLabel}>내 일정 목록</p>
                {usingFallbackScheduleList ? (
                  <p className={styles.infoText}>선택 강사 일정이 없어 해당 날짜 전체 일정을 표시합니다.</p>
                ) : null}
                {daySchedulesToRender.length ? (
                  <div className={styles.scheduleList}>
                    {daySchedulesToRender.map((schedule) => (
                      <button
                        key={schedule.slotId}
                        type="button"
                        className={
                          schedule.slotId === activeDashboardSlotId
                            ? `${styles.scheduleButton} ${styles.scheduleButtonActive}`
                            : styles.scheduleButton
                        }
                        onClick={() => {
                          setSelectedSlotId(schedule.slotId);
                          setSelectedGroupId('');
                        }}
                      >
                        <span className={styles.scheduleTitle}>{schedule.classTimeLabel}</span>
                        {schedule.instructorName ? (
                          <span className={styles.scheduleMeta}>강사: {schedule.instructorName}</span>
                        ) : null}
                        <span className={styles.scheduleMeta}>팀 {schedule.groupCount}개</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.infoText}>선택 날짜에 등록된 내 일정이 없습니다.</p>
                )}
              </div>

              <div className={styles.scheduleBlock}>
                <p className={styles.blockLabel}>전체 일정 요약</p>
                {dashboard?.allSchedules.length ? (
                  <ul className={styles.allScheduleList}>
                    {dashboard.allSchedules.map((schedule) => (
                      <li key={`${schedule.slotId}-all`} className={styles.allScheduleItem}>
                        {schedule.classTimeLabel} / {schedule.instructorName} / 팀 {schedule.groupCount}개
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.infoText}>선택 날짜에 등록된 전체 일정이 없습니다.</p>
                )}
              </div>
            </>
          ) : null}
        </article>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>선택 일정 팀 정보</h2>
        {noteMessage ? <p className={styles.successText}>{noteMessage}</p> : null}
        {noteError ? <p className={styles.errorText}>{noteError}</p> : null}

        {dashboard?.selectedSchedule ? (
          <div className={styles.groupList}>
            <article className={styles.scheduleHeaderCard}>
              <p className={styles.groupTitle}>{dashboard.selectedSchedule.classTimeLabel}</p>
              <p className={styles.groupMeta}>참여 팀 수: {dashboard.selectedSchedule.groupCount}개</p>
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
              <div className={styles.teamSelectList}>
                {dashboard.selectedSchedule.groups.map((group, index) => (
                  <button
                    key={`team-select-${group.groupId}`}
                    type="button"
                    className={
                      group.groupId === selectedGroupId
                        ? `${styles.teamSelectButton} ${styles.teamSelectButtonActive}`
                        : styles.teamSelectButton
                    }
                    onClick={() => setSelectedGroupId(group.groupId)}
                  >
                    <span className={styles.teamSelectTitle}>팀 {index + 1}</span>
                    <span className={styles.teamSelectMeta}>
                      {group.gradeSummary} / {group.memberCount}명
                    </span>
                  </button>
                ))}
              </div>
            </article>

            {selectedGroup ? (
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
            ) : (
              <p className={styles.infoText}>일정에 포함된 팀을 선택하면 상세 정보가 표시됩니다.</p>
            )}
          </div>
        ) : selectedSlotId ? (
          <p className={styles.infoText}>선택한 일정 정보를 찾을 수 없습니다. 일정을 다시 선택해 주세요.</p>
        ) : null}
      </section>
    </main>
  );
}
