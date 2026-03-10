import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type PublicInstructorCard = {
  id: string;
  name: string;
  role: string;
  summary: string;
  description: string;
};

export type PublicProgramCard = {
  id: string;
  title: string;
  description: string;
  points: string[];
  color: string;
};

export const defaultInstructorCards: PublicInstructorCard[] = [
  {
    id: 'default-instructor-1',
    name: '이시훈 대표강사',
    role: '대표강사',
    summary: '청소년 성교육 · 미디어 리터러시',
    description: '민감한 주제를 안전하게 다루는 진행 역량과 높은 소통 밀도로 수업 몰입을 이끌어냅니다.',
  },
  {
    id: 'default-instructor-2',
    name: '박세림 강사',
    role: '소그룹 강사',
    summary: '또래 상호작용 중심 진행',
    description: '팀별 분위기를 빠르게 파악해 학생들이 스스로 말하고 정리하도록 토론형 수업을 운영합니다.',
  },
  {
    id: 'default-instructor-3',
    name: 'WHYME 협력 강사진',
    role: '전문 강사진',
    summary: '학년별 분화 커리큘럼',
    description: '학년과 주제별 강점이 다른 강사 네트워크로 학교·기관 환경에 맞춘 수업을 제공합니다.',
  },
];

export const defaultProgramCards: PublicProgramCard[] = [
  {
    id: 'default-program-1',
    title: '소그룹 성교육 남학생',
    description: '또래 기반 토론과 활동으로 건강한 성 인식과 관계 감각을 키우는 핵심 프로그램',
    points: ['팀별 참여 활동 중심', '요청사항 반영형 수업 준비', '학년별 맞춤 사례 중심 진행'],
    color: 'var(--program-small-group-boys)',
  },
  {
    id: 'default-program-2',
    title: '1:1 교육',
    description: '학생 성향과 속도에 맞춰 민감 주제를 깊이 있게 다루는 맞춤형 교육',
    points: ['개인 상담형 커뮤니케이션', '집중 피드백 제공', '학부모 협의 기반 맞춤 설계'],
    color: 'var(--program-1to1)',
  },
  {
    id: 'default-program-3',
    title: '온라인 성교육',
    description: '비대면 환경에서도 집중도 높은 구조로 운영되는 라이브/녹화 혼합형 콘텐츠',
    points: ['라이브 + 복습 구조', '장소 제약 없는 참여', '디지털 안전 수칙 병행'],
    color: 'var(--program-online-sex-ed)',
  },
  {
    id: 'default-program-4',
    title: '미디어 스쿨',
    description: '디지털 콘텐츠를 분석하고 표현하는 힘을 기르는 실습형 미디어 교육',
    points: ['디지털 문해력 강화', '표현 활동 실습', '미디어 영향 분석 워크숍'],
    color: 'var(--program-media-school)',
  },
  {
    id: 'default-program-5',
    title: '지도자과정 원데이클래스',
    description: '짧은 시간 안에 현장 적용 포인트를 습득하는 지도자 대상 집중 클래스',
    points: ['하루 집중 워크숍', '바로 적용 가능한 운영 템플릿', '현장 사례 피드백'],
    color: 'var(--program-leader-oneday)',
  },
  {
    id: 'default-program-6',
    title: '지도자과정 정규클래스',
    description: '체계적인 모듈 학습으로 지도 역량을 단계적으로 강화하는 심화 과정',
    points: ['모듈형 커리큘럼', '실습 + 코칭 병행', '평가 및 이수 관리'],
    color: 'var(--program-leader-regular)',
  },
  {
    id: 'default-program-7',
    title: '단체교육',
    description: '학교·기관·센터 대상 규모형 교육으로 상황 맞춤 운영이 가능한 프로그램',
    points: ['기관 맞춤형 설계', '대규모 진행 경험 기반', '사전·사후 운영 패키지'],
    color: 'var(--program-group-training)',
  },
  {
    id: 'default-program-8',
    title: '소그룹 성교육 여학생',
    description: '여학생 그룹 특성을 반영해 관계, 경계, 자기표현을 안전하게 다루는 소그룹 수업',
    points: ['여학생 맞춤 사례 중심', '자기표현·자기보호 강화', '소그룹 토론 기반 운영'],
    color: 'var(--program-small-group-girls)',
  },
];

export function parseHighlightsText(value: string | null | undefined): string[] {
  return (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function stringifyHighlights(points: string[]): string {
  return points
    .map((point) => point.trim())
    .filter(Boolean)
    .join('\n');
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

function mapInstructorRow(row: {
  instructorId: string;
  name: string;
  role: string;
  summary: string | null;
  description: string;
}): PublicInstructorCard {
  return {
    id: row.instructorId,
    name: row.name,
    role: row.role,
    summary: row.summary || '',
    description: row.description,
  };
}

function mapProgramRow(row: {
  programId: string;
  title: string;
  description: string;
  highlights: string;
  color: string;
}): PublicProgramCard {
  return {
    id: row.programId,
    title: row.title,
    description: row.description,
    points: parseHighlightsText(row.highlights),
    color: row.color,
  };
}

export async function getPublicProgramById(programId: string): Promise<PublicProgramCard | null> {
  try {
    const row = await prisma.landingProgram.findUnique({
      where: { programId },
    });

    if (!row || !row.isActive) {
      return null;
    }

    return mapProgramRow(row);
  } catch (error) {
    if (isMissingTableError(error)) {
      return defaultProgramCards.find((program) => program.id === programId) ?? null;
    }
    throw error;
  }
}

export async function getPublicLandingContent(): Promise<{
  instructors: PublicInstructorCard[];
  programs: PublicProgramCard[];
}> {
  try {
    const [instructorRows, programRows] = await Promise.all([
      prisma.landingInstructor.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.landingProgram.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const instructors = instructorRows.length > 0 ? instructorRows.map(mapInstructorRow) : defaultInstructorCards;
    const programs = programRows.length > 0 ? programRows.map(mapProgramRow) : defaultProgramCards;

    return { instructors, programs };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        instructors: defaultInstructorCards,
        programs: defaultProgramCards,
      };
    }
    throw error;
  }
}
