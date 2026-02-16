'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import styles from './page.module.css'

type LookupForm = {
    classDate: string
    classHour: string
    classMinute: string
    instructorName: string
    leaderPhonePrefix: string
    leaderPhoneCustomPrefix: string
    leaderPhoneSuffix: string
}

type LookupSuccess = {
    manageToken: string
}

type LookupErrorPayload = {
    error?: string
    details?: {
        fieldErrors?: Record<string, string[]>
    }
}

const INITIAL_FORM: LookupForm = {
    classDate: '',
    classHour: '',
    classMinute: '',
    instructorName: '',
    leaderPhonePrefix: '010',
    leaderPhoneCustomPrefix: '',
    leaderPhoneSuffix: '',
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = ['00', '30']
const INSTRUCTOR_OPTIONS = ['이시훈 대표강사']
const DIRECT_PHONE_PREFIX = 'direct'
const PHONE_PREFIX_OPTIONS = ['010', '011', '016', '017', '018', '019']

function digitsOnly(value: string): string {
    return value.replace(/\D/g, '')
}

function normalizePhonePrefix(value: string): string {
    return digitsOnly(value).slice(0, 3)
}

function normalizePhoneSuffix(value: string): string {
    return digitsOnly(value).slice(0, 8)
}

function resolvePhonePrefix(selected: string, custom: string): string {
    if (selected === DIRECT_PHONE_PREFIX) {
        return normalizePhonePrefix(custom)
    }

    return normalizePhonePrefix(selected)
}

function composePhoneNumber(prefix: string, suffix: string): string {
    return `${normalizePhonePrefix(prefix)}${normalizePhoneSuffix(suffix)}`
}

function parseError(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return '조회 중 오류가 발생했습니다.'
    }

    const maybeError = payload as LookupErrorPayload
    const fieldErrors = maybeError.details?.fieldErrors
    if (fieldErrors) {
        const firstField = Object.values(fieldErrors).find((messages) => messages.length > 0)
        if (firstField?.[0]) return firstField[0]
    }

    return maybeError.error ?? '조회 중 오류가 발생했습니다.'
}

export default function BookingLookupPage() {
    const router = useRouter()
    const [form, setForm] = useState<LookupForm>(INITIAL_FORM)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const leaderPhonePrefix = resolvePhonePrefix(form.leaderPhonePrefix, form.leaderPhoneCustomPrefix)
    const leaderPhoneSuffix = normalizePhoneSuffix(form.leaderPhoneSuffix)
    const leaderPhone = composePhoneNumber(leaderPhonePrefix, leaderPhoneSuffix)
    const hasValidLeaderPhone = leaderPhonePrefix.length === 3 && leaderPhoneSuffix.length === 8

    const canSubmit = useMemo(() => {
        return Boolean(
            form.classDate &&
                form.classHour &&
                form.classMinute &&
                form.instructorName.trim() &&
                hasValidLeaderPhone
        )
    }, [form.classDate, form.classHour, form.classMinute, form.instructorName, hasValidLeaderPhone])

    const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit || loading) return

        setLoading(true)
        setError(null)

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
                    leaderPhone,
                }),
            })

            const data: unknown = await response.json().catch(() => null)

            if (!response.ok) {
                setError(parseError(data))
                return
            }

            const lookupResult = data as LookupSuccess
            router.replace(`/manage/${lookupResult.manageToken}`)
        } catch (_err) {
            setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className={styles.page}>
            <section className={styles.panel}>
                <p className={styles.badge}>Reservation Lookup</p>
                <h1 className={`font-display ${styles.title}`}>예약 내역 조회</h1>
                <p className={styles.description}>
                    예약 당시 입력한 일정, 강사명, 대표 학부모 연락처로 그룹 예약을 조회할 수 있습니다.
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
                        <select
                            required
                            value={form.instructorName}
                            onChange={(event) => setForm((prev) => ({ ...prev, instructorName: event.target.value }))}
                        >
                            <option value="">선택해 주세요</option>
                            {INSTRUCTOR_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <span>대표 학부모 연락처</span>
                        <div
                            className={
                                form.leaderPhonePrefix === DIRECT_PHONE_PREFIX
                                    ? `${styles.phoneRow} ${styles.phoneRowCustom}`
                                    : styles.phoneRow
                            }
                        >
                            <select
                                value={form.leaderPhonePrefix}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        leaderPhonePrefix: event.target.value,
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
                            {form.leaderPhonePrefix === DIRECT_PHONE_PREFIX ? (
                                <input
                                    required
                                    inputMode="numeric"
                                    maxLength={3}
                                    value={form.leaderPhoneCustomPrefix}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            leaderPhoneCustomPrefix: normalizePhonePrefix(event.target.value),
                                        }))
                                    }
                                    placeholder="앞 3자리"
                                />
                            ) : null}
                            <input
                                required
                                inputMode="numeric"
                                maxLength={8}
                                value={form.leaderPhoneSuffix}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        leaderPhoneSuffix: normalizePhoneSuffix(event.target.value),
                                    }))
                                }
                                placeholder="뒤 8자리"
                            />
                        </div>
                    </div>

                    {error ? <p className={styles.errorText}>{error}</p> : null}

                    <button type="submit" disabled={!canSubmit || loading} className={styles.submitButton}>
                        {loading ? '조회 중...' : '예약 내역 조회하기'}
                    </button>
                </form>
            </section>
        </main>
    )
}
