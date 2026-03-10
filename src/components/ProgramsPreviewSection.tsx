'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import HorizontalCarousel from '@/components/HorizontalCarousel'
import styles from '@/app/page.module.css'

type ProgramItem = {
    id: string
    title: string
    description: string
    points: string[]
    color: string
}

type ProgramsPreviewSectionProps = {
    programItems: ProgramItem[]
}

export default function ProgramsPreviewSection({ programItems }: ProgramsPreviewSectionProps) {
    const router = useRouter()

    const onSectionClick: React.MouseEventHandler<HTMLElement> = (event) => {
        const target = event.target as HTMLElement
        if (target.closest('a,button,input,select,textarea,[role="button"]')) {
            return
        }
        router.push('/programs')
    }

    return (
        <section id="programs" className={`${styles.section} ${styles.sectionClickable}`} data-reveal onClick={onSectionClick}>
            <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                <h2 className={styles.sectionTitle}>교육프로그램</h2>
                <p className={styles.sectionLead}>목표와 상황에 맞게 선택 가능한 WHYME 라인업</p>
            </div>
            <HorizontalCarousel ariaLabel="교육 프로그램 슬라이드" autoPlayMs={2400} itemMinWidth={280}>
                {programItems.map((item, index) => (
                    <Link key={item.id} href={`/programs/${item.id}`} className={styles.cardLink}>
                        <article
                            className={styles.programCard}
                            data-reveal
                            data-reveal-delay={String(60 + index * 65)}
                            style={{
                                borderColor: item.color,
                                boxShadow: `0 16px 28px color-mix(in srgb, ${item.color} 18%, transparent)`,
                            }}
                        >
                            <span className={styles.programChip} style={{ backgroundColor: item.color }}>
                                PROGRAM
                            </span>
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            <p className={styles.cardText}>{item.description}</p>
                            <ul className={styles.programList}>
                                {item.points.map((point) => (
                                    <li key={point}>{point}</li>
                                ))}
                            </ul>
                        </article>
                    </Link>
                ))}
            </HorizontalCarousel>
        </section>
    )
}
