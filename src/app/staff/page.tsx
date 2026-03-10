import type { Metadata } from 'next'
import Link from 'next/link'
import styles from './page.module.css'

export const metadata: Metadata = {
    title: '와이미 내부 운영자 진입',
    robots: {
        index: false,
        follow: false,
        nocache: true,
    },
}

export default function StaffEntryPage() {
    return (
        <main className={styles.page}>
            <section className={styles.panel}>
                <h1 className={`font-display ${styles.title}`}>내부 운영자 전용</h1>
                <p className={styles.description}>
                    이 페이지는 강사/실무자/관리자용 내부 진입 경로입니다. 고객 대상 메인 화면에서는 노출하지 않습니다.
                </p>
                <div className={styles.actions}>
                    <Link href="/admin/login" className={styles.primaryButton}>
                        관리자 로그인으로 이동
                    </Link>
                    <Link href="/" className={styles.secondaryButton}>
                        메인으로 돌아가기
                    </Link>
                </div>
            </section>
        </main>
    )
}
