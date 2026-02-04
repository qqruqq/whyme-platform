
---

## docs/todo.md

```md
# TODO — WhyMe Platform MVP

## Phase 0 — Backend hardening (must-do before frontend)
- [ ] Add phone normalization utility (digits-only)
- [ ] Apply phone normalization to:
  - [ ] POST /api/booking
  - [ ] POST /api/invite/submit
  - [ ] PATCH /api/member/update
- [ ] member/update: store blank phone as NULL
- [ ] invite/submit: make invite token claim atomic (prevent race condition)
- [ ] Optional: when first submit happens, rosterStatus draft → collecting
- [ ] Add `GET /api/manage/[leaderToken]` for leader manage page
- [ ] Update curl examples after changes

## Phase 1 — Frontend (core)
- [ ] /invite/[token] page
  - [ ] Submit form
  - [ ] Error states (404/410/409)
  - [ ] Success screen with editUrl
- [ ] /member/edit/[editToken] page
  - [ ] Load current values (needs GET endpoint or include on first render)
  - [ ] Patch update
  - [ ] Locked state UX
- [ ] /manage/[leaderToken] page
  - [ ] Show group info and member count (from GET manage API)
  - [ ] Create invite links (POST /api/invite/create)
  - [ ] Copy buttons

## Phase 2 — Admin (later)
- [ ] Admin auth
- [ ] Slot creation UI
- [ ] Payment tracking UI
- [ ] Lock roster action
