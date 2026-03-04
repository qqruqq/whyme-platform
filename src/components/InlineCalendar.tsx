'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './InlineCalendar.module.css'

export type InlineCalendarDayBadge = {
  primary?: string
  secondary?: string
}

export type InlineCalendarDayItem = {
  id: string
  label: string
  selected?: boolean
}

export type InlineCalendarDayItemSelectPayload = {
  date: string
  itemId: string
  anchorRect: DOMRectReadOnly
}

export type InlineCalendarDateSelectPayload = {
  date: string
  anchorRect: DOMRectReadOnly
}

export type InlineCalendarDateRangeSelectPayload = {
  startDate: string
  endDate: string
  anchorRect: DOMRectReadOnly
}

type InlineCalendarProps = {
  value: string
  onChange: (nextValue: string) => void
  onDateSelect?: (payload: InlineCalendarDateSelectPayload) => void
  onDateRangeSelect?: (payload: InlineCalendarDateRangeSelectPayload) => void
  dayBadges?: Record<string, InlineCalendarDayBadge>
  dayItems?: Record<string, InlineCalendarDayItem[]>
  onDayItemSelect?: (payload: InlineCalendarDayItemSelectPayload) => void
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

function normalizeDateRange(firstDate: string, secondDate: string): [string, string] {
  return firstDate <= secondDate ? [firstDate, secondDate] : [secondDate, firstDate]
}

export default function InlineCalendar({
  value,
  onChange,
  onDateSelect,
  onDateRangeSelect,
  dayBadges,
  dayItems,
  onDayItemSelect,
}: InlineCalendarProps) {
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

  const monthLabel = `${displayMonth.getFullYear()}년 ${pad2(displayMonth.getMonth() + 1)}월`
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartDate, setDragStartDate] = useState<string | null>(null)
  const [dragEndDate, setDragEndDate] = useState<string | null>(null)
  const dragAnchorRectRef = useRef<DOMRectReadOnly | null>(null)
  const dragMovedRef = useRef(false)
  const suppressDateClickRef = useRef(false)

  const activeDragRange = useMemo(() => {
    if (!isDragging || !dragStartDate || !dragEndDate) return null
    const [startDate, endDate] = normalizeDateRange(dragStartDate, dragEndDate)
    return { startDate, endDate }
  }, [dragEndDate, dragStartDate, isDragging])

  const finishDragSelection = useCallback(() => {
    if (!isDragging || !dragStartDate || !dragEndDate) return

    const [startDate, endDate] = normalizeDateRange(dragStartDate, dragEndDate)
    const movedAcrossDates = dragMovedRef.current && startDate !== endDate
    const anchorRect = dragAnchorRectRef.current

    setIsDragging(false)
    setDragStartDate(null)
    setDragEndDate(null)
    dragMovedRef.current = false

    if (!movedAcrossDates || !anchorRect) {
      return
    }

    suppressDateClickRef.current = true
    onChange(startDate)
    onDateRangeSelect?.({
      startDate,
      endDate,
      anchorRect,
    })
  }, [dragEndDate, dragStartDate, isDragging, onChange, onDateRangeSelect])

  useEffect(() => {
    if (!isDragging) return

    const handleWindowMouseUp = () => {
      finishDragSelection()
    }

    window.addEventListener('mouseup', handleWindowMouseUp)

    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [finishDragSelection, isDragging])

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
                  const badge = dayBadges?.[nextValue]
                  const hasBadge = Boolean(badge?.primary || badge?.secondary)
                  const allItems = dayItems?.[nextValue] ?? []
                  const items = isCurrentMonth ? allItems : []
                  const hasItems = items.length > 0
                  const isInDragRange = activeDragRange
                    ? nextValue >= activeDragRange.startDate && nextValue <= activeDragRange.endDate
                    : false
                  const isDragRangeStart = activeDragRange ? nextValue === activeDragRange.startDate : false
                  const isDragRangeEnd = activeDragRange ? nextValue === activeDragRange.endDate : false

                  return (
                    <td key={nextValue}>
                      <div
                        className={[
                          styles.dayCell,
                          hasItems ? styles.dayCellWithItems : '',
                          isSelected ? styles.dayCellSelected : '',
                          isToday ? styles.dayCellToday : '',
                          isInDragRange ? styles.dayCellInRange : '',
                          isDragRangeStart ? styles.dayCellRangeStart : '',
                          isDragRangeEnd ? styles.dayCellRangeEnd : '',
                          isWeekend ? styles.dayCellWeekend : '',
                          !isCurrentMonth ? styles.dayCellOutside : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onMouseDown={(event) => {
                          if (event.button !== 0) return

                          const target = event.target as HTMLElement | null
                          if (target?.closest('[data-calendar-item="true"]')) return

                          dragAnchorRectRef.current = event.currentTarget.getBoundingClientRect()
                          dragMovedRef.current = false
                          setIsDragging(true)
                          setDragStartDate(nextValue)
                          setDragEndDate(nextValue)
                        }}
                        onMouseEnter={(event) => {
                          if (!isDragging || !dragStartDate) return

                          if (dragEndDate !== nextValue) {
                            dragMovedRef.current = true
                            setDragEndDate(nextValue)
                          }

                          dragAnchorRectRef.current = event.currentTarget.getBoundingClientRect()
                        }}
                      >
                        <div className={styles.dayHeader}>
                          <button
                            type="button"
                            className={styles.dayNumberButton}
                            onClick={(event) => {
                              if (suppressDateClickRef.current) {
                                suppressDateClickRef.current = false
                                return
                              }

                              onChange(nextValue)
                              onDateSelect?.({
                                date: nextValue,
                                anchorRect: event.currentTarget.getBoundingClientRect(),
                              })
                            }}
                            aria-selected={isSelected}
                          >
                            {day.getDate()}
                          </button>
                          {hasBadge ? (
                            <span className={styles.badgeStack}>
                              {badge?.primary ? <span className={styles.badgePrimary}>{badge.primary}</span> : null}
                              {badge?.secondary ? <span className={styles.badgeSecondary}>{badge.secondary}</span> : null}
                            </span>
                          ) : null}
                        </div>

                        {hasItems ? (
                          <span className={styles.itemList}>
                            {items.map((item) =>
                              onDayItemSelect ? (
                                <button
                                  key={`${nextValue}-item-${item.id}`}
                                  type="button"
                                  data-calendar-item="true"
                                  className={
                                    item.selected ? `${styles.itemButton} ${styles.itemButtonSelected}` : styles.itemButton
                                  }
                                  onClick={(event) =>
                                    onDayItemSelect({
                                      date: nextValue,
                                      itemId: item.id,
                                      anchorRect: event.currentTarget.getBoundingClientRect(),
                                    })
                                  }
                                >
                                  {item.label}
                                </button>
                              ) : (
                                <span key={`${nextValue}-item-${item.id}`} className={styles.itemRow}>
                                  {item.label}
                                </span>
                              )
                            )}
                          </span>
                        ) : null}
                      </div>
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
