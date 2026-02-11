'use client'

import Link from 'next/link';
import { useMemo, useState } from 'react';
import styles from './page.module.css';

type LookupForm = {
    classDate: string;
    classHour: string;
    classMinute: string;
    instructorName: string;
    leaderPhone: string;
};

type LookupSuccess = {
    success: boolean;
    groupId: string;
    slotId: string;
    status: string;
    rosterStatus: string;
    manageToken: string;
    manageUrl: string;
    leaderEditToken: string | null;
    leaderEditUrl: string | null;
};

type LookupErrorPayload = {
    error?: string;
    details?: {
        fieldErrors?: Record<string, string[]>;
    };
};

const INITIAL_FORM: LookupForm = {
    classDate: '',
    classHour: '',
    classMinute: '',
    instructorName: '',
    leaderPhone: '',
};

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = ['00', '30'];

function digitsOnly(value: string): string {
    return value.replace(/\D/g, '');
}

function formatPhone(value: string): string {
    const digits = digitsOnly(value).slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function parseError(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return '조회 중 오류가 발생했습니다.';
    }

    const maybeError = payload as LookupErrorPayload;
    const fieldErrors = maybeError.details?.fieldErrors;
    if (fieldErrors) {
        const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0);
        if (firstField?.[0]) return firstField[0];
    }

    return maybeError.error ?? '조회 중 오류가 발생했습니다.';
}

export default function BookingLookupPage() {
    const [form, setForm] = useState<LookupForm>(INITIAL_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<LookupSuccess | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copiedManage' | 'copiedEdit' | 'failed'>('idle');

    const canSubmit = useMemo(() => {
        return Boolean(
            form.classDate &&
                form.classHour &&
                form.classMinute &&
                form.instructorName.trim() &&
                digitsOnly(form.leaderPhone).length >= 10
        );
    }, [form.classDate, form.classHour, form.classMinute, form.instructorName, form.leaderPhone]);

    const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit || loading) return;

        setLoading(true);
        setError(null);
        setResult(null);
        setCopyState('idle');

        try {
            const response = await fetch('/api/booking/lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    classDate: form.classDate,
                    classTime: `${form.classHour}:${form.classMinute}`,
                    instructorName: form.instructorName.trim(),
                    leaderPhone: form.leaderPhone,
                }),
            });

            const data: unknown = await response.json().catch(() => null);

            if (!response.ok) {
                setError(parseError(data));
                return;
            }

            setResult(data as LookupSuccess);
        } catch (_err) {
            setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    const copyText = async (value: string, state: 'copiedManage' | 'copiedEdit') => {
        try {
            await navigator.clipboard.writeText(value);
            setCopyState(state);
        } catch (_err) {
            setCopyState('failed');
        }
    };

    return (
        <main className={styles.page}>
            <section className={styles.panel}>
                <p className={styles.badge}>Reservation Lookup</p>
                <h1 className={`font-display ${styles.title}`}>예약 내역 조회</h1>
                <p className={styles.description}>
                    예약 당시 입력한 일정, 강사명, 대표 연락처로 관리 링크를 다시 확인할 수 있습니다.
                </p>
                <Link href="/" className={styles.backLink}>
                    홈으로 돌아가기
                </Link>
            </section>

            <section className={styles.lookupCard}>
                <form onSubmit={onSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <span>교육 일정 (날짜)</span>
                        <input
                            type="date"
                            required
                            value={form.classDate}
                            onChange={(event) => setForm((prev) => ({ ...prev, classDate: event.target.value }))}
                        />
                    </div>

                    <div className={styles.field}>
                        <span>교육 일정 (시간)</span>
                        <div className={styles.timePicker}>
                            <select
                                value={form.classHour}
                                required
                                onChange={(event) => setForm((prev) => ({ ...prev, classHour: event.target.value }))}
                            >
                                <option value="">시</option>
                                {HOURS.map((hour) => (
                                    <option key={hour} value={hour}>
                                        {hour}시
                                    </option>
                                ))}
                            </select>
                            <select
                                value={form.classMinute}
                                required
                                onChange={(event) => setForm((prev) => ({ ...prev, classMinute: event.target.value }))}
                            >
                                <option value="">분</option>
                                {MINUTES.map((minute) => (
                                    <option key={minute} value={minute}>
                                        {minute}분
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <span>강사명</span>
                        <input
                            required
                            value={form.instructorName}
                            onChange={(event) => setForm((prev) => ({ ...prev, instructorName: event.target.value }))}
                            placeholder="예: 김와이미 강사"
                        />
                    </div>

                    <div className={styles.field}>
                        <span>대표 연락처</span>
                        <input
                            required
                            inputMode="numeric"
                            value={form.leaderPhone}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    leaderPhone: formatPhone(event.target.value),
                                }))
                            }
                            placeholder="010-1234-5678"
                        />
                    </div>

                    {error ? <p className={styles.errorText}>{error}</p> : null}

                    <button type="submit" disabled={!canSubmit || loading} className={styles.submitButton}>
                        {loading ? '조회 중...' : '예약 내역 조회하기'}
                    </button>
                </form>

                <div className={styles.resultArea}>
                    <h2 className={`font-display ${styles.resultTitle}`}>조회 결과</h2>
                    {result ? (
                        <div className={styles.resultBox}>
                            <p className={styles.resultLabel}>관리 링크</p>
                            <a className={styles.resultLink} href={result.manageUrl}>
                                {result.manageUrl}
                            </a>
                            <button
                                type="button"
                                className={styles.copyButton}
                                onClick={() => copyText(result.manageUrl, 'copiedManage')}
                            >
                                관리 링크 복사
                            </button>

                            {result.leaderEditUrl ? (
                                <>
                                    <p className={styles.resultLabel}>대표 수정 링크</p>
                                    <a className={styles.resultLink} href={result.leaderEditUrl}>
                                        {result.leaderEditUrl}
                                    </a>
                                    <button
                                        type="button"
                                        className={styles.copyButton}
                                        onClick={() => copyText(result.leaderEditUrl as string, 'copiedEdit')}
                                    >
                                        대표 수정 링크 복사
                                    </button>
                                </>
                            ) : null}

                            {copyState === 'copiedManage' ? <p className={styles.copyState}>관리 링크를 복사했습니다.</p> : null}
                            {copyState === 'copiedEdit' ? <p className={styles.copyState}>대표 수정 링크를 복사했습니다.</p> : null}
                            {copyState === 'failed' ? <p className={styles.copyError}>복사에 실패했습니다. 직접 복사해 주세요.</p> : null}
                        </div>
                    ) : (
                        <p className={styles.placeholder}>조회 후 관리 링크가 여기에 표시됩니다.</p>
                    )}
                </div>
            </section>
        </main>
    );
}
