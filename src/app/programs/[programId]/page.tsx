import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicHeader from '@/components/public/PublicHeader';
import ScrollReveal from '@/components/ScrollReveal';
import { getPublicLandingContent, getPublicProgramById } from '@/lib/landing-content';
import styles from '../../page.module.css';

type ProgramDetailPageProps = {
  params: Promise<{
    programId: string;
  }>;
};

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { programId } = await params;
  const program = await getPublicProgramById(programId);

  if (!program) {
    notFound();
  }

  const { programs } = await getPublicLandingContent();
  const siblingPrograms = programs.filter((item) => item.id !== program.id).slice(0, 4);
  const isSmallGroupEntryProgram =
    program.title === '소그룹 성교육 남학생' ||
    program.title === '소그룹 성교육 여학생' ||
    program.title === '소그룹 성교육 (남학생)' ||
    program.title === '소그룹 성교육 (여학생)';

  return (
    <main className={styles.page}>
      <ScrollReveal />
      <PublicHeader activePath="/programs" />

      <section className={styles.section} data-reveal>
        <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
          <p className={styles.stepNo}>PROGRAM DETAIL</p>
          <h1 className={`font-display ${styles.sectionTitle}`}>{program.title}</h1>
          <p className={styles.sectionLead}>{program.description}</p>
        </div>

        <article
          className={styles.programCard}
          data-reveal
          data-reveal-delay="70"
          style={{
            borderColor: program.color,
            boxShadow: `0 16px 28px color-mix(in srgb, ${program.color} 18%, transparent)`,
          }}
        >
          <span className={styles.programChip} style={{ backgroundColor: program.color }}>
            PROGRAM
          </span>
          <h2 className={styles.cardTitle}>핵심 구성</h2>
          <ul className={styles.programList}>
            {program.points.length > 0 ? (
              program.points.map((point) => <li key={point}>{point}</li>)
            ) : (
              <li>세부 포인트는 관리자 페이지에서 등록할 수 있습니다.</li>
            )}
          </ul>
        </article>

        <div className={styles.buttonRow} data-reveal data-reveal-delay="120">
          <Link href="/programs" className={styles.secondaryButton}>
            교육프로그램 목록으로
          </Link>
          <Link href="/groupinfo" className={styles.primaryButton}>
            {isSmallGroupEntryProgram ? '소그룹 정보 입력 시작' : '이 프로그램으로 신청하기'}
          </Link>
        </div>
      </section>

      {siblingPrograms.length > 0 ? (
        <section className={styles.section} data-reveal>
          <div className={styles.sectionHead} data-reveal data-reveal-delay="20">
            <h2 className={styles.sectionTitle}>다른 교육프로그램</h2>
            <p className={styles.sectionLead}>다른 프로그램도 함께 비교해보세요.</p>
          </div>
          <div className={styles.programGrid}>
            {siblingPrograms.map((item, index) => (
              <Link key={item.id} href={`/programs/${item.id}`} className={styles.cardLink}>
                <article
                  className={styles.programCard}
                  data-reveal
                  data-reveal-delay={String(60 + index * 60)}
                  style={{
                    borderColor: item.color,
                    boxShadow: `0 14px 24px color-mix(in srgb, ${item.color} 16%, transparent)`,
                  }}
                >
                  <span className={styles.programChip} style={{ backgroundColor: item.color }}>
                    PROGRAM
                  </span>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  <p className={styles.cardText}>{item.description}</p>
                </article>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
