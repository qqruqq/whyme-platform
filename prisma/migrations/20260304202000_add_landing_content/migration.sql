-- CreateTable
CREATE TABLE "landing_instructor" (
    "instructor_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_instructor_pkey" PRIMARY KEY ("instructor_id")
);

-- CreateTable
CREATE TABLE "landing_program" (
    "program_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "highlights" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#1f4e79',
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_program_pkey" PRIMARY KEY ("program_id")
);

-- CreateIndex
CREATE INDEX "landing_instructor_is_active_sort_order_idx" ON "landing_instructor"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "landing_program_is_active_sort_order_idx" ON "landing_program"("is_active", "sort_order");

-- Seed default landing instructors
INSERT INTO "landing_instructor" ("name", "role", "summary", "description", "sort_order", "is_active")
VALUES
  ('이시훈 대표강사', '대표강사', '청소년 성교육 · 미디어 리터러시', '민감한 주제를 안전하게 다루는 진행 역량과 높은 소통 밀도로 수업 몰입을 이끌어냅니다.', 10, true),
  ('박세림 강사', '소그룹 강사', '또래 상호작용 중심 진행', '팀별 분위기를 빠르게 파악해 학생들이 스스로 말하고 정리하도록 토론형 수업을 운영합니다.', 20, true),
  ('WHYME 협력 강사진', '전문 강사진', '학년별 분화 커리큘럼', '학년과 주제별 강점이 다른 강사 네트워크로 학교·기관 환경에 맞춘 수업을 제공합니다.', 30, true);

-- Seed default landing programs
INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
VALUES
  ('소그룹 성교육 (남학생)', '또래 기반 토론과 활동으로 건강한 성 인식과 관계 감각을 키우는 핵심 프로그램', E'팀별 참여 활동 중심\n요청사항 반영형 수업 준비', 'var(--program-small-group-boys)', 10, true),
  ('1:1 교육', '학생 성향과 속도에 맞춰 민감 주제를 깊이 있게 다루는 맞춤형 교육', E'개인 상담형 커뮤니케이션\n집중 피드백 제공', 'var(--program-1to1)', 20, true),
  ('온라인 성교육', '비대면 환경에서도 집중도 높은 구조로 운영되는 라이브/녹화 혼합형 콘텐츠', E'라이브 + 복습 구조\n장소 제약 없는 참여', 'var(--program-online-sex-ed)', 30, true),
  ('미디어 스쿨', '디지털 콘텐츠를 분석하고 표현하는 힘을 기르는 실습형 미디어 교육', E'디지털 문해력 강화\n표현 활동 실습', 'var(--program-media-school)', 40, true);
