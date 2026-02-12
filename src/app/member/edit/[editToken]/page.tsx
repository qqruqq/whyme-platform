'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type YesNo = 'yes' | 'no' | '';

type EditForm = {
  childName: string;
  childGrade: string;
  priorStudentAttended: YesNo;
  siblingsPriorAttended: YesNo;
  parentPriorAttended: YesNo;
  parentName: string;
  parentPhone: string;
  noteToInstructor: string;
};

type MemberFetchResponse = {
  success: boolean;
  groupId: string;
  groupMemberId: string;
  rosterStatus: string;
  isLocked: boolean;
  member: {
    childName: string;
    childGrade: string | null;
    priorStudentAttended: boolean | null;
    siblingsPriorAttended: boolean | null;
    parentPriorAttended: boolean | null;
    parentName: string | null;
    parentPhone: string | null;
    noteToInstructor: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

const GRADE_OPTIONS = [
  '유아',
  '초1',
  '초2',
  '초3',
  '초4',
  '초5',
  '초6',
  '중1',
  '중2',
  '중3',
  '고1',
  '고2',
  '고3',
  '기타',
];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function booleanToAnswer(value: boolean | null | undefined): YesNo {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '';
}

function answerToBoolean(value: YesNo): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

function parseApiError(status: number, payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '요청 처리 중 오류가 발생했습니다.';
  }

  const typed = payload as ApiErrorPayload;
  const fieldErrors = typed.details?.fieldErrors;
  if (fieldErrors) {
    const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0);
    if (firstField?.[0]) return firstField[0];
  }

  const error = typed.error || '';
  if (status === 404 && error === 'Invalid edit token') {
    return '수정 링크가 올바르지 않습니다.';
  }
  if (status === 409 && error.includes('Roster is locked')) {
    return '현재 교육 준비가 완료되어 더 이상 수정할 수 없습니다.';
  }

  return typed.error ?? '요청 처리 중 오류가 발생했습니다.';
}

type YesNoFieldProps = {
  legend: string;
  name: string;
  value: YesNo;
  disabled?: boolean;
  onChange: (value: YesNo) => void;
};

function YesNoField({ legend, name, value, disabled, onChange }: YesNoFieldProps) {
  return (
    <fieldset className={styles.questionCard} disabled={disabled}>
      <legend>{legend}</legend>
      <div className={styles.choiceRow}>
        <label className={value === 'yes' ? styles.choiceActive : styles.choice}>
          <input
            type="radio"
            name={name}
            value="yes"
            checked={value === 'yes'}
            onChange={() => onChange('yes')}
          />
          네
        </label>
        <label className={value === 'no' ? styles.choiceActive : styles.choice}>
          <input
            type="radio"
            name={name}
            value="no"
            checked={value === 'no'}
            onChange={() => onChange('no')}
          />
          아니요
        </label>
      </div>
    </fieldset>
  );
}

function responseToForm(data: MemberFetchResponse): EditForm {
  return {
    childName: data.member.childName,
    childGrade: data.member.childGrade ?? '',
    priorStudentAttended: booleanToAnswer(data.member.priorStudentAttended),
    siblingsPriorAttended: booleanToAnswer(data.member.siblingsPriorAttended),
    parentPriorAttended: booleanToAnswer(data.member.parentPriorAttended),
    parentName: data.member.parentName ?? '',
    parentPhone: formatPhone(data.member.parentPhone ?? ''),
    noteToInstructor: data.member.noteToInstructor ?? '',
  };
}

export default function MemberEditPage() {
  const params = useParams<{ editToken: string }>();
  const editToken = (params?.editToken || '').toString();

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [data, setData] = useState<MemberFetchResponse | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!form || !data) return false;
    if (data.isLocked || submitting) return false;
    return Boolean(form.childName.trim());
  }, [form, data, submitting]);

  const fetchMemberData = useCallback(async () => {
    if (!editToken) {
      setLoadingError('수정 링크가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadingError(null);

    try {
      const response = await fetch(`/api/member/${editToken}`);
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setLoadingError(parseApiError(response.status, payload));
        return;
      }

      const nextData = payload as MemberFetchResponse;
      setData(nextData);
      setForm(responseToForm(nextData));
    } catch (_error) {
      setLoadingError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [editToken]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await fetch('/api/member/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editToken,
          childName: form.childName.trim(),
          childGrade: form.childGrade,
          priorStudentAttended: answerToBoolean(form.priorStudentAttended),
          siblingsPriorAttended: answerToBoolean(form.siblingsPriorAttended),
          parentPriorAttended: answerToBoolean(form.parentPriorAttended),
          parentName: form.parentName,
          parentPhone: form.parentPhone.trim(),
          noteToInstructor: form.noteToInstructor,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setSubmitError(parseApiError(response.status, payload));
        return;
      }

      setSubmitSuccess('수정이 완료되었습니다.');
      await fetchMemberData();
    } catch (_error) {
      setSubmitError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Member Edit</p>
        <h1 className={`font-display ${styles.title}`}>팀원 정보 수정</h1>
        <p className={styles.description}>입력했던 내용을 다시 확인하고 수정할 수 있습니다.</p>
        <Link href="/" className={styles.backLink}>
          홈으로 이동
        </Link>
      </section>

      {loading ? <p className={styles.infoText}>불러오는 중...</p> : null}
      {loadingError ? <p className={styles.errorText}>{loadingError}</p> : null}

      {data && form ? (
        <section className={styles.layout}>
          <form onSubmit={onSubmit} className={styles.formPanel}>
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>학생 정보</h2>

              <label className={styles.field}>
                <span>자녀 이름</span>
                <input
                  required
                  disabled={data.isLocked}
                  value={form.childName}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, childName: event.target.value } : prev))}
                />
              </label>

              <label className={styles.field}>
                <span>학년</span>
                <select
                  disabled={data.isLocked}
                  value={form.childGrade}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, childGrade: event.target.value } : prev))}
                >
                  <option value="">선택해 주세요 (선택)</option>
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>

              <YesNoField
                legend="학생이 학교 성교육 외 별도의 성교육 경험(와이미 포함)이 있나요?"
                name="priorStudentAttended"
                value={form.priorStudentAttended}
                disabled={data.isLocked}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, priorStudentAttended: value } : prev))
                }
              />

              <YesNoField
                legend="학생의 형제/자매가 와이미 성교육 경험이 있나요?"
                name="siblingsPriorAttended"
                value={form.siblingsPriorAttended}
                disabled={data.isLocked}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, siblingsPriorAttended: value } : prev))
                }
              />

              <YesNoField
                legend="학생의 부모님이 학교 성교육 외 별도의 성교육 경험(와이미 포함)이 있나요?"
                name="parentPriorAttended"
                value={form.parentPriorAttended}
                disabled={data.isLocked}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, parentPriorAttended: value } : prev))
                }
              />
            </section>

            <section className={styles.block}>
              <h2 className={styles.blockTitle}>학부모 정보</h2>

              <label className={styles.field}>
                <span>학부모 이름 (선택)</span>
                <input
                  disabled={data.isLocked}
                  value={form.parentName}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, parentName: event.target.value } : prev))}
                />
              </label>

              <label className={styles.field}>
                <span>학부모 연락처 (선택)</span>
                <input
                  inputMode="numeric"
                  disabled={data.isLocked}
                  value={form.parentPhone}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            parentPhone: formatPhone(event.target.value),
                          }
                        : prev
                    )
                  }
                  placeholder="010-1234-5678"
                />
              </label>

              <label className={styles.field}>
                <span>강사님께 전달할 사항 (선택)</span>
                <textarea
                  rows={4}
                  disabled={data.isLocked}
                  value={form.noteToInstructor}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, noteToInstructor: event.target.value } : prev))
                  }
                />
              </label>
            </section>

            {submitError ? <p className={styles.errorText}>{submitError}</p> : null}
            {submitSuccess ? <p className={styles.successText}>{submitSuccess}</p> : null}

            <button type="submit" disabled={!canSubmit} className={styles.submitButton}>
              {submitting ? '수정 중...' : data.isLocked ? '잠금 상태로 수정 불가' : '수정 저장'}
            </button>
          </form>

          <aside className={styles.resultPanel}>
            <h2 className={`font-display ${styles.resultTitle}`}>상태 안내</h2>
            <div className={styles.resultBox}>
              <p className={styles.resultLabel}>로스터 상태</p>
              <p className={styles.resultValue}>{data.rosterStatus}</p>
              <p className={styles.resultLabel}>마지막 수정 시각</p>
              <p className={styles.resultValue}>{new Date(data.member.updatedAt).toLocaleString('ko-KR')}</p>
              {data.isLocked ? (
                <p className={styles.lockedMessage}>현재 교육 준비가 완료되어 더 이상 수정할 수 없습니다.</p>
              ) : (
                <p className={styles.helperMessage}>수정 후 저장 버튼을 눌러 반영해 주세요.</p>
              )}
            </div>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
