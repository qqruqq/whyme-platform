'use client'

import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import styles from './HorizontalCarousel.module.css'

type HorizontalCarouselProps = {
    children: ReactNode
    ariaLabel: string
    autoPlayMs?: number
    itemMinWidth?: number
}

const DEFAULT_AUTO_PLAY_MS = 2600

function clampIndex(value: number, length: number): number {
    if (length <= 0) return 0
    if (value < 0) return 0
    if (value > length - 1) return length - 1
    return value
}

export default function HorizontalCarousel({
    children,
    ariaLabel,
    autoPlayMs = DEFAULT_AUTO_PLAY_MS,
    itemMinWidth = 250,
}: HorizontalCarouselProps) {
    const slides = useMemo(() => Children.toArray(children), [children])
    const slideCount = slides.length
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

    const getStep = () => {
        const viewport = viewportRef.current
        if (!viewport) return 0

        const track = viewport.querySelector<HTMLElement>('[data-carousel-track="true"]')
        const firstSlide = viewport.querySelector<HTMLElement>('[data-carousel-item="true"]')
        if (!firstSlide || !track) return viewport.clientWidth * 0.86

        const gapRaw = window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '0px'
        const gap = Number.parseFloat(gapRaw) || 0
        return firstSlide.getBoundingClientRect().width + gap
    }

    const scrollToIndex = (index: number) => {
        const viewport = viewportRef.current
        if (!viewport) return

        const step = getStep()
        const bounded = clampIndex(index, slideCount)
        viewport.scrollTo({
            left: bounded * step,
            behavior: 'smooth',
        })
    }

    const onPrev = () => {
        if (slideCount <= 1) return
        const next = activeIndex <= 0 ? slideCount - 1 : activeIndex - 1
        scrollToIndex(next)
    }

    const onNext = () => {
        if (slideCount <= 1) return
        const next = activeIndex >= slideCount - 1 ? 0 : activeIndex + 1
        scrollToIndex(next)
    }

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        const syncActive = () => {
            const step = getStep()
            if (!step) return
            const next = clampIndex(Math.round(viewport.scrollLeft / step), slideCount)
            setActiveIndex(next)
        }

        viewport.addEventListener('scroll', syncActive, { passive: true })
        syncActive()

        return () => {
            viewport.removeEventListener('scroll', syncActive)
        }
    }, [slideCount])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const apply = () => setPrefersReducedMotion(mediaQuery.matches)

        apply()
        mediaQuery.addEventListener('change', apply)
        return () => {
            mediaQuery.removeEventListener('change', apply)
        }
    }, [])

    useEffect(() => {
        if (prefersReducedMotion || isHovered || autoPlayMs <= 0 || slideCount <= 1) {
            return
        }

        const timer = window.setInterval(() => {
            const viewport = viewportRef.current
            if (!viewport) return

            const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth - 2)
            if (viewport.scrollLeft >= maxScrollLeft) {
                scrollToIndex(0)
                return
            }

            const next = activeIndex >= slideCount - 1 ? 0 : activeIndex + 1
            scrollToIndex(next)
        }, autoPlayMs)

        return () => {
            window.clearInterval(timer)
        }
    }, [activeIndex, autoPlayMs, isHovered, prefersReducedMotion, slideCount])

    return (
        <div
            className={styles.carousel}
            style={{ ['--carousel-item-min' as string]: `${itemMinWidth}px` }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button
                type="button"
                aria-label="이전 슬라이드"
                className={`${styles.navButton} ${styles.navButtonPrev}`}
                onClick={onPrev}
                disabled={slideCount <= 1}
            >
                ‹
            </button>

            <div className={styles.viewport} ref={viewportRef} aria-label={ariaLabel}>
                <div className={styles.track} data-carousel-track="true">
                    {slides.map((slide, index) => (
                        <div key={`carousel-slide-${index}`} className={styles.slide} data-carousel-item="true">
                            {slide}
                        </div>
                    ))}
                </div>
            </div>

            <button
                type="button"
                aria-label="다음 슬라이드"
                className={`${styles.navButton} ${styles.navButtonNext}`}
                onClick={onNext}
                disabled={slideCount <= 1}
            >
                ›
            </button>

            {slideCount > 1 ? (
                <div className={styles.pagination}>
                    {slides.map((_, index) => (
                        <button
                            key={`carousel-dot-${index}`}
                            type="button"
                            aria-label={`${index + 1}번 슬라이드로 이동`}
                            className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
                            onClick={() => scrollToIndex(index)}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}
