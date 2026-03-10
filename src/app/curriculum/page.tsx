import Link from 'next/link'
import PublicHeader from '@/components/public/PublicHeader'
import ScrollReveal from '@/components/ScrollReveal'
import { curriculumSteps } from '@/lib/public-content'
import styles from '../page.module.css'

export default function CurriculumPage() {
    return (
        <main className={styles.page}>
            <ScrollReveal />
            <PublicHeader activePath="/curriculum" />

            <section className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h1 className={`font-display ${styles.sectionTitle}`}>교육 커리큘럼</h1>
                    <p className={styles.sectionLead}>수업 전후를 연결하는 WHYME 운영 프로세스</p>
                </div>
                <div className={styles.curriculumGrid}>
                    {curriculumSteps.map((step, index) => (
                        <article
                            key={step.title}
                            className={styles.curriculumCard}
                            data-reveal
                            data-reveal-delay={String(60 + index * 80)}
                        >
                            <p className={styles.stepNo}>STEP {String(index + 1).padStart(2, '0')}</p>
                            <h3 className={styles.cardTitle}>{step.title}</h3>
                            <p className={styles.cardText}>{step.text}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className={styles.footerCta} data-reveal>
                <div data-reveal data-reveal-delay="20">
                    <h2 className={`font-display ${styles.footerTitle}`}>운영 질문은 FAQ에서 바로 확인하세요</h2>
                    <p className={styles.footerText}>예약, 일정 변경, 요청사항 관리 등 자주 받는 질문을 모아두었습니다.</p>
                </div>
                <div className={styles.footerActions} data-reveal data-reveal-delay="90">
                    <Link href="/faq" className={styles.secondaryButton}>
                        FAQ 보기
                    </Link>
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                </div>
            </section>
        </main>
    )
}
