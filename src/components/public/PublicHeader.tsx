import Link from 'next/link'
import { publicMenuItems } from '@/lib/public-content'
import styles from './PublicHeader.module.css'

type PublicHeaderProps = {
    activePath?: string
}

export default function PublicHeader({ activePath }: PublicHeaderProps) {
    return (
        <header className={styles.header}>
            <div className={styles.brandArea}>
                <Link href="/" className={`font-display ${styles.brandLogo}`}>
                    WHYME
                </Link>
                <p className={styles.brandTag}>성 · 미디어 교육 브랜드</p>
            </div>

            <nav className={styles.nav} aria-label="공개 메뉴">
                {publicMenuItems.map((item) => {
                    const isActive = activePath === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className={styles.headerActions}>
                <Link href="/groupinfo" className={styles.primaryButton}>
                    교육 신청하기
                </Link>
                <Link href="/groupinfo/lookup" className={styles.secondaryButton}>
                    예약 조회/수정
                </Link>
            </div>
        </header>
    )
}
