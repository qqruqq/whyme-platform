'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './InlineCalendar.module.css'

type InlineCalendarProps = {
  value: string
  onChange: (nextValue: string) => void
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function isSameDate(a: Date, b: Date): boolean {
  return isSameMonth(a, b) && a.getDate() === b.getDate()
}

export default function InlineCalendar({ value, onChange }: InlineCalendarProps) {
  const selectedDate = useMemo(() => parseDateKey(value), [value])

  const [displayMonth, setDisplayMonth] = useState<Date>(() =>
    startOfMonth(selectedDate ?? new Date())
  )

  useEffect(() => {
    if (!selectedDate) {
      return
    }

    setDisplayMonth(startOfMonth(selectedDate))
  }, [selectedDate])

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1)
    const gridStart = new Date(firstDayOfMonth)
    gridStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

    const nextDays: Date[] = []
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + index)
      nextDays.push(day)
    }

    return nextDays
  }, [displayMonth])

  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const monthLabel = `${displayMonth.getFullYear()}.${pad2(displayMonth.getMonth() + 1)}`

  return (
    <div className={styles.calendarRoot}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.monthButton}
          onClick={() => setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          aria-label="이전달"
        >
          {'<'}
        </button>
        <p className={styles.monthLabel}>{monthLabel}</p>
        <button
          type="button"
          className={styles.monthButton}
          onClick={() => setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          aria-label="다음달"
        >
          {'>'}
        </button>
      </div>

      <table className={styles.calendarTable}>
        <caption className={styles.srOnly}>달력 테이블</caption>
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, weekIndex) => (
            <tr key={weekIndex}>
              {calendarDays
                .slice(weekIndex * 7, weekIndex * 7 + 7)
                .map((day) => {
                  const isSelected = selectedDate ? isSameDate(day, selectedDate) : false
                  const isCurrentMonth = isSameMonth(day, displayMonth)
                  const isToday = isSameDate(day, today)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const nextValue = formatDateKey(day)

                  return (
                    <td key={nextValue}>
                      <button
                        type="button"
                        className={[
                          styles.dateButton,
                          isSelected ? styles.dateButtonSelected : '',
                          !isCurrentMonth ? styles.dateButtonOutside : '',
                          isToday ? styles.dateButtonToday : '',
                          isWeekend ? styles.dateButtonWeekend : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => onChange(nextValue)}
                        aria-selected={isSelected}
                      >
                        <span className={styles.dateNumber}>{day.getDate()}</span>
                      </button>
                    </td>
                  )
                })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
