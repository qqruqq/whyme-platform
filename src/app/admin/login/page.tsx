'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

type AuthCheckResponse = {
  success: boolean;
  authenticated: boolean;
  instructorName?: string;
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
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

export default function AdminLoginPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loginName, setLoginName] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      setCheckingAuth(true);
      try {
        const response = await fetch('/api/admin/instructor/auth', {
          cache: 'no-store',
        });
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled || !response.ok) return;

        const data = payload as AuthCheckResponse;
        if (data.authenticated) {
          router.replace('/admin/instructor');
        }
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

  const onLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = loginName.trim();
      const code = loginCode.trim();
      if (!name || !code) {
        setLoginError('강사 이름과 코드를 모두 입력해주세요.');
        return;
      }

      setLoginSubmitting(true);
      setLoginError(null);

      try {
        const response = await fetch('/api/admin/instructor/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            code,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setLoginError(parseError(payload));
          return;
        }

        router.push('/admin/instructor');
      } catch (_error) {
        setLoginError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoginSubmitting(false);
      }
    },
    [loginCode, loginName, router]
  );

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.badge}>Admin</p>
        <h1 className={`font-display ${styles.title}`}>관리자 로그인</h1>
        <p className={styles.description}>강사 관리 페이지 접근을 위해 이름과 코드를 입력해주세요.</p>

        {checkingAuth ? <p className={styles.infoText}>로그인 상태를 확인하고 있습니다...</p> : null}
        {loginError ? <p className={styles.errorText}>{loginError}</p> : null}

        <form className={styles.form} onSubmit={onLogin}>
          <label className={styles.field}>
            <span>강사 이름</span>
            <input
              value={loginName}
              onChange={(event) => setLoginName(event.target.value)}
              placeholder="예: 이시훈 대표강사"
              autoComplete="username"
            />
          </label>
          <label className={styles.field}>
            <span>강사 코드</span>
            <input
              type="password"
              value={loginCode}
              onChange={(event) => setLoginCode(event.target.value)}
              placeholder="코드를 입력해주세요"
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className={styles.primaryButton} disabled={loginSubmitting}>
            {loginSubmitting ? '로그인 중...' : '강사 로그인'}
          </button>
        </form>

        <Link href="/" className={styles.backLink}>
          홈페이지로 돌아가기
        </Link>
      </section>
    </main>
  );
}
