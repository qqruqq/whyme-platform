'use client'

import { useEffect } from 'react'

const DEFAULT_REVEAL_STEP_MS = 70
const MAX_REVEAL_DELAY_MS = 280

export default function ScrollReveal() {
    useEffect(() => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
        if (!nodes.length) {
            return
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) {
            nodes.forEach((node) => {
                node.dataset.revealVisible = 'true'
            })
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return
                    }

                    const node = entry.target as HTMLElement
                    node.dataset.revealVisible = 'true'
                    observer.unobserve(node)
                })
            },
            {
                threshold: 0.18,
                rootMargin: '0px 0px -10% 0px',
            },
        )

        nodes.forEach((node, index) => {
            const declaredDelay = Number(node.dataset.revealDelay ?? '')
            const fallbackDelay = Math.min((index % 5) * DEFAULT_REVEAL_STEP_MS, MAX_REVEAL_DELAY_MS)
            const delay = Number.isFinite(declaredDelay) ? declaredDelay : fallbackDelay
            node.style.setProperty('--reveal-delay', `${delay}ms`)
            observer.observe(node)
        })

        return () => {
            observer.disconnect()
        }
    }, [])

    return null
}
