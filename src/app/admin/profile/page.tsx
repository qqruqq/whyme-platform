'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type AuthCheckResponse = {
  success: boolean;
  authenticated: boolean;
  instructorName?: string;
  role?: 'super_admin' | 'admin' | 'instructor';
  dashboardPath?: string;
};

type ProfileUser = {
  userId: string;
  role: 'super_admin' | 'admin' | 'instructor';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  loginId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type ProfileResponse = {
  success: boolean;
  user: ProfileUser;
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

function parseError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '요청 처리 중 오류가 발생했습니다.';
  const typed = payload as ApiErrorPayload;
  const fieldErrors = typed.details?.fieldErrors;
  if (fieldErrors) {
    const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0);
    if (firstField?.[0]) return firstField[0];
  }
  return typed.error ?? '요청 처리 중 오류가 발생했습니다.';
}

function roleLabel(role: ProfileUser['role'] | undefined): string {
  if (role === 'super_admin') return '최고관리자';
  if (role === 'admin') return '관리자';
  if (role === 'instructor') return '강사';
  return '-';
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dashboardPath, setDashboardPath] = useState('/admin/instructor');
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    code: '',
  });

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setCheckingAuth(true);
      setLoading(true);
      setLoadError(null);

      try {
        const authResponse = await fetch('/api/admin/instructor/auth', { cache: 'no-store' });
        const authPayload: unknown = await authResponse.json().catch(() => null);
        if (cancelled) return;

        const authData = authPayload as AuthCheckResponse;
        if (!authResponse.ok || !authData.authenticated) {
          router.replace('/admin/login');
          return;
        }

        if (authData.dashboardPath) {
          setDashboardPath(authData.dashboardPath);
        }

        const profileResponse = await fetch('/api/admin/profile', { cache: 'no-store' });
        const profilePayload: unknown = await profileResponse.json().catch(() => null);
        if (cancelled) return;

        if (!profileResponse.ok) {
          setLoadError(parseError(profilePayload));
          return;
        }

        const profileData = profilePayload as ProfileResponse;
        setUser(profileData.user);
        setForm({
          name: profileData.user.name || '',
          phone: profileData.user.phone || '',
          email: profileData.user.email || '',
          code: '',
        });
      } catch (_error) {
        if (cancelled) return;
        setLoadError('프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
          setLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!user) return;

      setSaving(true);
      setSaveError(null);
      setSaveMessage(null);

      try {
        const response = await fetch('/api/admin/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            code: form.code.trim() || undefined,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setSaveError(parseError(payload));
          return;
        }

        const data = payload as ProfileResponse;
        setUser(data.user);
        setForm((prev) => ({
          ...prev,
          name: data.user.name || '',
          phone: data.user.phone || '',
          email: data.user.email || '',
          code: '',
        }));
        setSaveMessage('프로필을 저장했습니다.');
      } catch (_error) {
        setSaveError('프로필 저장 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [form.code, form.email, form.name, form.phone, user]
  );

  const summaryText = useMemo(() => {
    if (!user) return '-';
    return `${roleLabel(user.role)} / 상태: ${user.status}`;
  }, [user]);

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.badge}>Profile</p>
        <h1 className={`font-display ${styles.title}`}>내 정보 등록/수정</h1>
        <p className={styles.description}>강사/관리자 본인 정보와 로그인 코드를 직접 관리합니다.</p>

        {checkingAuth || loading ? <p className={styles.infoText}>정보를 불러오는 중입니다...</p> : null}
        {loadError ? <p className={styles.errorText}>{loadError}</p> : null}
        {saveError ? <p className={styles.errorText}>{saveError}</p> : null}
        {saveMessage ? <p className={styles.successText}>{saveMessage}</p> : null}

        <p className={styles.metaText}>{summaryText}</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>이름</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="이름"
            />
          </label>
          <label className={styles.field}>
            <span>연락처</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="010-0000-0000"
            />
          </label>
          <label className={styles.field}>
            <span>이메일</span>
            <input
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="name@example.com"
            />
          </label>
          <label className={styles.field}>
            <span>새 로그인 코드 (선택)</span>
            <input
              type="password"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="변경 시에만 입력"
            />
          </label>
          <button type="submit" className={styles.primaryButton} disabled={saving || !user}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </form>

        <div className={styles.actions}>
          {user && user.role !== 'instructor' ? (
            <Link href="/admin/content" className={styles.backLink}>
              콘텐츠 관리
            </Link>
          ) : null}
          <Link href={dashboardPath} className={styles.backLink}>
            대시보드로 돌아가기
          </Link>
          <Link href="/" className={styles.backLink}>
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
