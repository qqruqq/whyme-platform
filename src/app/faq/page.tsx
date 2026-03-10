import Link from 'next/link'
import PublicHeader from '@/components/public/PublicHeader'
import ScrollReveal from '@/components/ScrollReveal'
import { faqItems } from '@/lib/public-content'
import styles from '../page.module.css'

export default function FaqPage() {
    return (
        <main className={styles.page}>
            <ScrollReveal />
            <PublicHeader activePath="/faq" />

            <section className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h1 className={`font-display ${styles.sectionTitle}`}>FAQ</h1>
                    <p className={styles.sectionLead}>예약과 운영에서 자주 확인하는 질문</p>
                </div>
                <div className={styles.faqList}>
                    {faqItems.map((item, index) => (
                        <details
                            key={item.q}
                            className={styles.faqItem}
                            data-reveal
                            data-reveal-delay={String(60 + index * 70)}
                        >
                            <summary className={styles.faqQuestion}>{item.q}</summary>
                            <p className={styles.faqAnswer}>{item.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className={styles.footerCta} data-reveal>
                <div data-reveal data-reveal-delay="20">
                    <h2 className={`font-display ${styles.footerTitle}`}>추가 문의가 있으면 바로 신청해 주세요</h2>
                    <p className={styles.footerText}>신청 시 입력한 요청사항을 기준으로 맞춤 안내를 진행합니다.</p>
                </div>
                <div className={styles.footerActions} data-reveal data-reveal-delay="90">
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                    <Link href="/groupinfo/lookup" className={styles.secondaryButton}>
                        예약 조회/수정
                    </Link>
                </div>
            </section>
        </main>
    )
}
