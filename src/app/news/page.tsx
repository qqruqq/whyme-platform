import Link from 'next/link'
import PublicHeader from '@/components/public/PublicHeader'
import ScrollReveal from '@/components/ScrollReveal'
import { newsItems } from '@/lib/public-content'
import styles from '../page.module.css'

export default function NewsPage() {
    return (
        <main className={styles.page}>
            <ScrollReveal />
            <PublicHeader activePath="/news" />

            <section className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h1 className={`font-display ${styles.sectionTitle}`}>와이미 소식</h1>
                    <p className={styles.sectionLead}>최근 업데이트와 운영 공지를 확인하세요.</p>
                </div>
                <div className={styles.newsGrid}>
                    {newsItems.map((item, index) => (
                        <article
                            key={item.title}
                            className={styles.newsCard}
                            data-reveal
                            data-reveal-delay={String(60 + index * 75)}
                        >
                            <p className={styles.newsDate}>{item.date}</p>
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            <p className={styles.cardText}>{item.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className={styles.footerCta} data-reveal>
                <div data-reveal data-reveal-delay="20">
                    <h2 className={`font-display ${styles.footerTitle}`}>교육이 필요하신가요?</h2>
                    <p className={styles.footerText}>원하는 일정과 교육 정보를 입력하면 빠르게 안내해드립니다.</p>
                </div>
                <div className={styles.footerActions} data-reveal data-reveal-delay="90">
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                    <Link href="/programs" className={styles.secondaryButton}>
                        교육프로그램 보기
                    </Link>
                </div>
            </section>
        </main>
    )
}
