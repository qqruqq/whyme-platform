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
  parentPhonePrefix: string;
  parentPhoneCustomPrefix: string;
  parentPhoneSuffix: string;
  noteToInstructor: string;
  includeSecondStudent: boolean;
  firstStudent: StudentForm;
  secondStudent: StudentForm;
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

const GRADE_OPTIONS = ['초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];

const EMPTY_STUDENT: StudentForm = {
  childName: '',
  childGrade: '',
  priorStudentAttended: '',
  siblingsPriorAttended: '',
  parentPriorAttended: '',
};

const INITIAL_FORM: InviteForm = {
  parentName: '',
  parentPhonePrefix: '010',
  parentPhoneCustomPrefix: '',
  parentPhoneSuffix: '',
  noteToInstructor: '',
  includeSecondStudent: false,
  firstStudent: { ...EMPTY_STUDENT },
  secondStudent: { ...EMPTY_STUDENT },
};

const DIRECT_PHONE_PREFIX = 'direct';
const PHONE_PREFIX_OPTIONS = ['010', '011', '016', '017', '018', '019'];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizePhonePrefix(value: string): string {
  return digitsOnly(value).slice(0, 3);
}

function normalizePhoneSuffix(value: string): string {
  return digitsOnly(value).slice(0, 8);
}

function resolvePhonePrefix(selected: string, custom: string): string {
  if (selected === DIRECT_PHONE_PREFIX) {
    return normalizePhonePrefix(custom);
  }
  return normalizePhonePrefix(selected);
}

function composePhoneNumber(prefix: string, suffix: string): string {
  return `${normalizePhonePrefix(prefix)}${normalizePhoneSuffix(suffix)}`;
}

function answerToBoolean(value: YesNo): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

function studentComplete(student: StudentForm): boolean {
  return Boolean(
    student.childName.trim() &&
      student.childGrade &&
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
      return '이미 입력이 완료된 링크입니다. 조회/수정은 예약 내역 조회/수정에서 진행해 주세요.';
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
        <select value={student.childGrade} onChange={(event) => onChange({ ...student, childGrade: event.target.value })}>
          <option value="">선택해 주세요</option>
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const parentPhonePrefix = resolvePhonePrefix(form.parentPhonePrefix, form.parentPhoneCustomPrefix);
  const parentPhoneSuffix = normalizePhoneSuffix(form.parentPhoneSuffix);
  const parentPhone = composePhoneNumber(parentPhonePrefix, parentPhoneSuffix);
  const hasValidParentPhone = parentPhonePrefix.length === 3 && parentPhoneSuffix.length === 8;

  const canSubmit = useMemo(() => {
    if (!token) return false;

    const firstReady = studentComplete(form.firstStudent);
    const secondReady = !form.includeSecondStudent || studentComplete(form.secondStudent);

    return Boolean(
      form.parentName.trim() &&
        hasValidParentPhone &&
        form.noteToInstructor.trim() &&
        firstReady &&
        secondReady
    );
  }, [token, form, hasValidParentPhone]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const students = [
      {
        childName: form.firstStudent.childName.trim(),
        childGrade: form.firstStudent.childGrade,
        priorStudentAttended: answerToBoolean(form.firstStudent.priorStudentAttended),
        siblingsPriorAttended: answerToBoolean(form.firstStudent.siblingsPriorAttended),
        parentPriorAttended: answerToBoolean(form.firstStudent.parentPriorAttended),
      },
    ];

    if (form.includeSecondStudent) {
      students.push({
        childName: form.secondStudent.childName.trim(),
        childGrade: form.secondStudent.childGrade,
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
          parentPhone,
          noteToInstructor: form.noteToInstructor.trim(),
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(mapApiError(response.status, data));
        return;
      }

      setSuccessMessage('입력이 완료되었습니다. 수정이 필요하면 홈의 예약 내역 조회/수정을 이용해 주세요.');
    } catch (_err) {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>Invite Entry</p>
        <h1 className={`font-display ${styles.title}`}>팀원 정보 입력</h1>
        <p className={styles.description}>한 번에 최대 2명의 학생 정보를 입력할 수 있습니다.</p>
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
              학생 추가
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
              <div
                className={
                  form.parentPhonePrefix === DIRECT_PHONE_PREFIX
                    ? `${styles.phoneRow} ${styles.phoneRowCustom}`
                    : styles.phoneRow
                }
              >
                <select
                  value={form.parentPhonePrefix}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      parentPhonePrefix: event.target.value,
                    }))
                  }
                >
                  {PHONE_PREFIX_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={DIRECT_PHONE_PREFIX}>직접입력</option>
                </select>
                {form.parentPhonePrefix === DIRECT_PHONE_PREFIX ? (
                  <input
                    required
                    inputMode="numeric"
                    maxLength={3}
                    value={form.parentPhoneCustomPrefix}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        parentPhoneCustomPrefix: normalizePhonePrefix(event.target.value),
                      }))
                    }
                    placeholder="앞 3자리"
                  />
                ) : null}
                <input
                  required
                  inputMode="numeric"
                  maxLength={8}
                  value={form.parentPhoneSuffix}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      parentPhoneSuffix: normalizePhoneSuffix(event.target.value),
                    }))
                  }
                  placeholder="뒤 8자리"
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>강사님께 전달할 사항 (필수)</span>
              <div className={styles.noteGuide}>
                <p className={styles.noteGuideTitle}>
                  교육 시 강사가 알아두어야 할 학생의 특이사항
                  <br />
                  ex)
                </p>
                <ul>
                  <li>ADHD 약을 복용하고 있어요. 다소 산만한 모습을 보일 수도 있으니 양해 부탁드려요.</li>
                  <li>이전 다른 교육에서 들었던 내용으로 인해, 성교육에 대한 거부감이 매우 커요.</li>
                  <li>어려서 아버지를 여읜 터라, 해당 부분만 언급 조심 부탁드려요.</li>
                  <li>학교에서 심한 장난과 성적인 욕설로 몇 번 문제를 겪었어요.</li>
                  <li>참석 아이들 모두 포경수술을 했어요.</li>
                </ul>
                <p className={`${styles.noteGuideTitle} ${styles.noteGuideTitleSpaced}`}>
                  교육 시 집중 전달 또는 언급 자제 요청사항
                  <br />
                  ex)
                </p>
                <ul>
                  <li>세 명 모두 미디어 노출이 없어서 또래보다 어려요. 잘 맞춰서 교육 부탁드려요.</li>
                  <li>아이가 이성에 관심이 많습니다. SNS나 유튜브 등 미디어 이용 시 주의점 잘 알려주시면 좋겠어요.</li>
                  <li>좋아하는 사람에 대한 지켜야할 선과 책임감에 대해 콕 짚어주시기 바라요.</li>
                  <li>동성애를 무조건 존중해야 한다거나 성별을 선택할 수 있다는 내용 등은 원하지 않아요.</li>
                </ul>
              </div>
              <textarea
                required
                rows={4}
                value={form.noteToInstructor}
                onChange={(event) => setForm((prev) => ({ ...prev, noteToInstructor: event.target.value }))}
                placeholder="강사님께 전달하고 싶은 내용을 자유롭게 작성해 주세요."
              />
            </label>
          </section>

          {error ? <p className={styles.errorText}>{error}</p> : null}
          {successMessage ? <p className={styles.infoText}>{successMessage}</p> : null}

          <button type="submit" disabled={!canSubmit || submitting} className={styles.submitButton}>
            {submitting ? '입력 중...' : '정보 입력 완료'}
          </button>
        </form>
      </section>
    </main>
  );
}
