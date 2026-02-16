'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

type Member = {
    groupMemberId: string;
    childId: string;
    childName: string;
    childGrade: string | null;
    parentName: string | null;
    parentPhone: string | null;
    noteToInstructor: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
};

type ManageData = {
    success: boolean;
    groupId: string;
    status: string;
    rosterStatus: string;
    headcountDeclared: number | null;
    headcountFinal: number | null;
    counts: {
        total: number;
        completed: number;
        pending: number;
    };
    members: Member[];
};

type InviteCreateResult = {
    success: boolean;
    groupId: string;
    createdCount: number;
    inviteUrl: string;
    inviteUrls: string[];
    reusedExisting: boolean;
};

type ApiErrorPayload = {
    error?: string;
    details?: {
        fieldErrors?: Record<string, string[]>;
    };
};

function parseApiError(payload: unknown): string {
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

export default function ManagePage() {
    const params = useParams<{ leaderToken: string }>();
    const leaderToken = (params?.leaderToken || '').toString();

    const [loading, setLoading] = useState(true);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [data, setData] = useState<ManageData | null>(null);

    const [expiresInDays, setExpiresInDays] = useState(14);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createMessage, setCreateMessage] = useState<string | null>(null);
    const [createdInviteUrls, setCreatedInviteUrls] = useState<string[]>([]);
    const [copyState, setCopyState] = useState<'idle' | 'copiedAll' | 'failed'>('idle');

    const isLocked = useMemo(() => data?.rosterStatus === 'locked', [data?.rosterStatus]);

    const fetchManageData = async () => {
        if (!leaderToken) return;

        setLoading(true);
        setLoadingError(null);

        try {
            const response = await fetch(`/api/manage/${leaderToken}`);
            const payload: unknown = await response.json().catch(() => null);

            if (!response.ok) {
                setLoadingError(parseApiError(payload));
                return;
            }

            setData(payload as ManageData);
        } catch (_err) {
            setLoadingError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManageData();
    }, [leaderToken]);

    const onCreateInvites = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (creating || !leaderToken) return;

        setCreating(true);
        setCreateError(null);
        setCreateMessage(null);
        setCreatedInviteUrls([]);
        setCopyState('idle');

        try {
            const response = await fetch('/api/invite/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    leaderToken,
                    expiresInDays,
                }),
            });

            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                setCreateError(parseApiError(payload));
                return;
            }

            const result = payload as InviteCreateResult;
            setCreatedInviteUrls(result.inviteUrls);
            setCreateMessage(
                result.reusedExisting
                    ? '기존 팀 공용 링크를 불러왔습니다.'
                    : '새 팀 공용 링크를 생성했습니다.'
            );
            await fetchManageData();
        } catch (_err) {
            setCreateError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setCreating(false);
        }
    };

    const onCopyAll = async () => {
        if (createdInviteUrls.length === 0) return;

        try {
            await navigator.clipboard.writeText(createdInviteUrls.join('\n'));
            setCopyState('copiedAll');
        } catch (_err) {
            setCopyState('failed');
        }
    };

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <p className={styles.badge}>Leader Manage</p>
                <h1 className={`font-display ${styles.title}`}>대표 학부모 관리 페이지</h1>
                <p className={styles.description}>팀원 초대 링크를 생성하고 현재 명단 상태를 확인할 수 있습니다.</p>
                <Link href="/" className={styles.backLink}>
                    홈으로 돌아가기
                </Link>
            </section>

            {loading ? <p className={styles.infoText}>불러오는 중...</p> : null}
            {loadingError ? <p className={styles.errorText}>{loadingError}</p> : null}

            {data ? (
                <>
                    <section className={styles.summaryGrid}>
                        <article className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>그룹 상태</p>
                            <p className={styles.summaryValue}>{data.status}</p>
                        </article>
                        <article className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>로스터 상태</p>
                            <p className={styles.summaryValue}>{data.rosterStatus}</p>
                        </article>
                        <article className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>등록 인원</p>
                            <p className={styles.summaryValue}>
                                {data.counts.completed}/{data.headcountDeclared ?? '-'}명
                            </p>
                        </article>
                        <article className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>전체 입력 수</p>
                            <p className={styles.summaryValue}>{data.counts.total}건</p>
                        </article>
                    </section>

                    <section className={styles.gridLayout}>
                        <article className={styles.panel}>
                            <h2 className={`font-display ${styles.panelTitle}`}>팀 공용 초대 링크</h2>
                            <form onSubmit={onCreateInvites} className={styles.form}>
                                <label className={styles.field}>
                                    <span>유효기간 (일)</span>
                                    <select
                                        value={expiresInDays}
                                        onChange={(event) => setExpiresInDays(Number(event.target.value))}
                                    >
                                        {[3, 7, 14, 21, 30, 60, 90].map((value) => (
                                            <option key={value} value={value}>
                                                {value}일
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {createError ? <p className={styles.errorText}>{createError}</p> : null}
                                {createMessage ? <p className={styles.infoText}>{createMessage}</p> : null}

                                <button type="submit" disabled={creating || isLocked} className={styles.submitButton}>
                                    {creating ? '처리 중...' : isLocked ? '잠금 상태로 생성 불가' : '공용 링크 확인/생성'}
                                </button>
                            </form>

                            {createdInviteUrls.length > 0 ? (
                                <div className={styles.inviteResult}>
                                    <div className={styles.inviteHeader}>
                                        <p className={styles.resultLabel}>생성된 초대 링크</p>
                                        <button type="button" className={styles.copyButton} onClick={onCopyAll}>
                                            전체 복사
                                        </button>
                                    </div>

                                    <ul className={styles.urlList}>
                                        {createdInviteUrls.map((url) => (
                                            <li key={url}>
                                                <a href={url}>{url}</a>
                                            </li>
                                        ))}
                                    </ul>

                                    {copyState === 'copiedAll' ? <p className={styles.copyState}>링크를 복사했습니다.</p> : null}
                                    {copyState === 'failed' ? <p className={styles.copyError}>복사에 실패했습니다.</p> : null}
                                </div>
                            ) : null}
                        </article>

                        <article className={styles.panel}>
                            <h2 className={`font-display ${styles.panelTitle}`}>현재 명단</h2>
                            {data.members.length === 0 ? (
                                <p className={styles.infoText}>아직 입력된 팀원 정보가 없습니다.</p>
                            ) : (
                                <ul className={styles.memberList}>
                                    {data.members.map((member) => (
                                        <li key={member.groupMemberId} className={styles.memberCard}>
                                            <div className={styles.memberTop}>
                                                <p className={styles.memberName}>
                                                    {member.childName}
                                                    {member.childGrade ? ` (${member.childGrade})` : ''}
                                                </p>
                                                <span className={styles.memberStatus}>{member.status}</span>
                                            </div>
                                            <p className={styles.memberMeta}>
                                                보호자: {member.parentName || '-'} / {member.parentPhone || '-'}
                                            </p>
                                            {member.noteToInstructor ? (
                                                <p className={styles.memberNote}>메모: {member.noteToInstructor}</p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>
                    </section>
                </>
            ) : null}
        </main>
    );
}
