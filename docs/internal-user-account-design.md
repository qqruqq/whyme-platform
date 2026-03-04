# 내부 사용자(관리자/강사) 등록 설계안 v1

## 1) 목표
- 외부 고객 회원가입과 분리해서, 내부 사용자(관리자/강사)만 안전하게 등록/관리한다.
- 공개 가입은 막고 `초대 기반 등록`으로 운영한다.
- 권한/상태/이력(감사로그)을 남겨 운영 리스크를 줄인다.

## 2) 현재 구조에서 확인된 리스크
- 강사 로그인은 `환경변수(INSTRUCTOR_LOGIN_CODES)` + 이름 문자열 기반이다.
- `reservation_slot.instructor_id`가 텍스트라서 사용자 계정과 강하게 연결되지 않는다.
- 실무자(ops) API에 별도 인증/인가가 없다.

즉, 지금은 기능은 동작하지만 운영 보안/권한통제는 약하다.

## 3) 권장 역할 모델
- `super_admin`: 전체 권한. 관리자/강사 생성, 역할변경, 정지, 삭제.
- `admin`: 강사 생성/수정, 일정/운영 데이터 관리.
- `instructor`: 본인 일정/메모/프로필만 관리.

상태:
- `pending`: 초대 수락 전
- `active`: 정상 사용
- `suspended`: 로그인 차단
- `deleted`: 논리 삭제

## 4) DB 설계 (비파괴 도입 기준)
기존 테이블을 즉시 깨지 않기 위해 신규 테이블을 먼저 추가한다.

### 4-1. 신규 ENUM
- `InternalUserRole`: `super_admin`, `admin`, `instructor`
- `InternalUserStatus`: `pending`, `active`, `suspended`, `deleted`

### 4-2. 신규 TABLE
1. `internal_user`
- `user_id` UUID PK
- `role` InternalUserRole
- `status` InternalUserStatus
- `login_id` VARCHAR(64) UNIQUE (아이디)
- `password_hash` TEXT (bcrypt/argon2)
- `name` VARCHAR(80)
- `phone` VARCHAR(30) NULL
- `email` VARCHAR(120) NULL
- `instructor_code_hash` TEXT NULL (강사 코드 로그인 유지가 필요하면 사용)
- `created_at`, `updated_at`, `last_login_at`

2. `internal_user_invite`
- `invite_id` UUID PK
- `target_role` InternalUserRole
- `name` VARCHAR(80)
- `phone`/`email` NULL
- `token` UNIQUE
- `expires_at`
- `used_at` NULL
- `created_by` FK -> `internal_user.user_id`

3. `internal_user_session`
- `session_id` UUID PK
- `user_id` FK
- `token_hash` UNIQUE
- `ip_address`, `user_agent`
- `expires_at`, `revoked_at`, `created_at`

4. `audit_log`
- `audit_id` UUID PK
- `actor_user_id` FK NULL (시스템 처리면 NULL)
- `action` VARCHAR(80)
- `target_type` VARCHAR(50)
- `target_id` VARCHAR(100)
- `payload_json` JSONB
- `created_at`

### 4-3. 기존 테이블 연결(2단계)
- `reservation_slot`에 `instructor_user_id`(UUID, NULL 가능) 추가.
- 신규 생성 슬롯부터 `instructor_user_id`를 저장.
- 과거 데이터는 `instructor_id(이름)`로 매핑 배치 실행.
- 안정화 후 `instructor_id` 텍스트 사용을 축소.

## 5) API 설계
공통:
- 로그인/세션은 `HttpOnly + Secure + SameSite=Lax` 쿠키.
- 모든 `admin/ops` API는 인증 + 역할 검사 필수.

### 5-1. 인증
- `POST /api/auth/login`
  - input: `loginId`, `password`
  - output: 세션 쿠키 발급, 사용자 요약
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 5-2. 내부 사용자 관리
- `POST /api/admin/users/invite` (`super_admin`, `admin`)
- `POST /api/admin/users/register` (초대 토큰 기반 최초 등록)
- `GET /api/admin/users` (`super_admin`, `admin`)
- `PATCH /api/admin/users/:userId` (상태/연락처/표시명 수정)
- `PATCH /api/admin/users/:userId/role` (`super_admin`만)
- `PATCH /api/admin/users/:userId/password-reset` (`super_admin`, `admin`)

### 5-3. 강사용 자기정보
- `GET /api/instructor/profile` (`instructor`)
- `PATCH /api/instructor/profile` (`instructor`)

## 6) 화면/라우트 제안
- `/admin/login` : 내부 사용자 공통 로그인
- `/admin/users` : 내부 사용자 목록/상태관리
- `/admin/users/invite` : 초대 생성
- `/admin/register/[token]` : 초대 수락/비밀번호 설정
- `/admin/instructor/profile` : 강사 내 정보 수정

## 7) 권한 매트릭스
- `super_admin`
  - 관리자/강사 생성, 역할변경, 정지/삭제, 전체 감사로그 조회
- `admin`
  - 강사 초대/수정, 강사 비밀번호 초기화, 운영 페이지 접근
  - 관리자 역할 변경 불가
- `instructor`
  - 본인 프로필/본인 일정만
  - 타 강사/운영설정 접근 불가

## 8) 단계별 적용 플랜
1. **1차 (빠른 보안 확보)**
  - `internal_user`, `internal_user_session` 도입
  - `/admin/ops/*` 인증/인가 추가
  - 기존 강사 코드 로그인은 유지하되 서버에서 `internal_user` 존재 확인

2. **2차 (초대 기반 등록)**
  - `internal_user_invite` 도입
  - 관리자/강사 생성 방식을 초대 기반으로 전환

3. **3차 (도메인 정규화)**
  - `reservation_slot.instructor_user_id` 본격 사용
  - 이름 텍스트 기반 처리 축소

## 9) 구현 전 확인할 결정사항
1. 로그인 키는 `아이디(login_id)`로 고정할지, `휴대폰` 허용할지
2. 강사 로그인 방식: 비밀번호만 / 비밀번호+코드(2요소 유사)
3. 관리자 생성 권한을 `super_admin` 단독으로 고정할지
4. 비밀번호 재설정 방식: 관리자 초기화 vs 이메일 링크
5. 감사로그 보관 기간(예: 1년/3년)

