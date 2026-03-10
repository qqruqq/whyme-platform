'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

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

type InstructorRow = {
  instructorId: string;
  name: string;
  role: string;
  summary: string | null;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProgramRow = {
  programId: string;
  title: string;
  description: string;
  highlights: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InstructorDraft = {
  name: string;
  role: string;
  summary: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

type ProgramDraft = {
  title: string;
  description: string;
  highlights: string;
  color: string;
  sortOrder: string;
  isActive: boolean;
};

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

function toSortOrder(value: string, fallback = 100): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(9999, Math.max(0, parsed));
}

function toInstructorDraft(row: InstructorRow): InstructorDraft {
  return {
    name: row.name,
    role: row.role,
    summary: row.summary || '',
    description: row.description,
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
  };
}

function toProgramDraft(row: ProgramRow): ProgramDraft {
  return {
    title: row.title,
    description: row.description,
    highlights: row.highlights,
    color: row.color,
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
  };
}

export default function AdminContentPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [actorName, setActorName] = useState('');
  const [dashboardPath, setDashboardPath] = useState('/admin/ops');

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);

  const [instructorDrafts, setInstructorDrafts] = useState<Record<string, InstructorDraft>>({});
  const [programDrafts, setProgramDrafts] = useState<Record<string, ProgramDraft>>({});

  const [savingInstructorId, setSavingInstructorId] = useState<string | null>(null);
  const [savingProgramId, setSavingProgramId] = useState<string | null>(null);
  const [creatingInstructor, setCreatingInstructor] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newInstructor, setNewInstructor] = useState<InstructorDraft>({
    name: '',
    role: '',
    summary: '',
    description: '',
    sortOrder: '100',
    isActive: true,
  });

  const [newProgram, setNewProgram] = useState<ProgramDraft>({
    title: '',
    description: '',
    highlights: '',
    color: 'var(--program-small-group-boys)',
    sortOrder: '100',
    isActive: true,
  });

  const loadContent = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setLoadError(null);

    try {
      const [instructorResponse, programResponse] = await Promise.all([
        fetch('/api/admin/content/instructors', { cache: 'no-store' }),
        fetch('/api/admin/content/programs', { cache: 'no-store' }),
      ]);

      const [instructorPayload, programPayload] = await Promise.all([
        instructorResponse.json().catch(() => null),
        programResponse.json().catch(() => null),
      ]);

      if (!instructorResponse.ok) {
        setLoadError(parseError(instructorPayload));
        return;
      }
      if (!programResponse.ok) {
        setLoadError(parseError(programPayload));
        return;
      }

      const nextInstructors = ((instructorPayload as { rows?: InstructorRow[] })?.rows || []).slice();
      const nextPrograms = ((programPayload as { rows?: ProgramRow[] })?.rows || []).slice();

      setInstructors(nextInstructors);
      setPrograms(nextPrograms);

      setInstructorDrafts(
        nextInstructors.reduce<Record<string, InstructorDraft>>((acc, row) => {
          acc[row.instructorId] = toInstructorDraft(row);
          return acc;
        }, {})
      );

      setProgramDrafts(
        nextPrograms.reduce<Record<string, ProgramDraft>>((acc, row) => {
          acc[row.programId] = toProgramDraft(row);
          return acc;
        }, {})
      );
    } catch (_error) {
      setLoadError('콘텐츠 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      setCheckingAuth(true);
      try {
        const response = await fetch('/api/admin/instructor/auth', { cache: 'no-store' });
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok) {
          router.replace('/admin/login');
          return;
        }

        const data = payload as AuthCheckResponse;
        if (!data.authenticated) {
          router.replace('/admin/login');
          return;
        }

        if (data.role !== 'admin' && data.role !== 'super_admin') {
          router.replace(data.dashboardPath || '/admin/instructor');
          return;
        }

        setIsAuthenticated(true);
        setActorName(data.instructorName?.trim() || '관리자');
        setDashboardPath(data.dashboardPath || '/admin/ops');
      } catch (_error) {
        if (cancelled) return;
        router.replace('/admin/login');
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    };

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!checkingAuth && isAuthenticated) {
      void loadContent();
    }
  }, [checkingAuth, isAuthenticated, loadContent]);

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
    router.replace('/admin/login');
  }, [router]);

  const sortedInstructors = useMemo(
    () => [...instructors].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    [instructors]
  );

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    [programs]
  );

  const onCreateInstructor = useCallback(async () => {
    setCreatingInstructor(true);
    setMessage(null);
    setActionError(null);

    try {
      const response = await fetch('/api/admin/content/instructors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newInstructor.name,
          role: newInstructor.role,
          summary: newInstructor.summary,
          description: newInstructor.description,
          sortOrder: toSortOrder(newInstructor.sortOrder, 100),
          isActive: newInstructor.isActive,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(parseError(payload));
        return;
      }

      setMessage('강사 소개 카드를 등록했습니다.');
      setNewInstructor({
        name: '',
        role: '',
        summary: '',
        description: '',
        sortOrder: '100',
        isActive: true,
      });
      await loadContent();
    } catch (_error) {
      setActionError('강사 카드 등록 중 오류가 발생했습니다.');
    } finally {
      setCreatingInstructor(false);
    }
  }, [loadContent, newInstructor]);

  const onCreateProgram = useCallback(async () => {
    setCreatingProgram(true);
    setMessage(null);
    setActionError(null);

    try {
      const response = await fetch('/api/admin/content/programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newProgram.title,
          description: newProgram.description,
          highlights: newProgram.highlights,
          color: newProgram.color,
          sortOrder: toSortOrder(newProgram.sortOrder, 100),
          isActive: newProgram.isActive,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(parseError(payload));
        return;
      }

      setMessage('교육 프로그램 카드를 등록했습니다.');
      setNewProgram({
        title: '',
        description: '',
        highlights: '',
        color: 'var(--program-small-group-boys)',
        sortOrder: '100',
        isActive: true,
      });
      await loadContent();
    } catch (_error) {
      setActionError('프로그램 카드 등록 중 오류가 발생했습니다.');
    } finally {
      setCreatingProgram(false);
    }
  }, [loadContent, newProgram]);

  const onSaveInstructor = useCallback(
    async (instructorId: string) => {
      const draft = instructorDrafts[instructorId];
      if (!draft) return;

      setSavingInstructorId(instructorId);
      setMessage(null);
      setActionError(null);

      try {
        const response = await fetch(`/api/admin/content/instructors/${instructorId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: draft.name,
            role: draft.role,
            summary: draft.summary,
            description: draft.description,
            sortOrder: toSortOrder(draft.sortOrder, 100),
            isActive: draft.isActive,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(parseError(payload));
          return;
        }

        setMessage('강사 카드 변경사항을 저장했습니다.');
        await loadContent();
      } catch (_error) {
        setActionError('강사 카드 저장 중 오류가 발생했습니다.');
      } finally {
        setSavingInstructorId(null);
      }
    },
    [instructorDrafts, loadContent]
  );

  const onSaveProgram = useCallback(
    async (programId: string) => {
      const draft = programDrafts[programId];
      if (!draft) return;

      setSavingProgramId(programId);
      setMessage(null);
      setActionError(null);

      try {
        const response = await fetch(`/api/admin/content/programs/${programId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            highlights: draft.highlights,
            color: draft.color,
            sortOrder: toSortOrder(draft.sortOrder, 100),
            isActive: draft.isActive,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(parseError(payload));
          return;
        }

        setMessage('프로그램 카드 변경사항을 저장했습니다.');
        await loadContent();
      } catch (_error) {
        setActionError('프로그램 카드 저장 중 오류가 발생했습니다.');
      } finally {
        setSavingProgramId(null);
      }
    },
    [loadContent, programDrafts]
  );

  const onDeleteInstructor = useCallback(
    async (instructorId: string, name: string) => {
      const confirmed = window.confirm(`"${name}" 카드를 삭제할까요?`);
      if (!confirmed) return;

      setDeletingId(instructorId);
      setMessage(null);
      setActionError(null);

      try {
        const response = await fetch(`/api/admin/content/instructors/${instructorId}`, {
          method: 'DELETE',
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(parseError(payload));
          return;
        }

        setMessage('강사 카드를 삭제했습니다.');
        await loadContent();
      } catch (_error) {
        setActionError('강사 카드 삭제 중 오류가 발생했습니다.');
      } finally {
        setDeletingId(null);
      }
    },
    [loadContent]
  );

  const onDeleteProgram = useCallback(
    async (programId: string, title: string) => {
      const confirmed = window.confirm(`"${title}" 카드를 삭제할까요?`);
      if (!confirmed) return;

      setDeletingId(programId);
      setMessage(null);
      setActionError(null);

      try {
        const response = await fetch(`/api/admin/content/programs/${programId}`, {
          method: 'DELETE',
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(parseError(payload));
          return;
        }

        setMessage('프로그램 카드를 삭제했습니다.');
        await loadContent();
      } catch (_error) {
        setActionError('프로그램 카드 삭제 중 오류가 발생했습니다.');
      } finally {
        setDeletingId(null);
      }
    },
    [loadContent]
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Landing Content</p>
        <h1 className={`font-display ${styles.title}`}>강사/프로그램 콘텐츠 관리</h1>
        <p className={styles.description}>
          메인 페이지의 강사 소개와 교육 프로그램 카드를 데이터베이스로 등록/수정/비활성화할 수 있습니다.
        </p>
      </section>

      {checkingAuth ? <p className={styles.infoText}>로그인 상태를 확인하고 있습니다...</p> : null}
      {!checkingAuth && !isAuthenticated ? <p className={styles.infoText}>관리자 로그인 페이지로 이동 중입니다...</p> : null}

      {!checkingAuth && isAuthenticated ? (
        <section className={styles.authBar}>
          <p className={styles.authText}>
            로그인 관리자: <strong>{actorName || '관리자'}</strong>
          </p>
          <div className={styles.authActions}>
            <Link href={dashboardPath} className={styles.ghostButton}>
              대시보드
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

      {loading ? <p className={styles.infoText}>콘텐츠를 불러오는 중입니다...</p> : null}
      {loadError ? <p className={styles.errorText}>{loadError}</p> : null}
      {message ? <p className={styles.successText}>{message}</p> : null}
      {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>강사 소개 카드 등록</h2>
        <div className={styles.createGrid}>
          <label className={styles.field}>
            <span>이름</span>
            <input
              value={newInstructor.name}
              onChange={(event) => setNewInstructor((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="예: 홍길동 강사"
            />
          </label>
          <label className={styles.field}>
            <span>역할</span>
            <input
              value={newInstructor.role}
              onChange={(event) => setNewInstructor((prev) => ({ ...prev, role: event.target.value }))}
              placeholder="예: 소그룹 강사"
            />
          </label>
          <label className={styles.field}>
            <span>한 줄 소개</span>
            <input
              value={newInstructor.summary}
              onChange={(event) => setNewInstructor((prev) => ({ ...prev, summary: event.target.value }))}
              placeholder="예: 청소년 소통형 수업 전문"
            />
          </label>
          <label className={styles.field}>
            <span>정렬 순서</span>
            <input
              value={newInstructor.sortOrder}
              onChange={(event) => setNewInstructor((prev) => ({ ...prev, sortOrder: event.target.value }))}
              placeholder="100"
            />
          </label>
          <label className={styles.fieldWide}>
            <span>설명</span>
            <textarea
              value={newInstructor.description}
              onChange={(event) => setNewInstructor((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="강사 소개 설명"
            />
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={newInstructor.isActive}
              onChange={(event) => setNewInstructor((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            <span>활성 상태로 등록</span>
          </label>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={onCreateInstructor} disabled={creatingInstructor}>
            {creatingInstructor ? '등록 중...' : '강사 카드 등록'}
          </button>
        </div>

        <div className={styles.listSection}>
          {sortedInstructors.map((row) => {
            const draft = instructorDrafts[row.instructorId];
            if (!draft) return null;
            return (
              <article key={row.instructorId} className={styles.itemCard}>
                <div className={styles.createGrid}>
                  <label className={styles.field}>
                    <span>이름</span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setInstructorDrafts((prev) => ({
                          ...prev,
                          [row.instructorId]: { ...prev[row.instructorId], name: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>역할</span>
                    <input
                      value={draft.role}
                      onChange={(event) =>
                        setInstructorDrafts((prev) => ({
                          ...prev,
                          [row.instructorId]: { ...prev[row.instructorId], role: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>한 줄 소개</span>
                    <input
                      value={draft.summary}
                      onChange={(event) =>
                        setInstructorDrafts((prev) => ({
                          ...prev,
                          [row.instructorId]: { ...prev[row.instructorId], summary: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>정렬 순서</span>
                    <input
                      value={draft.sortOrder}
                      onChange={(event) =>
                        setInstructorDrafts((prev) => ({
                          ...prev,
                          [row.instructorId]: { ...prev[row.instructorId], sortOrder: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.fieldWide}>
                    <span>설명</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        setInstructorDrafts((prev) => ({
                          ...prev,
                          [row.instructorId]: { ...prev[row.instructorId], description: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setInstructorDrafts((prev) => ({
                          ...prev,
                          [row.instructorId]: { ...prev[row.instructorId], isActive: event.target.checked },
                        }))
                      }
                    />
                    <span>활성 상태</span>
                  </label>
                </div>
                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => onSaveInstructor(row.instructorId)}
                    disabled={savingInstructorId === row.instructorId}
                  >
                    {savingInstructorId === row.instructorId ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => onDeleteInstructor(row.instructorId, row.name)}
                    disabled={deletingId === row.instructorId}
                  >
                    {deletingId === row.instructorId ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>교육 프로그램 카드 등록</h2>
        <div className={styles.createGrid}>
          <label className={styles.field}>
            <span>프로그램명</span>
            <input
              value={newProgram.title}
              onChange={(event) => setNewProgram((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="예: 소그룹 성교육"
            />
          </label>
          <label className={styles.field}>
            <span>색상</span>
            <input
              value={newProgram.color}
              onChange={(event) => setNewProgram((prev) => ({ ...prev, color: event.target.value }))}
              placeholder="예: #f3b07a 또는 var(--program-small-group-boys)"
            />
          </label>
          <label className={styles.field}>
            <span>정렬 순서</span>
            <input
              value={newProgram.sortOrder}
              onChange={(event) => setNewProgram((prev) => ({ ...prev, sortOrder: event.target.value }))}
              placeholder="100"
            />
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={newProgram.isActive}
              onChange={(event) => setNewProgram((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            <span>활성 상태로 등록</span>
          </label>
          <label className={styles.fieldWide}>
            <span>설명</span>
            <textarea
              value={newProgram.description}
              onChange={(event) => setNewProgram((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="프로그램 설명"
            />
          </label>
          <label className={styles.fieldWide}>
            <span>핵심 포인트 (줄바꿈으로 구분)</span>
            <textarea
              value={newProgram.highlights}
              onChange={(event) => setNewProgram((prev) => ({ ...prev, highlights: event.target.value }))}
              placeholder={'예:\n팀별 참여 활동 중심\n요청사항 반영형 수업 준비'}
            />
          </label>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={onCreateProgram} disabled={creatingProgram}>
            {creatingProgram ? '등록 중...' : '프로그램 카드 등록'}
          </button>
        </div>

        <div className={styles.listSection}>
          {sortedPrograms.map((row) => {
            const draft = programDrafts[row.programId];
            if (!draft) return null;

            return (
              <article key={row.programId} className={styles.itemCard}>
                <div className={styles.createGrid}>
                  <label className={styles.field}>
                    <span>프로그램명</span>
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        setProgramDrafts((prev) => ({
                          ...prev,
                          [row.programId]: { ...prev[row.programId], title: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>색상</span>
                    <input
                      value={draft.color}
                      onChange={(event) =>
                        setProgramDrafts((prev) => ({
                          ...prev,
                          [row.programId]: { ...prev[row.programId], color: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>정렬 순서</span>
                    <input
                      value={draft.sortOrder}
                      onChange={(event) =>
                        setProgramDrafts((prev) => ({
                          ...prev,
                          [row.programId]: { ...prev[row.programId], sortOrder: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setProgramDrafts((prev) => ({
                          ...prev,
                          [row.programId]: { ...prev[row.programId], isActive: event.target.checked },
                        }))
                      }
                    />
                    <span>활성 상태</span>
                  </label>
                  <label className={styles.fieldWide}>
                    <span>설명</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        setProgramDrafts((prev) => ({
                          ...prev,
                          [row.programId]: { ...prev[row.programId], description: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.fieldWide}>
                    <span>핵심 포인트 (줄바꿈 구분)</span>
                    <textarea
                      value={draft.highlights}
                      onChange={(event) =>
                        setProgramDrafts((prev) => ({
                          ...prev,
                          [row.programId]: { ...prev[row.programId], highlights: event.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => onSaveProgram(row.programId)}
                    disabled={savingProgramId === row.programId}
                  >
                    {savingProgramId === row.programId ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => onDeleteProgram(row.programId, row.title)}
                    disabled={deletingId === row.programId}
                  >
                    {deletingId === row.programId ? '삭제 중...' : '삭제'}
                  </button>
                </div>
                <div className={styles.linkRow}>
                  <span>상세 페이지</span>
                  <Link href={`/programs/${row.programId}`} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                    /programs/{row.programId}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
