# WhyMe Platform — Requirements (MVP)

## 0) Goal
Build an internal reservation + roster collection service for WhyMe small-group offline education.
Key concept: **no login for customers**. Access is link/token based.

## 1) Roles & Access Model
### Admin
- (Later) Admin login exists.
- Manages slots, confirms payments, locks rosters.

### Leader Parent (대표 학부모)
- No login.
- Uses a **leader-only token link** to open `/manage/[leaderToken]`.
- Can generate invite links for group members.

### Group Member Parent (팀원 학부모)
- No login.
- Uses a **roster-entry invite token** to submit roster info exactly once.
- Receives an **editToken** that allows updating their own submission later.

## 2) Token Policy
### Leader token (InviteLink.purpose = leader_only)
- Multi-use (maxUses large).
- Used to access leader manage page and to create new roster-entry invites.

### Invite token (InviteLink.purpose = roster_entry)
- Default: one-time submit (maxUses = 1).
- Submit creates:
  - Child record
  - GroupMember record
  - editToken on GroupMember
- After successful submit, invite token becomes used.

### Edit token (GroupMember.editToken)
- Used to edit a single member submission via `/member/edit/[editToken]`.
- Can be reused multiple times until roster is locked.
- When rosterStatus = locked → edits are blocked.

## 3) Roster Lock Rule
If `GroupPass.rosterStatus === locked`:
- `POST /api/invite/submit` must return 409
- `PATCH /api/member/update` must return 409
- `POST /api/invite/create` must return 409

Optional improvement:
- When the first member submits, if rosterStatus is draft → set to collecting.

## 4) Data Quality Rules
### Phone numbers
- UI: allow digits-only input, display with hyphens.
- Server: normalize and store digits-only (e.g. `01012345678`).
- Blank phone should be stored as NULL (not empty string).

### Grade
- UI: dropdown recommended.
- Stored as string (e.g. "초6", "중1").

## 5) UX Copy Guidelines (Korean)
### Invite submit success
- "입력 완료! 아래 수정 링크를 저장해 주세요."
- Provide editUrl.

### Invite token errors
- 404: "링크가 올바르지 않습니다. 대표 학부모님께 새 링크를 요청해 주세요."
- 410: "이 링크는 유효기간이 지나 사용할 수 없습니다."
- 409 used: "이미 입력이 완료된 링크입니다. 수정이 필요하면 ‘수정 링크’를 이용해 주세요."
- 409 locked: "교육 준비가 완료되어 더 이상 입력/수정이 어렵습니다."

### Edit token errors
- 404: "수정 링크가 올바르지 않습니다."
- 409 locked: "현재 교육 준비가 완료되어 더 이상 수정할 수 없습니다."

## 6) Backend Improvements to Implement (before frontend)
1) Phone normalization utility and apply to:
   - booking/create
   - invite/submit
   - member/update
2) member/update: empty string → NULL
3) invite/submit: prevent race condition (atomic claim of invite token)
4) Optional: draft → collecting on first submit
5) Add manage-page query API:
   - `GET /api/manage/[leaderToken]` returns group status + member list + counts
