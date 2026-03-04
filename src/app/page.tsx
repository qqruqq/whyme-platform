import Link from 'next/link'
import HorizontalCarousel from '@/components/HorizontalCarousel'
import ScrollReveal from '@/components/ScrollReveal'
import styles from './page.module.css'

const navItems = [
    { label: 'whyme브랜드 소개', href: '#brand' },
    { label: '강사소개', href: '#instructors' },
    { label: '교육프로그램', href: '#programs' },
    { label: '교육 커리큘럼', href: '#curriculum' },
    { label: 'FAQ', href: '#faq' },
    { label: '와이미 소식', href: '#news' },
]

const brandCards = [
    {
        title: '성장 단계 맞춤 설계',
        description: '학년과 발달 수준에 맞춰 강의 난이도와 대화 방식을 조정해 학생 참여도를 높입니다.',
    },
    {
        title: '성·미디어 통합 교육',
        description: '관계, 경계, 디지털 문해를 함께 다뤄 현실 상황에서 바로 적용할 수 있는 감각을 기릅니다.',
    },
    {
        title: '학부모 연계 운영',
        description: '대표 학부모 요청사항과 이전 이력을 수업 준비에 반영해 연속성 있는 교육을 만듭니다.',
    },
]

const instructorItems = [
    {
        name: '이시훈 대표강사',
        role: '대표강사',
        summary: '청소년 성교육 · 미디어 리터러시',
        description: '민감한 주제를 안전하게 다루는 진행 역량과 높은 소통 밀도로 수업 몰입을 이끌어냅니다.',
    },
    {
        name: '박세림 강사',
        role: '소그룹 강사',
        summary: '또래 상호작용 중심 진행',
        description: '팀별 분위기를 빠르게 파악해 학생들이 스스로 말하고 정리하도록 토론형 수업을 운영합니다.',
    },
    {
        name: 'WHYME 협력 강사진',
        role: '전문 강사진',
        summary: '학년별 분화 커리큘럼',
        description: '학년과 주제별 강점이 다른 강사 네트워크로 학교·기관 환경에 맞춘 수업을 제공합니다.',
    },
]

const programItems = [
    {
        title: '소그룹 성교육 (남학생)',
        description: '또래 기반 토론과 활동으로 건강한 성 인식과 관계 감각을 키우는 핵심 프로그램',
        points: ['팀별 참여 활동 중심', '요청사항 반영형 수업 준비'],
        color: 'var(--program-small-group-boys)',
    },
    {
        title: '1:1 교육',
        description: '학생 성향과 속도에 맞춰 민감 주제를 깊이 있게 다루는 맞춤형 교육',
        points: ['개인 상담형 커뮤니케이션', '집중 피드백 제공'],
        color: 'var(--program-1to1)',
    },
    {
        title: '온라인 성교육',
        description: '비대면 환경에서도 집중도 높은 구조로 운영되는 라이브/녹화 혼합형 콘텐츠',
        points: ['라이브 + 복습 구조', '장소 제약 없는 참여'],
        color: 'var(--program-online-sex-ed)',
    },
    {
        title: '미디어 스쿨',
        description: '디지털 콘텐츠를 분석하고 표현하는 힘을 기르는 실습형 미디어 교육',
        points: ['디지털 문해력 강화', '표현 활동 실습'],
        color: 'var(--program-media-school)',
    },
]

const curriculumSteps = [
    {
        title: '사전 진단',
        text: '학년, 교육 경험, 학부모 요청사항을 바탕으로 수업 톤과 전달 강도를 세팅합니다.',
    },
    {
        title: '핵심 수업',
        text: '관계, 경계, 미디어 영향, 자기보호를 주제로 실제 상황 중심 활동을 진행합니다.',
    },
    {
        title: '사후 공유',
        text: '강사 특이사항 정리와 다음 수업 참고 이력 누적으로 연속성 있는 교육을 설계합니다.',
    },
]

const faqItems = [
    {
        q: '소그룹 성교육은 몇 명 기준으로 진행되나요?',
        a: '대표 학부모 자녀 포함 팀 인원 기준으로 운영하며, 그룹별 설정 인원 내에서 명단 입력이 가능합니다.',
    },
    {
        q: '학부모가 입력한 요청사항은 어떻게 관리되나요?',
        a: '강사 확인용으로만 노출되며, 팀원 간에는 민감한 요청사항이 직접 공유되지 않도록 관리됩니다.',
    },
    {
        q: '교육 전날에도 수정이 가능한가요?',
        a: '현재 운영 정책에 맞춰 일정 전날까지 수정 및 팀 공용 링크 사용이 가능하도록 반영되어 있습니다.',
    },
]

const newsItems = [
    {
        date: '2026.03.01',
        title: '소그룹 성교육 (남학생) 메인 페이지 리뉴얼',
        body: '브랜드 랜딩 구성을 재정비하고 강사/실무자 진입 동선을 분리해 운영 효율을 높였습니다.',
    },
    {
        date: '2026.02.24',
        title: '강사 캘린더 일정 표기 개선',
        body: '오늘 일정 카드, 날짜 강조 스타일, 일정 생성 동선을 정리해 하루 운영 파악성을 높였습니다.',
    },
    {
        date: '2026.02.18',
        title: '팀 공용 링크 정책 업데이트',
        body: '중복 입력 방지와 부모 전화번호 기반 덮어쓰기 로직으로 입력 안정성을 높였습니다.',
    },
]

export default function Home() {
    return (
        <main className={styles.page}>
            <ScrollReveal />
            <header className={styles.header}>
                <div className={styles.brandArea}>
                    <Link href="/" className={`font-display ${styles.brandLogo}`}>
                        WHYME
                    </Link>
                    <p className={styles.brandTag}>성 · 미디어 교육 브랜드</p>
                </div>
                <nav className={styles.nav}>
                    {navItems.map((item) => (
                        <a key={item.href} href={item.href} className={styles.navLink}>
                            {item.label}
                        </a>
                    ))}
                </nav>
                <div className={styles.headerActions}>
                    <Link href="/groupinfo" className={styles.primaryButton}>
                        교육 신청하기
                    </Link>
                    <Link href="/admin/login" className={styles.secondaryButton}>
                        관리자 로그인
                    </Link>
                </div>
            </header>

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
                            <Link href="/admin/login" className={styles.ghostButton}>
                                강사/실무자 접근
                            </Link>
                            <Link href="/groupinfo/lookup" className={styles.secondaryButton}>
                                신청 현황 확인
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

            <section id="instructors" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>강사소개</h2>
                    <p className={styles.sectionLead}>현장 경험과 소통 역량을 갖춘 WHYME 전문 강사진</p>
                </div>
                <HorizontalCarousel ariaLabel="강사 소개 슬라이드" autoPlayMs={2800} itemMinWidth={260}>
                    {instructorItems.map((item, index) => (
                        <article
                            key={item.name}
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

            <section id="programs" className={styles.section} data-reveal>
                <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
                    <h2 className={styles.sectionTitle}>교육프로그램</h2>
                    <p className={styles.sectionLead}>목표와 상황에 맞게 선택 가능한 WHYME 라인업</p>
                </div>
                <HorizontalCarousel ariaLabel="교육 프로그램 슬라이드" autoPlayMs={2400} itemMinWidth={280}>
                    {programItems.map((item, index) => (
                        <article
                            key={item.title}
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
                    <Link href="/admin/login" className={styles.secondaryButton}>
                        관리자 로그인
                    </Link>
                </div>
            </section>
        </main>
    )
}
