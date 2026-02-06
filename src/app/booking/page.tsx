'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from './page.module.css'

type YesNo = 'yes' | 'no' | ''

type BookingForm = {
    classDate: string
    classTime: string
    instructorName: string
    location: string
    locationEtc: string
    leaderName: string
    leaderPhone: string
    cashReceiptNumber: string
    headcountDeclared: number
    childName: string
    priorStudentAttended: YesNo
    siblingsPriorAttended: YesNo
    parentPriorAttended: YesNo
    noteToInstructor: string
    acquisitionChannel: string
    acquisitionEtc: string
}

type BookingSuccess = {
    success: boolean
    groupId: string
    slotId: string
    manageToken: string
    manageUrl: string
    initialMemberCreated: boolean
    leaderEditToken: string | null
    leaderEditUrl: string | null
}

type BookingErrorPayload = {
    error?: string
    details?: {
        fieldErrors?: Record<string, string[]>
    }
}

const INITIAL_FORM: BookingForm = {
    classDate: '',
    classTime: '',
    instructorName: '',
    location: '',
    locationEtc: '',
    leaderName: '',
    leaderPhone: '',
    cashReceiptNumber: '',
    headcountDeclared: 2,
    childName: '',
    priorStudentAttended: '',
    siblingsPriorAttended: '',
    parentPriorAttended: '',
    noteToInstructor: '',
    acquisitionChannel: '',
    acquisitionEtc: '',
}

const LOCATION_OPTIONS = ['서울 강남', '서울 목동', '서울 잠실', '기타']
const CHANNEL_OPTIONS = ['지인 추천', '학교/기관 안내', '인스타그램', '네이버 검색', '기타']

function digitsOnly(value: string): string {
    return value.replace(/\D/g, '')
}

function formatPhone(value: string): string {
    const digits = digitsOnly(value).slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function answerToBoolean(value: YesNo): boolean | undefined {
    if (value === 'yes') return true
    if (value === 'no') return false
    return undefined
}

function parseError(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return '요청 처리 중 오류가 발생했습니다.'
    }

    const maybeError = payload as BookingErrorPayload
    const fieldErrors = maybeError.details?.fieldErrors
    if (fieldErrors) {
        const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0)
        if (firstField?.[0]) return firstField[0]
    }

    return maybeError.error ?? '요청 처리 중 오류가 발생했습니다.'
}

export default function BookingPage() {
    const [form, setForm] = useState<BookingForm>(INITIAL_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<BookingSuccess | null>(null)
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

    const resolvedLocation = form.location === '기타' ? form.locationEtc.trim() : form.location
    const resolvedChannel = form.acquisitionChannel === '기타' ? form.acquisitionEtc.trim() : form.acquisitionChannel
    const slotPreview = `${form.classDate || 'YYYY-MM-DD'}-${form.classTime || 'HH:mm'}-${form.instructorName.trim() || '강사명'}`

    const canSubmit = useMemo(() => {
        return Boolean(
            form.classDate &&
                form.classTime &&
                form.instructorName.trim() &&
                resolvedLocation &&
                form.leaderName.trim() &&
                digitsOnly(form.leaderPhone).length >= 10 &&
                form.childName.trim() &&
                form.priorStudentAttended &&
                form.siblingsPriorAttended &&
                form.parentPriorAttended &&
                resolvedChannel
        )
    }, [
        form.classDate,
        form.classTime,
        form.instructorName,
        resolvedLocation,
        form.leaderName,
        form.leaderPhone,
        form.childName,
        form.priorStudentAttended,
        form.siblingsPriorAttended,
        form.parentPriorAttended,
        resolvedChannel,
    ])

    const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit || submitting) return

        setSubmitting(true)
        setError(null)
        setResult(null)
        setCopyState('idle')

        const payload = {
            classDate: form.classDate,
            classTime: form.classTime,
            instructorName: form.instructorName.trim(),
            location: resolvedLocation,
            leaderName: form.leaderName.trim(),
            leaderPhone: form.leaderPhone,
            cashReceiptNumber: form.cashReceiptNumber.trim() || undefined,
            headcountDeclared: form.headcountDeclared,
            childName: form.childName.trim(),
            priorStudentAttended: answerToBoolean(form.priorStudentAttended),
            siblingsPriorAttended: answerToBoolean(form.siblingsPriorAttended),
            parentPriorAttended: answerToBoolean(form.parentPriorAttended),
            noteToInstructor: form.noteToInstructor.trim() || undefined,
            acquisitionChannel: resolvedChannel,
        }

        try {
            const response = await fetch('/api/booking/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            const data: unknown = await response.json().catch(() => null)
            if (!response.ok) {
                setError(parseError(data))
                return
            }

            setResult(data as BookingSuccess)
        } catch (_err) {
            setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setSubmitting(false)
        }
    }

    const onCopyManageUrl = async () => {
        if (!result) return

        try {
            await navigator.clipboard.writeText(result.manageUrl)
            setCopyState('copied')
        } catch (_err) {
            setCopyState('failed')
        }
    }

    return (
        <main className={styles.shell}>
            <section className={styles.hero}>
                <div className={styles.petalA} />
                <div className={styles.petalB} />
                <div className={styles.petalC} />
                <p className={styles.eyebrow}>대표 학부모 입력 페이지</p>
                <h1 className={`font-display ${styles.title}`}>신청 정보 입력</h1>
                <p className={styles.description}>
                    아래 내용을 입력해 주세요. 교육 일정과 강사명으로 슬롯이 자동 연결되고, 등록이 끝나면 관리 링크가 발급됩니다.
                </p>
                <Link href="/" className={styles.backLink}>
                    홈으로 돌아가기
                </Link>
            </section>

            <section className={styles.formCard}>
                <form onSubmit={onSubmit} className={styles.form}>
                    <div className={styles.row}>
                        <label className={styles.field}>
                            <span>교육 일정 (날짜)</span>
                            <input
                                required
                                type="date"
                                value={form.classDate}
                                onChange={(event) => setForm((prev) => ({ ...prev, classDate: event.target.value }))}
                            />
                        </label>

                        <label className={styles.field}>
                            <span>교육 일정 (시간)</span>
                            <input
                                required
                                type="time"
                                value={form.classTime}
                                onChange={(event) => setForm((prev) => ({ ...prev, classTime: event.target.value }))}
                            />
                        </label>
                    </div>

                    <label className={styles.field}>
                        <span>강사명</span>
                        <input
                            required
                            value={form.instructorName}
                            onChange={(event) => setForm((prev) => ({ ...prev, instructorName: event.target.value }))}
                            placeholder="예: 김와이미 강사"
                        />
                    </label>

                    <label className={styles.field}>
                        <span>자동 생성 슬롯 키</span>
                        <input value={slotPreview} readOnly className={styles.readOnlyInput} />
                    </label>

                    <label className={styles.field}>
                        <span>교육장소 선택</span>
                        <select
                            required
                            value={form.location}
                            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                        >
                            <option value="">선택해 주세요</option>
                            {LOCATION_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    {form.location === '기타' ? (
                        <label className={styles.field}>
                            <span>교육장소 직접 입력</span>
                            <input
                                required
                                value={form.locationEtc}
                                onChange={(event) => setForm((prev) => ({ ...prev, locationEtc: event.target.value }))}
                                placeholder="교육 장소를 입력해 주세요"
                            />
                        </label>
                    ) : null}

                    <div className={styles.row}>
                        <label className={styles.field}>
                            <span>대표 학부모 이름</span>
                            <input
                                required
                                value={form.leaderName}
                                onChange={(event) => setForm((prev) => ({ ...prev, leaderName: event.target.value }))}
                                placeholder="이름 입력"
                            />
                        </label>

                        <label className={styles.field}>
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
                        </label>
                    </div>

                    <div className={styles.row}>
                        <label className={styles.field}>
                            <span>현금영수증 번호 (선택)</span>
                            <input
                                inputMode="numeric"
                                value={form.cashReceiptNumber}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        cashReceiptNumber: formatPhone(event.target.value),
                                    }))
                                }
                                placeholder="010-0000-0000"
                            />
                        </label>

                        <label className={styles.field}>
                            <span>예상 참여 인원</span>
                            <select
                                value={form.headcountDeclared}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        headcountDeclared: Number(event.target.value),
                                    }))
                                }
                            >
                                {[2, 3, 4, 5, 6].map((count) => (
                                    <option key={count} value={count}>
                                        {count}명
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className={styles.field}>
                        <span>자녀 이름</span>
                        <input
                            required
                            value={form.childName}
                            onChange={(event) => setForm((prev) => ({ ...prev, childName: event.target.value }))}
                            placeholder="교육에 참여하는 자녀 이름"
                        />
                    </label>

                    <fieldset className={styles.questionBlock}>
                        <legend>교육에 참여하는 학생이 학교 성교육 외 별도 성교육 경험(와이미 포함)이 있나요?</legend>
                        <div className={styles.radioRow}>
                            <label>
                                <input
                                    type="radio"
                                    name="priorStudentAttended"
                                    value="yes"
                                    checked={form.priorStudentAttended === 'yes'}
                                    onChange={() => setForm((prev) => ({ ...prev, priorStudentAttended: 'yes' }))}
                                />
                                예
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="priorStudentAttended"
                                    value="no"
                                    checked={form.priorStudentAttended === 'no'}
                                    onChange={() => setForm((prev) => ({ ...prev, priorStudentAttended: 'no' }))}
                                />
                                아니오
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={styles.questionBlock}>
                        <legend>교육에 참여하는 학생의 형제/자매가 와이미 성교육 경험이 있나요?</legend>
                        <div className={styles.radioRow}>
                            <label>
                                <input
                                    type="radio"
                                    name="siblingsPriorAttended"
                                    value="yes"
                                    checked={form.siblingsPriorAttended === 'yes'}
                                    onChange={() => setForm((prev) => ({ ...prev, siblingsPriorAttended: 'yes' }))}
                                />
                                예
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="siblingsPriorAttended"
                                    value="no"
                                    checked={form.siblingsPriorAttended === 'no'}
                                    onChange={() => setForm((prev) => ({ ...prev, siblingsPriorAttended: 'no' }))}
                                />
                                아니오
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={styles.questionBlock}>
                        <legend>교육에 참여하는 학생의 부모님이 학교 성교육 외 별도 성교육 경험(와이미 포함)이 있나요?</legend>
                        <div className={styles.radioRow}>
                            <label>
                                <input
                                    type="radio"
                                    name="parentPriorAttended"
                                    value="yes"
                                    checked={form.parentPriorAttended === 'yes'}
                                    onChange={() => setForm((prev) => ({ ...prev, parentPriorAttended: 'yes' }))}
                                />
                                예
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="parentPriorAttended"
                                    value="no"
                                    checked={form.parentPriorAttended === 'no'}
                                    onChange={() => setForm((prev) => ({ ...prev, parentPriorAttended: 'no' }))}
                                />
                                아니오
                            </label>
                        </div>
                    </fieldset>

                    <label className={styles.field}>
                        <span>강사님에게 전달할 사항</span>
                        <textarea
                            rows={4}
                            value={form.noteToInstructor}
                            onChange={(event) => setForm((prev) => ({ ...prev, noteToInstructor: event.target.value }))}
                            placeholder="예: 아이가 처음이라 천천히 진행 부탁드립니다."
                        />
                    </label>

                    <label className={styles.field}>
                        <span>와이미를 알게된 경로</span>
                        <select
                            required
                            value={form.acquisitionChannel}
                            onChange={(event) => setForm((prev) => ({ ...prev, acquisitionChannel: event.target.value }))}
                        >
                            <option value="">선택해 주세요</option>
                            {CHANNEL_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    {form.acquisitionChannel === '기타' ? (
                        <label className={styles.field}>
                            <span>경로 직접 입력</span>
                            <input
                                required
                                value={form.acquisitionEtc}
                                onChange={(event) =>
                                    setForm((prev) => ({ ...prev, acquisitionEtc: event.target.value }))
                                }
                                placeholder="알게 된 경로를 입력해 주세요"
                            />
                        </label>
                    ) : null}

                    {error ? <p className={styles.errorText}>{error}</p> : null}

                    <button type="submit" disabled={!canSubmit || submitting} className={styles.submitButton}>
                        {submitting ? '등록 중...' : '정보 등록하기'}
                    </button>
                </form>

                <aside className={styles.resultPanel}>
                    <h2 className={`font-display ${styles.resultTitle}`}>등록 결과</h2>
                    {result ? (
                        <div className={styles.resultBox}>
                            <p className={styles.resultMessage}>입력이 완료되었습니다. 관리 링크를 저장해 주세요.</p>

                            <p className={styles.resultLabel}>그룹 ID</p>
                            <p className={styles.resultValue}>{result.groupId}</p>

                            <p className={styles.resultLabel}>연결된 슬롯 ID</p>
                            <p className={styles.resultValue}>{result.slotId}</p>

                            <p className={styles.resultLabel}>관리 링크</p>
                            <a className={styles.resultLink} href={result.manageUrl}>
                                {result.manageUrl}
                            </a>

                            <button type="button" className={styles.copyButton} onClick={onCopyManageUrl}>
                                관리 링크 복사
                            </button>
                            {copyState === 'copied' ? <p className={styles.copyState}>클립보드에 복사했습니다.</p> : null}
                            {copyState === 'failed' ? <p className={styles.copyError}>복사에 실패했습니다. 직접 복사해 주세요.</p> : null}

                            {result.leaderEditUrl ? (
                                <>
                                    <p className={styles.resultLabel}>대표 학부모 수정 링크</p>
                                    <a className={styles.resultLink} href={result.leaderEditUrl}>
                                        {result.leaderEditUrl}
                                    </a>
                                </>
                            ) : null}
                        </div>
                    ) : (
                        <p className={styles.placeholder}>
                            입력을 완료하면 관리 링크와 슬롯 연결 결과가 표시됩니다.
                        </p>
                    )}
                </aside>
            </section>
        </main>
    )
}
