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
    status: string;
    createdAt: string;
    updatedAt: string;
};

type ManageData = {
    success: boolean;
    groupId: string;
    status: string;
    rosterStatus: string;
    classStartAt: string;
    classEndAt: string;
    instructorName: string;
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
    expiresAt: string;
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

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';

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

export default function ManagePage() {
    const params = useParams<{ leaderToken: string }>();
    const leaderToken = (params?.leaderToken || '').toString();

    const [loading, setLoading] = useState(true);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [data, setData] = useState<ManageData | null>(null);

    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteMessage, setInviteMessage] = useState<string | null>(null);
    const [sharedInviteUrl, setSharedInviteUrl] = useState<string | null>(null);
    const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const [shareState, setShareState] = useState<'idle' | 'shared' | 'failed'>('idle');

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

    const ensureSharedInvite = async () => {
        if (!leaderToken) return;

        setInviteLoading(true);
        setInviteError(null);
        setInviteMessage(null);

        try {
            const response = await fetch('/api/invite/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    leaderToken,
                }),
            });

            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                setInviteError(parseApiError(payload));
                return;
            }

            const result = payload as InviteCreateResult;
            setSharedInviteUrl(result.inviteUrl);
            setInviteExpiresAt(result.expiresAt);
            setInviteMessage(result.reusedExisting ? '기존 팀 공용 링크를 불러왔습니다.' : '팀 공용 링크를 생성했습니다.');
        } catch (_err) {
            setInviteError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setInviteLoading(false);
        }
    };

    useEffect(() => {
        fetchManageData();
    }, [leaderToken]);

    useEffect(() => {
        setCopyState('idle');
        setShareState('idle');
        setSharedInviteUrl(null);
        setInviteExpiresAt(null);
        ensureSharedInvite();
    }, [leaderToken]);

    const onCopyInvite = async () => {
        if (!sharedInviteUrl) return;

        try {
            await navigator.clipboard.writeText(sharedInviteUrl);
            setCopyState('copied');
        } catch (_err) {
            setCopyState('failed');
        }
    };

    const onShareInvite = async () => {
        if (!sharedInviteUrl) return;

        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: '와이미 소그룹 교육 정보 입력',
                    text: '팀 공용 정보 입력 링크를 공유합니다.',
                    url: sharedInviteUrl,
                });
                setShareState('shared');
                return;
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return;
                }
            }
        }

        try {
            await navigator.clipboard.writeText(sharedInviteUrl);
            setCopyState('copied');
            setShareState('shared');
        } catch (_err) {
            setShareState('failed');
        }
    };

    const completedAndDeclared = `${data?.counts.completed ?? 0}/${data?.headcountDeclared ?? '-'}명`;

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <p className={styles.badge}>Leader Manage</p>
                <h1 className={`font-display ${styles.title}`}>대표 학부모 관리 페이지</h1>
                <p className={styles.description}>팀원 입력 링크를 바로 공유하고 현재 명단을 확인할 수 있습니다.</p>
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
                            <p className={styles.summaryLabel}>예약 일정</p>
                            <p className={styles.summaryValue}>{formatDateTime(data.classStartAt)}</p>
                            <p className={styles.summarySub}>강사: {data.instructorName}</p>
                        </article>
                        <article className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>팀 공용 링크 유효기간</p>
                            <p className={styles.summaryValue}>교육일 3일 전까지</p>
                            <p className={styles.summarySub}>만료 시각: {formatDateTime(inviteExpiresAt)}</p>
                        </article>
                    </section>

                    <section className={styles.gridLayout}>
                        <article className={styles.panel}>
                            <h2 className={`font-display ${styles.panelTitle}`}>팀 공용 초대 링크</h2>
                            {inviteLoading ? <p className={styles.infoText}>링크 준비 중...</p> : null}
                            {inviteError ? <p className={styles.errorText}>{inviteError}</p> : null}
                            {inviteMessage ? <p className={styles.infoText}>{inviteMessage}</p> : null}

                            {sharedInviteUrl ? (
                                <div className={styles.inviteResult}>
                                    <p className={styles.resultLabel}>아래 링크를 팀원에게 공유해 주세요.</p>
                                    <a className={styles.resultLink} href={sharedInviteUrl}>
                                        {sharedInviteUrl}
                                    </a>
                                    <div className={styles.buttonRow}>
                                        <button type="button" className={styles.copyButton} onClick={onCopyInvite}>
                                            링크 복사
                                        </button>
                                        <button type="button" className={styles.copyButton} onClick={onShareInvite}>
                                            공유하기
                                        </button>
                                    </div>
                                    {copyState === 'copied' ? <p className={styles.copyState}>링크를 복사했습니다.</p> : null}
                                    {copyState === 'failed' ? <p className={styles.copyError}>복사에 실패했습니다.</p> : null}
                                    {shareState === 'shared' ? <p className={styles.copyState}>공유 창을 열었습니다.</p> : null}
                                    {shareState === 'failed' ? <p className={styles.copyError}>공유에 실패했습니다.</p> : null}
                                </div>
                            ) : null}

                            {isLocked ? (
                                <p className={styles.infoText}>명단이 잠겨 있어 링크를 새로 만들 수 없습니다.</p>
                            ) : null}
                        </article>

                        <article className={styles.panel}>
                            <h2 className={`font-display ${styles.panelTitle}`}>현재 명단 ({completedAndDeclared})</h2>
                            <p className={styles.infoText}>전체 입력 수: {data.counts.total}건</p>

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
