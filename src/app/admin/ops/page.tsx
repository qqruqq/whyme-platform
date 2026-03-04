'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import InlineCalendar from '@/components/InlineCalendar';
import styles from './page.module.css';

type InstructorMemo = {
  createdAtIso: string;
  instructorName: string;
  content: string;
};

type OpsMemo = {
  createdAtIso: string;
  actorName: string;
  content: string;
};

type GroupMemberRow = {
  groupMemberId: string;
  childId: string;
  childName: string;
  childGrade: string | null;
  parentName: string | null;
  parentPhone: string | null;
  noteToInstructor: string | null;
  status: string;
};

type GroupRow = {
  groupId: string;
  slotId: string;
  classStartAt: string;
  classEndAt: string;
  instructorName: string;
  status: 'pending_info' | 'pending_payment' | 'confirmed' | 'cancelled';
  rosterStatus: 'draft' | 'collecting' | 'locked' | 'completed';
  location: string | null;
  headcountDeclared: number | null;
  headcountFinal: number | null;
  memberCount: number;
  completedCount: number;
  pendingCount: number;
  leaderParent: {
    parentId: string;
    name: string | null;
    phone: string;
  };
  leaderManageUrl: string | null;
  instructorMemos: InstructorMemo[];
  opsMemos: OpsMemo[];
  members: GroupMemberRow[];
};

type OpsDashboardResponse = {
  success: boolean;
  selectedDate: string;
  instructors: string[];
  summary: {
    totalGroups: number;
    totalMembers: number;
    status: Record<string, number>;
  };
  rows: GroupRow[];
};

type AuthCheckResponse = {
  success: boolean;
  authenticated: boolean;
  instructorName?: string;
  role?: 'super_admin' | 'admin' | 'instructor';
  dashboardPath?: string;
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

type GroupDraft = {
  status: GroupRow['status'];
  rosterStatus: GroupRow['rosterStatus'];
  instructorName: string;
  classDate: string;
  classTime: string;
  location: string;
  headcountDeclared: string;
  opsMemo: string;
};

const STATUS_OPTIONS: GroupRow['status'][] = ['pending_info', 'pending_payment', 'confirmed', 'cancelled'];
const ROSTER_OPTIONS: GroupRow['rosterStatus'][] = ['draft', 'collecting', 'locked', 'completed'];

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toLocalDateInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toLocalTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

export default function OpsAdminPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [actorName, setActorName] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [data, setData] = useState<OpsDashboardResponse | null>(null);

  const [instructorFilter, setInstructorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GroupRow['status']>('all');
  const [rosterFilter, setRosterFilter] = useState<'all' | GroupRow['rosterStatus']>('all');

  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>({});
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      setAuthChecking(true);
      try {
        const response = await fetch('/api/admin/instructor/auth', {
          cache: 'no-store',
        });
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled || !response.ok) return;

        const data = payload as AuthCheckResponse;
        const role = data.role;
        if (data.authenticated && (role === 'admin' || role === 'super_admin')) {
          setIsAuthenticated(true);
          setActorName(data.instructorName?.trim() || '실무자');
          return;
        }

        setIsAuthenticated(false);
        setActorName('');
        if (data.authenticated && data.dashboardPath) {
          router.replace(data.dashboardPath);
          return;
        }
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

  const fetchDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setData(null);
      setLoading(false);
      setLoadingError(null);
      return;
    }

    setLoading(true);
    setLoadingError(null);

    try {
      const response = await fetch(`/api/admin/ops/dashboard?date=${selectedDate}`);
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setIsAuthenticated(false);
          setActorName('');
          router.replace('/admin/login');
          return;
        }
        setLoadingError(parseError(payload));
        return;
      }

      const nextData = payload as OpsDashboardResponse;
      setData(nextData);

      setDrafts((prev) => {
        const nextDrafts: Record<string, GroupDraft> = {};
        for (const row of nextData.rows) {
          nextDrafts[row.groupId] = prev[row.groupId] ?? {
            status: row.status,
            rosterStatus: row.rosterStatus,
            instructorName: row.instructorName,
            classDate: toLocalDateInput(row.classStartAt),
            classTime: toLocalTimeInput(row.classStartAt),
            location: row.location || '',
            headcountDeclared: String(row.headcountDeclared ?? row.memberCount),
            opsMemo: '',
          };
        }
        return nextDrafts;
      });
    } catch (_error) {
      setLoadingError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, router, selectedDate]);

  useEffect(() => {
    if (!authChecking && isAuthenticated) {
      fetchDashboard();
    }
  }, [authChecking, fetchDashboard, isAuthenticated]);

  const filteredRows = useMemo(() => {
    if (!data) return [];

    return data.rows.filter((row) => {
      if (instructorFilter && row.instructorName !== instructorFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (rosterFilter !== 'all' && row.rosterStatus !== rosterFilter) return false;
      return true;
    });
  }, [data, instructorFilter, rosterFilter, statusFilter]);

  const onSaveGroup = useCallback(
    async (groupId: string) => {
      const draft = drafts[groupId];
      if (!draft) return;

      setSavingGroupId(groupId);
      setActionMessage(null);
      setActionError(null);

      try {
        const parsedHeadcount = Number(draft.headcountDeclared);
        const response = await fetch('/api/admin/ops/group', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId,
            status: draft.status,
            rosterStatus: draft.rosterStatus,
            instructorName: draft.instructorName,
            classDate: draft.classDate,
            classTime: draft.classTime,
            location: draft.location,
            headcountDeclared: Number.isFinite(parsedHeadcount) ? parsedHeadcount : undefined,
            opsMemo: draft.opsMemo,
            actorName: actorName || '실무자',
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(parseError(payload));
          return;
        }

        setActionMessage('변경사항을 저장했습니다.');
        setDrafts((prev) => ({
          ...prev,
          [groupId]: {
            ...prev[groupId],
            opsMemo: '',
          },
        }));
        await fetchDashboard();
      } catch (_error) {
        setActionError('저장 중 오류가 발생했습니다.');
      } finally {
        setSavingGroupId(null);
      }
    },
    [actorName, drafts, fetchDashboard]
  );

  const onRemoveMember = useCallback(
    async (groupMemberId: string, childName: string) => {
      const confirmed = window.confirm(`${childName || '해당 학생'}을(를) 삭제할까요?`);
      if (!confirmed) return;

      setRemovingMemberId(groupMemberId);
      setActionMessage(null);
      setActionError(null);

      try {
        const response = await fetch('/api/admin/ops/member/remove', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ groupMemberId }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(parseError(payload));
          return;
        }

        setActionMessage('학생 정보를 삭제했습니다.');
        await fetchDashboard();
      } catch (_error) {
        setActionError('삭제 중 오류가 발생했습니다.');
      } finally {
        setRemovingMemberId(null);
      }
    },
    [fetchDashboard]
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
    setActorName('');
    setData(null);
    setLoading(false);
    setLoadingError(null);
    router.replace('/admin/login');
  }, [router]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Operations</p>
        <h1 className={`font-display ${styles.title}`}>실무자 운영 페이지</h1>
        <p className={styles.description}>예약 현황을 확인하고, 일정/상태/강사 배정을 실무 기준으로 조정합니다.</p>
        <Link href="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>

      {authChecking ? <p className={styles.infoText}>로그인 상태를 확인하고 있습니다...</p> : null}
      {!authChecking && !isAuthenticated ? <p className={styles.infoText}>관리자 로그인 페이지로 이동 중입니다...</p> : null}
      {!authChecking && isAuthenticated ? (
        <section className={styles.authBar}>
          <p className={styles.authText}>
            로그인 관리자: <strong>{actorName || '실무자'}</strong>
          </p>
          <div className={styles.authActions}>
            <Link href="/admin/content" className={styles.ghostButton}>
              콘텐츠 관리
            </Link>
            <Link href="/admin/profile" className={styles.ghostButton}>
              내 정보
            </Link>
            <button type="button" className={styles.ghostButton} onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.gridLayout}>
        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>조회 날짜</h2>
          <InlineCalendar value={selectedDate} onChange={setSelectedDate} />
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>전체 팀</p>
              <p className={styles.summaryValue}>{data?.summary.totalGroups ?? 0}</p>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>전체 학생</p>
              <p className={styles.summaryValue}>{data?.summary.totalMembers ?? 0}</p>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>필터</h2>
          <label className={styles.field}>
            <span>강사</span>
            <select value={instructorFilter} onChange={(event) => setInstructorFilter(event.target.value)}>
              <option value="">전체</option>
              {data?.instructors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>그룹 상태</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">전체</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>명단 상태</span>
            <select value={rosterFilter} onChange={(event) => setRosterFilter(event.target.value as typeof rosterFilter)}>
              <option value="all">전체</option>
              {ROSTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.infoText}>표시 팀 수: {filteredRows.length}</p>
        </article>
      </section>

      {loading ? <p className={styles.infoText}>불러오는 중...</p> : null}
      {loadingError ? <p className={styles.errorText}>{loadingError}</p> : null}
      {actionMessage ? <p className={styles.successText}>{actionMessage}</p> : null}
      {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

      <section className={styles.listSection}>
        {filteredRows.map((row) => {
          const draft = drafts[row.groupId];
          if (!draft) return null;

          return (
            <article key={row.groupId} className={styles.groupCard}>
              <div className={styles.groupTop}>
                <p className={styles.groupTitle}>{formatDateTime(row.classStartAt)}</p>
                <p className={styles.groupMeta}>
                  강사: {row.instructorName} / 장소: {row.location || '-'} / 인원: {row.memberCount}명
                </p>
                <p className={styles.groupMeta}>
                  대표 학부모: {row.leaderParent.name || '-'} / {row.leaderParent.phone}
                </p>
              </div>

              <div className={styles.editGrid}>
                <label className={styles.field}>
                  <span>그룹 상태</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.groupId]: {
                          ...prev[row.groupId],
                          status: event.target.value as GroupRow['status'],
                        },
                      }))
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>명단 상태</span>
                  <select
                    value={draft.rosterStatus}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.groupId]: {
                          ...prev[row.groupId],
                          rosterStatus: event.target.value as GroupRow['rosterStatus'],
                        },
                      }))
                    }
                  >
                    {ROSTER_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>강사명</span>
                  <input
                    value={draft.instructorName}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.groupId]: {
                          ...prev[row.groupId],
                          instructorName: event.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>수업 날짜 (YYYY-MM-DD)</span>
                  <input
                    value={draft.classDate}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.groupId]: {
                          ...prev[row.groupId],
                          classDate: event.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>수업 시간 (HH:MM)</span>
                  <input
                    value={draft.classTime}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.groupId]: {
                          ...prev[row.groupId],
                          classTime: event.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>등록 인원</span>
                  <input
                    inputMode="numeric"
                    value={draft.headcountDeclared}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.groupId]: {
                          ...prev[row.groupId],
                          headcountDeclared: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>교육 장소</span>
                <input
                  value={draft.location}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.groupId]: {
                        ...prev[row.groupId],
                        location: event.target.value,
                      },
                    }))
                  }
                />
              </label>

              <label className={styles.field}>
                <span>운영 메모</span>
                <textarea
                  rows={3}
                  value={draft.opsMemo}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.groupId]: {
                        ...prev[row.groupId],
                        opsMemo: event.target.value,
                      },
                    }))
                  }
                  placeholder="실무 참고 메모를 입력해 주세요."
                />
              </label>

              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={savingGroupId === row.groupId}
                  onClick={() => onSaveGroup(row.groupId)}
                >
                  {savingGroupId === row.groupId ? '저장 중...' : '변경 저장'}
                </button>
                {row.leaderManageUrl ? (
                  <a className={styles.secondaryButton} href={row.leaderManageUrl}>
                    대표 관리 페이지 열기
                  </a>
                ) : null}
              </div>

              <div className={styles.memberList}>
                {row.members.map((member) => (
                  <div key={member.groupMemberId} className={styles.memberCard}>
                    <p className={styles.memberName}>
                      {member.childName}
                      {member.childGrade ? ` (${member.childGrade})` : ''}
                    </p>
                    <p className={styles.memberMeta}>
                      보호자: {member.parentName || '-'} / {member.parentPhone || '-'}
                    </p>
                    <p className={styles.memberMeta}>요청사항: {member.noteToInstructor || '-'}</p>
                    <button
                      type="button"
                      className={styles.removeButton}
                      disabled={removingMemberId === member.groupMemberId}
                      onClick={() => onRemoveMember(member.groupMemberId, member.childName)}
                    >
                      {removingMemberId === member.groupMemberId ? '삭제 중...' : '학생 삭제'}
                    </button>
                  </div>
                ))}
              </div>

              {row.instructorMemos.length ? (
                <div className={styles.memoBlock}>
                  <p className={styles.blockLabel}>강사 메모</p>
                  <ul className={styles.memoList}>
                    {row.instructorMemos.map((memo) => (
                      <li key={`${memo.createdAtIso}-${memo.content}`} className={styles.memoItem}>
                        <p className={styles.memoMeta}>
                          {formatDateTime(memo.createdAtIso)} / {memo.instructorName}
                        </p>
                        <p className={styles.memoContent}>{memo.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {row.opsMemos.length ? (
                <div className={styles.memoBlock}>
                  <p className={styles.blockLabel}>운영 메모</p>
                  <ul className={styles.memoList}>
                    {row.opsMemos.map((memo) => (
                      <li key={`${memo.createdAtIso}-${memo.content}`} className={styles.memoItem}>
                        <p className={styles.memoMeta}>
                          {formatDateTime(memo.createdAtIso)} / {memo.actorName}
                        </p>
                        <p className={styles.memoContent}>{memo.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}

        {!loading && !loadingError && filteredRows.length === 0 ? (
          <p className={styles.infoText}>선택 조건에 맞는 팀이 없습니다.</p>
        ) : null}
      </section>
    </main>
  );
}
