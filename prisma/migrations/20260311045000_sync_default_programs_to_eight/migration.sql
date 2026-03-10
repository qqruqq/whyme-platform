DO $$
BEGIN
  -- Legacy title 정리
  UPDATE "landing_program"
  SET "title" = '소그룹 성교육 남학생'
  WHERE "title" = '소그룹 성교육 (남학생)';

  -- 1) 소그룹 성교육 남학생
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '소그룹 성교육 남학생') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '소그룹 성교육 남학생',
      '또래 기반 토론과 활동으로 건강한 성 인식과 관계 감각을 키우는 핵심 프로그램',
      E'팀별 참여 활동 중심\n요청사항 반영형 수업 준비\n학년별 맞춤 사례 중심 진행',
      'var(--program-small-group-boys)',
      100,
      true
    );
  END IF;

  -- 2) 1:1 교육
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '1:1 교육') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '1:1 교육',
      '학생 성향과 속도에 맞춰 민감 주제를 깊이 있게 다루는 맞춤형 교육',
      E'개인 상담형 커뮤니케이션\n집중 피드백 제공\n학부모 협의 기반 맞춤 설계',
      'var(--program-1to1)',
      110,
      true
    );
  END IF;

  -- 3) 온라인 성교육
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '온라인 성교육') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '온라인 성교육',
      '비대면 환경에서도 집중도 높은 구조로 운영되는 라이브/녹화 혼합형 콘텐츠',
      E'라이브 + 복습 구조\n장소 제약 없는 참여\n디지털 안전 수칙 병행',
      'var(--program-online-sex-ed)',
      120,
      true
    );
  END IF;

  -- 4) 미디어 스쿨
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '미디어 스쿨') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '미디어 스쿨',
      '디지털 콘텐츠를 분석하고 표현하는 힘을 기르는 실습형 미디어 교육',
      E'디지털 문해력 강화\n표현 활동 실습\n미디어 영향 분석 워크숍',
      'var(--program-media-school)',
      130,
      true
    );
  END IF;

  -- 5) 지도자과정 원데이클래스
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '지도자과정 원데이클래스') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '지도자과정 원데이클래스',
      '짧은 시간 안에 현장 적용 포인트를 습득하는 지도자 대상 집중 클래스',
      E'하루 집중 워크숍\n바로 적용 가능한 운영 템플릿\n현장 사례 피드백',
      'var(--program-leader-oneday)',
      140,
      true
    );
  END IF;

  -- 6) 지도자과정 정규클래스
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '지도자과정 정규클래스') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '지도자과정 정규클래스',
      '체계적인 모듈 학습으로 지도 역량을 단계적으로 강화하는 심화 과정',
      E'모듈형 커리큘럼\n실습 + 코칭 병행\n평가 및 이수 관리',
      'var(--program-leader-regular)',
      150,
      true
    );
  END IF;

  -- 7) 단체교육
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '단체교육') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '단체교육',
      '학교·기관·센터 대상 규모형 교육으로 상황 맞춤 운영이 가능한 프로그램',
      E'기관 맞춤형 설계\n대규모 진행 경험 기반\n사전·사후 운영 패키지',
      'var(--program-group-training)',
      160,
      true
    );
  END IF;

  -- 8) 소그룹 성교육 여학생
  IF NOT EXISTS (SELECT 1 FROM "landing_program" WHERE "title" = '소그룹 성교육 여학생') THEN
    INSERT INTO "landing_program" ("title", "description", "highlights", "color", "sort_order", "is_active")
    VALUES (
      '소그룹 성교육 여학생',
      '여학생 그룹 특성을 반영해 관계, 경계, 자기표현을 안전하게 다루는 소그룹 수업',
      E'여학생 맞춤 사례 중심\n자기표현·자기보호 강화\n소그룹 토론 기반 운영',
      'var(--program-small-group-girls)',
      170,
      true
    );
  END IF;
END $$;
