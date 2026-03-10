import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import PublicHeader from '@/components/public/PublicHeader'
import HorizontalCarousel from '@/components/HorizontalCarousel'
import ScrollReveal from '@/components/ScrollReveal'
import { getPublicLandingContent } from '@/lib/landing-content'
import styles from '../page.module.css'

export default async function InstructorsPage() {
    noStore()
    const { instructors } = await getPublicLandingContent()

    return (
        <main className={styles.page}>
            <ScrollReveal />
            <PublicHeader activePath="/instructors" />

            <section className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h1 className={`font-display ${styles.sectionTitle}`}>강사 소개</h1>
                    <p className={styles.sectionLead}>현장 경험과 소통 역량을 갖춘 WHYME 전문 강사진</p>
                </div>
                <HorizontalCarousel ariaLabel="강사 소개 슬라이드" autoPlayMs={2800} itemMinWidth={260}>
                    {instructors.map((item, index) => (
                        <article
                            key={item.id}
                            className={styles.instructorCard}
                            data-reveal
                            data-reveal-delay={String(60 + index * 70)}
                        >
                            <p className={styles.role}>{item.role}</p>
                            <h3 className={styles.cardTitle}>{item.name}</h3>
                            <p className={styles.cardSub}>{item.summary}</p>
                            <p className={styles.cardText}>{item.description}</p>
                        </article>
                    ))}
                </HorizontalCarousel>
            </section>

            <section className={styles.footerCta} data-reveal>
                <div data-reveal data-reveal-delay="20">
                    <h2 className={`font-display ${styles.footerTitle}`}>프로그램까지 이어서 확인해보세요</h2>
                    <p className={styles.footerText}>강사진과 프로그램을 함께 보면 팀 상황에 더 맞는 선택이 가능합니다.</p>
                </div>
                <div className={styles.footerActions} data-reveal data-reveal-delay="90">
                    <Link href="/programs" className={styles.secondaryButton}>
                        교육프로그램 보기
                    </Link>
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                </div>
            </section>
        </main>
    )
}
