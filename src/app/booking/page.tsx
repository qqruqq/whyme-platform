'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from './page.module.css'

type YesNo = 'yes' | 'no' | ''

type BookingForm = {
    classDate: string
    classHour: string
    classMinute: string
    instructorName: string
    location: string
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
    classHour: '',
    classMinute: '',
    instructorName: '',
    location: '',
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

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = ['00', '30']
const LOCATION_OPTIONS = ['와이미 교육센터', '광주', '대전/세종', '부산', '제주']
const CHANNEL_OPTIONS = [
    '유튜브 채널',
    'SNS (인스타그램 등)',
    '네이버 검색 (블로그 등)',
    '지인추천',
    '학교/기관 안내',
    '도서/방송',
    '기타',
]

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

type YesNoFieldProps = {
    legend: string
    name: string
    value: YesNo
    onChange: (next: YesNo) => void
}

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
                    네, 있어요
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
    )
}

export default function BookingPage() {
    const [form, setForm] = useState<BookingForm>(INITIAL_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<BookingSuccess | null>(null)
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

    const resolvedLocation = form.location
    const resolvedChannel = form.acquisitionChannel === '기타' ? form.acquisitionEtc.trim() : form.acquisitionChannel

    const canSubmit = useMemo(() => {
        return Boolean(
            form.classDate &&
                form.classHour &&
                form.classMinute &&
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
        form.classHour,
        form.classMinute,
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
            classTime: `${form.classHour}:${form.classMinute}`,
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
        <main className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroGlowA} />
                <div className={styles.heroGlowB} />
                <p className={styles.heroBadge}>WhyMe Booking</p>
                <h1 className={`font-display ${styles.heroTitle}`}>대표 학부모 신청 정보 입력</h1>
                <p className={styles.heroDescription}>
                    신청 정보를 입력하면 바로 관리 링크가 발급됩니다. 이후 팀원 초대와 명단 확인을 이어서 진행할 수 있습니다.
                </p>
                <Link href="/" className={styles.backLink}>
                    홈으로 돌아가기
                </Link>
            </section>

            <section className={styles.layout}>
                <form onSubmit={onSubmit} className={styles.formPanel}>
                    <section className={styles.block}>
                        <h2 className={styles.blockTitle}>교육 정보</h2>
                        <div className={styles.gridTwo}>
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
                                <div className={styles.timePicker}>
                                    <select
                                        required
                                        value={form.classHour}
                                        onChange={(event) =>
                                            setForm((prev) => ({ ...prev, classHour: event.target.value }))
                                        }
                                    >
                                        <option value="">시</option>
                                        {HOURS.map((hour) => (
                                            <option key={hour} value={hour}>
                                                {hour}시
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        required
                                        value={form.classMinute}
                                        onChange={(event) =>
                                            setForm((prev) => ({ ...prev, classMinute: event.target.value }))
                                        }
                                    >
                                        <option value="">분</option>
                                        {MINUTES.map((minute) => (
                                            <option key={minute} value={minute}>
                                                {minute}분
                                            </option>
                                        ))}
                                    </select>
                                </div>
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

                    </section>

                    <section className={styles.block}>
                        <h2 className={styles.blockTitle}>대표 학부모 정보</h2>
                        <div className={styles.gridTwo}>
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

                        <div className={styles.gridTwo}>
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
                    </section>

                    <section className={styles.block}>
                        <h2 className={styles.blockTitle}>학생 정보</h2>
                        <label className={styles.field}>
                            <span>자녀 이름</span>
                            <input
                                required
                                value={form.childName}
                                onChange={(event) => setForm((prev) => ({ ...prev, childName: event.target.value }))}
                                placeholder="교육에 참여하는 자녀 이름"
                            />
                        </label>

                        <YesNoField
                            legend="교육에 참여하는 학생이 학교 성교육 외 별도의 성교육 경험(와이미 포함)이 있나요?"
                            name="priorStudentAttended"
                            value={form.priorStudentAttended}
                            onChange={(next) => setForm((prev) => ({ ...prev, priorStudentAttended: next }))}
                        />

                        <YesNoField
                            legend="교육에 참여하는 학생의 형제/자매가 와이미 성교육 경험이 있나요?"
                            name="siblingsPriorAttended"
                            value={form.siblingsPriorAttended}
                            onChange={(next) => setForm((prev) => ({ ...prev, siblingsPriorAttended: next }))}
                        />

                        <YesNoField
                            legend="교육에 참여하는 학생의 부모님이 학교 성교육 외 별도의 성교육 경험(와이미 포함)이 있나요?"
                            name="parentPriorAttended"
                            value={form.parentPriorAttended}
                            onChange={(next) => setForm((prev) => ({ ...prev, parentPriorAttended: next }))}
                        />
                    </section>

                    <section className={styles.block}>
                        <h2 className={styles.blockTitle}>추가 정보</h2>
                        <label className={styles.field}>
                            <span>강사님에게 전달할 사항</span>
                            <div className={styles.noteGuide}>
                                <p className={styles.noteGuideTitle}>교육 시 강사가 알아두어야 할 학생의 특이사항</p>
                                <ul>
                                    <li>ADHD 약을 복용하고 있어요. 다소 산만한 모습을 보일 수도 있으니 양해 부탁드려요.</li>
                                    <li>이전 다른 교육에서 들었던 내용으로 인해, 성교육에 대한 거부감이 매우 커요.</li>
                                    <li>어려서 아버지를 여읜 터라, 해당 부분만 언급 조심 부탁드려요.</li>
                                    <li>학교에서 심한 장난과 성적인 욕설로 몇 번 문제를 겪었어요.</li>
                                    <li>참석 아이들 모두 포경수술을 했어요.</li>
                                </ul>
                                <p className={styles.noteGuideTitle}>교육 시 집중 전달 또는 언급 자제 요청사항</p>
                                <ul>
                                    <li>세 명 모두 미디어 노출이 없어서 또래보다 어려요. 잘 맞춰서 교육 부탁드려요.</li>
                                    <li>아이가 이성에 관심이 많습니다. SNS나 유튜브 등 미디어 이용 시 주의점 잘 알려주시면 좋겠어요.</li>
                                    <li>좋아하는 사람에 대한 지켜야할 선과 책임감에 대해 콕 짚어주시기 바라요.</li>
                                    <li>동성애를 무조건 존중해야 한다거나 성별을 선택할 수 있다는 내용 등은 원하지 않아요.</li>
                                </ul>
                            </div>
                            <textarea
                                rows={4}
                                value={form.noteToInstructor}
                                onChange={(event) => setForm((prev) => ({ ...prev, noteToInstructor: event.target.value }))}
                                placeholder="강사님께 전달하고 싶은 내용을 자유롭게 작성해 주세요."
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
                    </section>

                    {error ? <p className={styles.errorText}>{error}</p> : null}

                    <button type="submit" disabled={!canSubmit || submitting} className={styles.submitButton}>
                        {submitting ? '등록 중...' : '신청 정보 등록하기'}
                    </button>
                </form>

                <aside className={styles.summaryPanel}>
                    <h2 className={`font-display ${styles.summaryTitle}`}>등록 결과</h2>
                    {result ? (
                        <div className={styles.resultBox}>
                            <p className={styles.resultMessage}>입력이 완료되었습니다. 아래 관리 링크를 저장해 주세요.</p>

                            <p className={styles.resultLabel}>그룹 ID</p>
                            <p className={styles.resultValue}>{result.groupId}</p>

                            <p className={styles.resultLabel}>관리 링크</p>
                            <a className={styles.resultLink} href={result.manageUrl}>
                                {result.manageUrl}
                            </a>

                            <button type="button" className={styles.copyButton} onClick={onCopyManageUrl}>
                                관리 링크 복사
                            </button>

                            {copyState === 'copied' ? <p className={styles.copyState}>클립보드에 복사했습니다.</p> : null}
                            {copyState === 'failed' ? <p className={styles.copyError}>복사에 실패했습니다. 직접 복사해 주세요.</p> : null}
                        </div>
                    ) : (
                        <div className={styles.placeholderCard}>
                            <p>신청을 완료하면 관리 링크가 여기에 표시됩니다.</p>
                            <p>관리 링크에서 팀원 초대 링크를 만들 수 있습니다.</p>
                        </div>
                    )}
                </aside>
            </section>
        </main>
    )
}
