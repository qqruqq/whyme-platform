import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import PublicHeader from '@/components/public/PublicHeader'
import HorizontalCarousel from '@/components/HorizontalCarousel'
import ScrollReveal from '@/components/ScrollReveal'
import { getPublicLandingContent } from '@/lib/landing-content'
import styles from '../page.module.css'

export default async function ProgramsPage() {
    noStore()
    const { programs } = await getPublicLandingContent()

    return (
        <main className={styles.page}>
            <ScrollReveal />
            <PublicHeader activePath="/programs" />

            <section className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h1 className={`font-display ${styles.sectionTitle}`}>교육프로그램</h1>
                    <p className={styles.sectionLead}>목표와 상황에 맞게 선택 가능한 WHYME 라인업</p>
                </div>
                <HorizontalCarousel ariaLabel="교육 프로그램 슬라이드" autoPlayMs={2400} itemMinWidth={280}>
                    {programs.map((item, index) => (
                        <article
                            key={item.id}
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
                    ))}
                </HorizontalCarousel>
            </section>

            <section className={styles.footerCta} data-reveal>
                <div data-reveal data-reveal-delay="20">
                    <h2 className={`font-display ${styles.footerTitle}`}>커리큘럼 흐름도 함께 확인하세요</h2>
                    <p className={styles.footerText}>사전 진단부터 사후 공유까지, 수업의 연결 구조를 확인할 수 있습니다.</p>
                </div>
                <div className={styles.footerActions} data-reveal data-reveal-delay="90">
                    <Link href="/curriculum" className={styles.secondaryButton}>
                        교육 커리큘럼 보기
                    </Link>
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                </div>
            </section>
        </main>
    )
}
