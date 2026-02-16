'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import styles from './page.module.css';

type YesNo = 'yes' | 'no' | '';

type StudentForm = {
  childName: string;
  childGrade: string;
  priorStudentAttended: YesNo;
  siblingsPriorAttended: YesNo;
  parentPriorAttended: YesNo;
};

type InviteForm = {
  parentName: string;
  parentPhone: string;
  noteToInstructor: string;
  includeSecondStudent: boolean;
  firstStudent: StudentForm;
  secondStudent: StudentForm;
};

type SubmitSuccess = {
  success: boolean;
  groupId: string;
  currentMemberCount: number;
  submittedStudentCount: number;
  groupMemberIds: string[];
  editTokens: string[];
  editUrls: string[];
  // backward compatibility
  groupMemberId?: string;
  editToken?: string;
  editUrl?: string;
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

const EMPTY_STUDENT: StudentForm = {
  childName: '',
  childGrade: '',
  priorStudentAttended: '',
  siblingsPriorAttended: '',
  parentPriorAttended: '',
};

const INITIAL_FORM: InviteForm = {
  parentName: '',
  parentPhone: '',
  noteToInstructor: '',
  includeSecondStudent: false,
  firstStudent: { ...EMPTY_STUDENT },
  secondStudent: { ...EMPTY_STUDENT },
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function answerToBoolean(value: YesNo): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

function studentComplete(student: StudentForm): boolean {
  return Boolean(
    student.childName.trim() &&
      student.priorStudentAttended &&
      student.siblingsPriorAttended &&
      student.parentPriorAttended
  );
}

function mapApiError(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const typed = payload as ApiErrorPayload;
    const fieldErrors = typed.details?.fieldErrors;
    if (fieldErrors) {
      const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0);
      if (firstField?.[0]) return firstField[0];
    }

    const error = typed.error || '';
    if (error === 'Invalid token' && status === 404) {
      return '링크가 올바르지 않습니다. 대표 학부모님께 새 링크를 요청해 주세요.';
    }
    if (error === 'Token expired' && status === 410) {
      return '이 링크는 유효기간이 지나 사용할 수 없습니다.';
    }
    if (error === 'Token already used' && status === 409) {
      return '이미 입력이 완료된 링크입니다. 수정이 필요하면 수정 링크를 이용해 주세요.';
    }
    if (error === 'Group roster is locked' && status === 409) {
      return '교육 준비가 완료되어 더 이상 입력/수정이 어렵습니다.';
    }
    if (error === 'Group headcount exceeded' && status === 409) {
      return '등록 가능 인원을 초과했습니다. 대표 학부모님께 확인해 주세요.';
    }

    if (typed.error) return typed.error;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

type YesNoFieldProps = {
  legend: string;
  name: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
};

function YesNoField({ legend, name, value, onChange }: YesNoFieldProps) {
  return (
    <fieldset className={styles.questionCard}>
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

type StudentSectionProps = {
  title: string;
  namePrefix: string;
  student: StudentForm;
  onChange: (next: StudentForm) => void;
};

function StudentSection({ title, namePrefix, student, onChange }: StudentSectionProps) {
  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>{title}</h2>

      <label className={styles.field}>
        <span>자녀 이름</span>
        <input
          required
          value={student.childName}
          onChange={(event) => onChange({ ...student, childName: event.target.value })}
          placeholder="예: 홍길동"
        />
      </label>

      <label className={styles.field}>
        <span>학년</span>
        <select
          value={student.childGrade}
          onChange={(event) => onChange({ ...student, childGrade: event.target.value })}
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
        name={`${namePrefix}-priorStudentAttended`}
        value={student.priorStudentAttended}
        onChange={(value) => onChange({ ...student, priorStudentAttended: value })}
      />

      <YesNoField
        legend="학생의 형제/자매가 와이미 성교육 경험이 있나요?"
        name={`${namePrefix}-siblingsPriorAttended`}
        value={student.siblingsPriorAttended}
        onChange={(value) => onChange({ ...student, siblingsPriorAttended: value })}
      />

      <YesNoField
        legend="학생의 부모님이 학교 성교육 외 별도의 성교육 경험(와이미 포함)이 있나요?"
        name={`${namePrefix}-parentPriorAttended`}
        value={student.parentPriorAttended}
        onChange={(value) => onChange({ ...student, parentPriorAttended: value })}
      />
    </section>
  );
}

export default function InviteEntryPage() {
  const params = useParams<{ token: string }>();
  const token = (params?.token || '').toString();

  const [form, setForm] = useState<InviteForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copiedAll' | 'failed'>('idle');

  const canSubmit = useMemo(() => {
    if (!token) return false;

    const phoneDigits = digitsOnly(form.parentPhone);
    const firstReady = studentComplete(form.firstStudent);
    const secondReady = !form.includeSecondStudent || studentComplete(form.secondStudent);

    return Boolean(
      form.parentName.trim() &&
        phoneDigits.length >= 10 &&
        phoneDigits.length <= 11 &&
        firstReady &&
        secondReady
    );
  }, [token, form]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setCopyState('idle');

    const students = [
      {
        childName: form.firstStudent.childName.trim(),
        childGrade: form.firstStudent.childGrade || undefined,
        priorStudentAttended: answerToBoolean(form.firstStudent.priorStudentAttended),
        siblingsPriorAttended: answerToBoolean(form.firstStudent.siblingsPriorAttended),
        parentPriorAttended: answerToBoolean(form.firstStudent.parentPriorAttended),
      },
    ];

    if (form.includeSecondStudent) {
      students.push({
        childName: form.secondStudent.childName.trim(),
        childGrade: form.secondStudent.childGrade || undefined,
        priorStudentAttended: answerToBoolean(form.secondStudent.priorStudentAttended),
        siblingsPriorAttended: answerToBoolean(form.secondStudent.siblingsPriorAttended),
        parentPriorAttended: answerToBoolean(form.secondStudent.parentPriorAttended),
      });
    }

    try {
      const response = await fetch('/api/invite/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          students,
          parentName: form.parentName.trim(),
          parentPhone: form.parentPhone.trim(),
          noteToInstructor: form.noteToInstructor.trim() || undefined,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(mapApiError(response.status, data));
        return;
      }

      setSuccess(data as SubmitSuccess);
    } catch (_err) {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const onCopyEditUrls = async () => {
    if (!success || success.editUrls.length === 0) return;

    try {
      await navigator.clipboard.writeText(success.editUrls.join('\n'));
      setCopyState('copiedAll');
    } catch (_err) {
      setCopyState('failed');
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Invite Entry</p>
        <h1 className={`font-display ${styles.title}`}>팀원 정보 입력</h1>
        <p className={styles.description}>
          한 번에 최대 2명의 학생 정보를 입력할 수 있습니다. 입력 완료 후 수정 링크를 꼭 저장해 주세요.
        </p>
        <Link href="/" className={styles.backLink}>
          홈으로 이동
        </Link>
      </section>

      <section className={styles.layout}>
        <form onSubmit={onSubmit} className={styles.formPanel}>
          <StudentSection
            title="학생 정보 1"
            namePrefix="student-1"
            student={form.firstStudent}
            onChange={(next) => setForm((prev) => ({ ...prev, firstStudent: next }))}
          />

          <section className={styles.block}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={form.includeSecondStudent}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    includeSecondStudent: event.target.checked,
                    secondStudent: event.target.checked ? prev.secondStudent : { ...EMPTY_STUDENT },
                  }))
                }
              />
              형제/자매 학생 정보도 함께 입력하기
            </label>
          </section>

          {form.includeSecondStudent ? (
            <StudentSection
              title="학생 정보 2"
              namePrefix="student-2"
              student={form.secondStudent}
              onChange={(next) => setForm((prev) => ({ ...prev, secondStudent: next }))}
            />
          ) : null}

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>학부모 정보</h2>

            <label className={styles.field}>
              <span>학부모 이름</span>
              <input
                required
                value={form.parentName}
                onChange={(event) => setForm((prev) => ({ ...prev, parentName: event.target.value }))}
                placeholder="예: 홍보호"
              />
            </label>

            <label className={styles.field}>
              <span>학부모 연락처 (필수)</span>
              <input
                required
                inputMode="numeric"
                value={form.parentPhone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    parentPhone: formatPhone(event.target.value),
                  }))
                }
                placeholder="010-1234-5678"
              />
            </label>

            <label className={styles.field}>
              <span>강사님께 전달할 사항 (선택)</span>
              <textarea
                rows={4}
                value={form.noteToInstructor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, noteToInstructor: event.target.value }))
                }
                placeholder="예: 학생이 낯을 가려서 초반 적응 시간이 필요할 수 있어요."
              />
            </label>
          </section>

          {error ? <p className={styles.errorText}>{error}</p> : null}

          <button type="submit" disabled={!canSubmit || submitting} className={styles.submitButton}>
            {submitting ? '입력 중...' : '정보 입력 완료'}
          </button>
        </form>

        <aside className={styles.resultPanel}>
          <h2 className={`font-display ${styles.resultTitle}`}>입력 완료 안내</h2>
          {success ? (
            <div className={styles.resultBox}>
              <p className={styles.resultMessage}>입력 완료! 아래 수정 링크를 저장해 주세요.</p>
              <p className={styles.resultLabel}>수정 링크</p>
              <ul className={styles.resultList}>
                {success.editUrls.map((url) => (
                  <li key={url} className={styles.resultListItem}>
                    <a className={styles.resultLink} href={url}>
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
              <button type="button" className={styles.copyButton} onClick={onCopyEditUrls}>
                수정 링크 전체 복사
              </button>
              {copyState === 'copiedAll' ? <p className={styles.copyState}>수정 링크를 복사했습니다.</p> : null}
              {copyState === 'failed' ? <p className={styles.copyError}>복사에 실패했습니다. 직접 복사해 주세요.</p> : null}
            </div>
          ) : (
            <div className={styles.placeholder}>
              <p>입력을 완료하면 수정 링크가 표시됩니다.</p>
              <p>형제/자매를 함께 등록한 경우 학생 수만큼 수정 링크가 발급됩니다.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
