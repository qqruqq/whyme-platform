import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
    return (
        <main className={styles.shell}>
            <section className={styles.hero}>
                <div className={styles.glowA} />
                <div className={styles.glowB} />
                <p className={styles.badge}>WhyMe Platform</p>
                <h1 className={`font-display ${styles.title}`}>와이미 소그룹 예약</h1>
                <p className={styles.subtitle}>
                    대표 학부모가 그룹 예약을 생성하고, 이후 팀원 링크를 배포하는 내부 운영용 MVP입니다.
                </p>
                <div className={styles.ctaRow}>
                    <Link href="/booking" className={styles.primaryCta}>
                        예약 시작하기
                    </Link>
                </div>
                <p className={styles.note}>
                    예약 생성 후 발급되는 관리 링크로 팀원 초대 및 명단 상태를 확인할 수 있습니다.
                </p>
            </section>
        </main>
    )
}
