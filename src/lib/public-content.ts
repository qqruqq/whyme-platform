export const publicMenuItems = [
  { label: '와이미 소식', href: '/news' },
  { label: '교육프로그램', href: '/programs' },
  { label: '교육 커리큘럼', href: '/curriculum' },
  { label: '강사 소개', href: '/instructors' },
  { label: 'FAQ', href: '/faq' },
] as const;

export const publicMenuLeadMap: Record<(typeof publicMenuItems)[number]['href'], string> = {
  '/news': '최근 업데이트와 운영 공지를 확인하세요.',
  '/programs': '목표와 상황에 맞는 WHYME 교육 라인업을 확인하세요.',
  '/curriculum': '수업 전후를 연결하는 운영 프로세스를 확인하세요.',
  '/instructors': '현장 경험과 소통 역량을 갖춘 WHYME 강사진을 확인하세요.',
  '/faq': '예약/운영 관련 자주 묻는 질문을 모았습니다.',
};

export const brandCards = [
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
] as const;

export const curriculumSteps = [
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
] as const;

export const faqItems = [
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
] as const;

export const newsItems = [
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
] as const;
