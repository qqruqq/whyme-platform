import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import HorizontalCarousel from '@/components/HorizontalCarousel'
import PublicHeader from '@/components/public/PublicHeader'
import ScrollReveal from '@/components/ScrollReveal'
import { getPublicLandingContent } from '@/lib/landing-content'
import { brandCards, curriculumSteps, faqItems, newsItems } from '@/lib/public-content'
import styles from './page.module.css'

export default async function Home() {
    noStore()
    const { instructors: instructorItems, programs: programItems } = await getPublicLandingContent()

    return (
        <main className={styles.page}>
            <ScrollReveal />
            <PublicHeader />

            <section id="brand" className={styles.hero} data-reveal data-reveal-delay="0">
                <div className={styles.heroInner}>
                    <div className={styles.heroContent} data-reveal data-reveal-delay="40">
                        <p className={styles.eyebrow}>WHYME BRAND EXPERIENCE</p>
                        <h1 className={`font-display ${styles.heroTitle}`}>와이미 소그룹 성교육 (남학생)</h1>
                        <p className={styles.heroText}>
                            학생에게는 안전한 관계 감각을, 학부모에게는 신뢰 가능한 교육 운영을 제공합니다.
                            전문 강사진이 학년별 맞춤 수업과 사후 연결까지 책임집니다.
                        </p>
                        <div className={styles.heroTagRow}>
                            <span className={styles.heroTag}>소그룹 중심</span>
                            <span className={styles.heroTag}>개별 맞춤 가능</span>
                            <span className={styles.heroTag}>학부모 연계 운영</span>
                        </div>
                        <div className={styles.heroActions}>
                            <Link href="/groupinfo" className={styles.primaryButton}>
                                소그룹 정보 입력 시작
                            </Link>
                            <Link href="/groupinfo/lookup" className={styles.secondaryButton}>
                                예약 내역 조회/수정
                            </Link>
                        </div>
                    </div>
                    <aside className={styles.heroAside} data-reveal data-reveal-delay="120">
                        <p className={styles.asideLabel}>운영 포인트</p>
                        <ul className={styles.asideList}>
                            <li>학년별 맞춤 커리큘럼 운영</li>
                            <li>학부모 요청사항 기반 수업 설계</li>
                            <li>교육 이력 누적으로 연속성 강화</li>
                        </ul>
                        <div className={styles.asideActions}>
                            <Link href="/programs" className={styles.ghostButton}>
                                교육프로그램 보기
                            </Link>
                            <Link href="/instructors" className={styles.secondaryButton}>
                                강사진 확인
                            </Link>
                        </div>
                    </aside>
                </div>

                <div className={styles.brandCards}>
                    {brandCards.map((item, index) => (
                        <article
                            key={item.title}
                            className={styles.brandCard}
                            data-reveal
                            data-reveal-delay={String(80 + index * 70)}
                        >
                            <h3 className={styles.brandCardTitle}>{item.title}</h3>
                            <p className={styles.brandCardText}>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="news" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>와이미 소식</h2>
                    <p className={styles.sectionLead}>최근 업데이트와 운영 공지</p>
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

            <section id="programs" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>교육프로그램</h2>
                    <p className={styles.sectionLead}>목표와 상황에 맞게 선택 가능한 WHYME 라인업</p>
                </div>
                <HorizontalCarousel ariaLabel="교육 프로그램 슬라이드" autoPlayMs={2400} itemMinWidth={280}>
                    {programItems.map((item, index) => (
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

            <section id="curriculum" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>교육 커리큘럼</h2>
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

            <section id="instructors" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>강사소개</h2>
                    <p className={styles.sectionLead}>현장 경험과 소통 역량을 갖춘 WHYME 전문 강사진</p>
                </div>
                <HorizontalCarousel ariaLabel="강사 소개 슬라이드" autoPlayMs={2800} itemMinWidth={260}>
                    {instructorItems.map((item, index) => (
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

            <section id="faq" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>FAQ</h2>
                    <p className={styles.sectionLead}>자주 확인하는 운영 질문</p>
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
                    <h2 className={`font-display ${styles.footerTitle}`}>WHYME와 함께 교육 운영을 더 쉽게</h2>
                    <p className={styles.footerText}>
                        신청, 조회, 강사 운영까지 하나의 흐름으로 연결해 학부모와 실무자가 모두 편한 플랫폼을
                        제공합니다.
                    </p>
                </div>
                <div className={styles.footerActions} data-reveal data-reveal-delay="90">
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                    <Link href="/faq" className={styles.secondaryButton}>
                        FAQ 확인
                    </Link>
                </div>
            </section>
        </main>
    )
}
