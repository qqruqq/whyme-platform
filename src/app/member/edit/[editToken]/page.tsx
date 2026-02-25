'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type YesNo = 'yes' | 'no' | '';

type StudentEditForm = {
  groupMemberId: string;
  editToken: string;
  childName: string;
  childGrade: string;
  priorStudentAttended: YesNo;
  siblingsPriorAttended: YesNo;
  parentPriorAttended: YesNo;
};

type ParentForm = {
  parentName: string;
  parentPhonePrefix: string;
  parentPhoneCustomPrefix: string;
  parentPhoneSuffix: string;
  noteToInstructor: string;
};

type MemberFetchResponse = {
  success: boolean;
  groupId: string;
  groupMemberId: string;
  rosterStatus: string;
  isLocked: boolean;
  relatedMembers: {
    groupMemberId: string;
    childName: string;
    childGrade: string | null;
    editToken: string;
    parentName: string | null;
    parentPhone: string | null;
    noteToInstructor: string | null;
    status: string;
    priorStudentAttended: boolean | null;
    siblingsPriorAttended: boolean | null;
    parentPriorAttended: boolean | null;
    createdAt: string;
    updatedAt: string;
    isCurrent: boolean;
  }[];
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

type MemberRemoveResponse = {
  success: boolean;
  groupId: string;
  groupMemberId: string;
  nextEditToken: string | null;
};

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

const GRADE_OPTIONS = ['초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const DIRECT_PHONE_PREFIX = 'direct';
const PHONE_PREFIX_OPTIONS = ['010', '011', '016', '017', '018', '019'];

const INITIAL_PARENT_FORM: ParentForm = {
  parentName: '',
  parentPhonePrefix: '010',
  parentPhoneCustomPrefix: '',
  parentPhoneSuffix: '',
  noteToInstructor: '',
};

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

function studentComplete(student: StudentEditForm): boolean {
  return Boolean(
    student.childName.trim() &&
      student.childGrade &&
      student.priorStudentAttended &&
      student.siblingsPriorAttended &&
      student.parentPriorAttended
  );
}

function pickFirstFilled(values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function derivePhoneForm(phone: string | null | undefined) {
  const normalizedDigits = digitsOnly(phone ?? '');
  if (!normalizedDigits) {
    return {
      parentPhonePrefix: '010',
      parentPhoneCustomPrefix: '',
      parentPhoneSuffix: '',
    };
  }

  const prefix = normalizePhonePrefix(normalizedDigits.slice(0, 3));
  const suffix = normalizePhoneSuffix(normalizedDigits.slice(3));
  const prefixInOptions = PHONE_PREFIX_OPTIONS.includes(prefix);

  return {
    parentPhonePrefix: prefixInOptions ? prefix : DIRECT_PHONE_PREFIX,
    parentPhoneCustomPrefix: prefixInOptions ? '' : prefix,
    parentPhoneSuffix: suffix,
  };
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

export default function MemberEditPage() {
  const params = useParams<{ editToken: string }>();
  const router = useRouter();
  const editToken = (params?.editToken || '').toString();

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [data, setData] = useState<MemberFetchResponse | null>(null);
  const [students, setStudents] = useState<StudentEditForm[]>([]);
  const [parentForm, setParentForm] = useState<ParentForm>(INITIAL_PARENT_FORM);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [removingToken, setRemovingToken] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState<string | null>(null);

  const parentPhonePrefix = resolvePhonePrefix(parentForm.parentPhonePrefix, parentForm.parentPhoneCustomPrefix);
  const parentPhoneSuffix = normalizePhoneSuffix(parentForm.parentPhoneSuffix);
  const parentPhone = composePhoneNumber(parentPhonePrefix, parentPhoneSuffix);
  const hasValidParentPhone = parentPhonePrefix.length === 3 && parentPhoneSuffix.length === 8;

  const canSubmit = useMemo(() => {
    if (!data || students.length === 0) return false;
    if (data.isLocked || submitting || Boolean(removingToken)) return false;

    return Boolean(
      parentForm.parentName.trim() &&
        hasValidParentPhone &&
        parentForm.noteToInstructor.trim() &&
        students.every((student) => studentComplete(student))
    );
  }, [data, students, parentForm.parentName, parentForm.noteToInstructor, hasValidParentPhone, submitting, removingToken]);

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

      const nextStudents = nextData.relatedMembers.map((relatedMember) => ({
        groupMemberId: relatedMember.groupMemberId,
        editToken: relatedMember.editToken,
        childName: relatedMember.childName,
        childGrade: relatedMember.childGrade ?? '',
        priorStudentAttended: booleanToAnswer(relatedMember.priorStudentAttended),
        siblingsPriorAttended: booleanToAnswer(relatedMember.siblingsPriorAttended),
        parentPriorAttended: booleanToAnswer(relatedMember.parentPriorAttended),
      }));
      setStudents(nextStudents);

      const sharedParentName = pickFirstFilled([
        ...nextData.relatedMembers.map((relatedMember) => relatedMember.parentName),
        nextData.member.parentName,
      ]);

      const sharedParentPhone = pickFirstFilled([
        ...nextData.relatedMembers.map((relatedMember) => relatedMember.parentPhone),
        nextData.member.parentPhone,
      ]);

      const sharedNoteToInstructor = pickFirstFilled([
        ...nextData.relatedMembers.map((relatedMember) => relatedMember.noteToInstructor),
        nextData.member.noteToInstructor,
      ]);

      const phoneForm = derivePhoneForm(sharedParentPhone);
      setParentForm({
        parentName: sharedParentName,
        parentPhonePrefix: phoneForm.parentPhonePrefix,
        parentPhoneCustomPrefix: phoneForm.parentPhoneCustomPrefix,
        parentPhoneSuffix: phoneForm.parentPhoneSuffix,
        noteToInstructor: sharedNoteToInstructor,
      });
    } catch (_error) {
      setLoadingError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [editToken]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  const onChangeStudent = useCallback((groupMemberId: string, next: Partial<StudentEditForm>) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.groupMemberId === groupMemberId
          ? {
              ...student,
              ...next,
            }
          : student
      )
    );
  }, []);

  const onRemoveMember = useCallback(
    async (targetEditToken: string, targetChildName: string) => {
      if (!data || data.isLocked || submitting || removingToken) {
        return;
      }

      const confirmed = window.confirm(
        `${targetChildName || '해당 학생'} 정보를 삭제할까요?\n삭제 후에는 해당 학생이 명단에서 제외됩니다.`
      );
      if (!confirmed) {
        return;
      }

      setRemovingToken(targetEditToken);
      setRemoveError(null);
      setRemoveSuccess(null);
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        const response = await fetch('/api/member/remove', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            editToken: targetEditToken,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setRemoveError(parseApiError(response.status, payload));
          return;
        }

        const result = payload as MemberRemoveResponse;
        if (targetEditToken === editToken) {
          if (result.nextEditToken) {
            router.replace(`/member/edit/${result.nextEditToken}`);
          } else {
            router.replace('/');
          }
          return;
        }

        setRemoveSuccess('학생 정보를 삭제했습니다.');
        await fetchMemberData();
      } catch (_error) {
        setRemoveError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setRemovingToken(null);
      }
    },
    [data, editToken, fetchMemberData, removingToken, router, submitting]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setRemoveError(null);
    setRemoveSuccess(null);

    try {
      for (let index = 0; index < students.length; index += 1) {
        const student = students[index];

        const response = await fetch('/api/member/update', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            editToken: student.editToken,
            childName: student.childName.trim(),
            childGrade: student.childGrade,
            priorStudentAttended: answerToBoolean(student.priorStudentAttended),
            siblingsPriorAttended: answerToBoolean(student.siblingsPriorAttended),
            parentPriorAttended: answerToBoolean(student.parentPriorAttended),
            parentName: parentForm.parentName.trim(),
            parentPhone,
            noteToInstructor: parentForm.noteToInstructor.trim(),
          }),
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setSubmitError(`학생 ${index + 1}: ${parseApiError(response.status, payload)}`);
          return;
        }
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

      {data && students.length > 0 ? (
        <section className={styles.layout}>
          <form onSubmit={onSubmit} className={styles.formPanel}>
            {students.map((student, index) => (
              <section key={student.groupMemberId} className={styles.block}>
                <div className={styles.blockHeader}>
                  <h2 className={styles.blockTitle}>학생 정보 {index + 1}</h2>
                  <button
                    type="button"
                    className={styles.studentDeleteButton}
                    disabled={data.isLocked || submitting || Boolean(removingToken)}
                    onClick={() => onRemoveMember(student.editToken, student.childName)}
                  >
                    {removingToken === student.editToken ? '삭제 중...' : '학생 삭제'}
                  </button>
                </div>

                <label className={styles.field}>
                  <span>자녀 이름</span>
                  <input
                    required
                    disabled={data.isLocked || Boolean(removingToken)}
                    value={student.childName}
                    onChange={(event) => onChangeStudent(student.groupMemberId, { childName: event.target.value })}
                  />
                </label>

                <label className={styles.field}>
                  <span>학년</span>
                  <select
                    value={student.childGrade}
                    disabled={data.isLocked || Boolean(removingToken)}
                    onChange={(event) => onChangeStudent(student.groupMemberId, { childGrade: event.target.value })}
                  >
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
                  name={`${student.groupMemberId}-priorStudentAttended`}
                  value={student.priorStudentAttended}
                  disabled={data.isLocked || Boolean(removingToken)}
                  onChange={(value) => onChangeStudent(student.groupMemberId, { priorStudentAttended: value })}
                />

                <YesNoField
                  legend="학생의 형제/자매가 와이미 성교육 경험이 있나요?"
                  name={`${student.groupMemberId}-siblingsPriorAttended`}
                  value={student.siblingsPriorAttended}
                  disabled={data.isLocked || Boolean(removingToken)}
                  onChange={(value) => onChangeStudent(student.groupMemberId, { siblingsPriorAttended: value })}
                />

                <YesNoField
                  legend="학생의 부모님이 학교 성교육 외 별도의 성교육 경험(와이미 포함)이 있나요?"
                  name={`${student.groupMemberId}-parentPriorAttended`}
                  value={student.parentPriorAttended}
                  disabled={data.isLocked || Boolean(removingToken)}
                  onChange={(value) => onChangeStudent(student.groupMemberId, { parentPriorAttended: value })}
                />
              </section>
            ))}

            <section className={styles.block}>
              <h2 className={styles.blockTitle}>학부모 정보</h2>

              <label className={styles.field}>
                <span>학부모 이름</span>
                <input
                  required
                  disabled={data.isLocked || Boolean(removingToken)}
                  value={parentForm.parentName}
                  onChange={(event) => setParentForm((prev) => ({ ...prev, parentName: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>학부모 연락처 (필수)</span>
                <div
                  className={
                    parentForm.parentPhonePrefix === DIRECT_PHONE_PREFIX
                      ? `${styles.phoneRow} ${styles.phoneRowCustom}`
                      : styles.phoneRow
                  }
                >
                  <select
                    value={parentForm.parentPhonePrefix}
                    disabled={data.isLocked || Boolean(removingToken)}
                    onChange={(event) =>
                      setParentForm((prev) => ({
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
                  {parentForm.parentPhonePrefix === DIRECT_PHONE_PREFIX ? (
                    <input
                      required
                      inputMode="numeric"
                      maxLength={3}
                      disabled={data.isLocked || Boolean(removingToken)}
                      value={parentForm.parentPhoneCustomPrefix}
                      onChange={(event) =>
                        setParentForm((prev) => ({
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
                    disabled={data.isLocked || Boolean(removingToken)}
                    value={parentForm.parentPhoneSuffix}
                    onChange={(event) =>
                      setParentForm((prev) => ({
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
                  disabled={data.isLocked || Boolean(removingToken)}
                  value={parentForm.noteToInstructor}
                  onChange={(event) => setParentForm((prev) => ({ ...prev, noteToInstructor: event.target.value }))}
                />
              </label>
            </section>

            {removeError ? <p className={styles.errorText}>{removeError}</p> : null}
            {removeSuccess ? <p className={styles.successText}>{removeSuccess}</p> : null}
            {submitError ? <p className={styles.errorText}>{submitError}</p> : null}
            {submitSuccess ? <p className={styles.successText}>{submitSuccess}</p> : null}

            <button type="submit" disabled={!canSubmit} className={styles.submitButton}>
              {submitting ? '수정 중...' : '수정 저장'}
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
