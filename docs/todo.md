# TODO — WhyMe Platform MVP

## Phase 0 — Backend hardening (completed)
- [x] Add phone normalization utility (digits-only)
- [x] Apply phone normalization to:
  - [x] POST /api/booking/create
  - [x] POST /api/invite/submit
  - [x] PATCH /api/member/update
- [x] member/update: store blank phone as NULL
- [x] invite/submit: make invite token claim atomic (prevent race condition)
- [x] When first submit happens, rosterStatus draft -> collecting
- [x] Add `GET /api/manage/[leaderToken]` for leader manage page
- [x] Add `GET /api/member/[editToken]` for member edit preload
- [x] Update API contract examples

## Phase 1 — Frontend (core, completed)
- [x] `/invite/[token]` page
  - [x] Submit form
  - [x] 1회 입력 시 학생 1~2명 동시 등록
  - [x] `parentPhone` 필수 입력
  - [x] Error states (404/410/409)
  - [x] Success screen with multiple editUrls
- [x] `/member/edit/[editToken]` page
  - [x] Load current values via `GET /api/member/[editToken]`
  - [x] Patch update
  - [x] Locked state UX
- [x] `/manage/[leaderToken]` page
  - [x] Show group info and member count (from GET manage API)
  - [x] Create invite links (POST /api/invite/create)
  - [x] Copy buttons

## Phase 1.5 — Reliability (in progress)
- [x] Add automated API scenario tests for concurrency/locking/error mapping
- [x] Standardize retry-exhausted responses to 503 and business conflicts to 409
- [x] Shared invite link policy (single team link, reuse support)

## Phase 2 — Admin (later)
- [ ] Admin auth
- [ ] Slot creation UI
- [ ] Payment tracking UI
- [ ] Lock roster action
