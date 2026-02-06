# API Contract (MVP)

Base URL:
- Local: `http://localhost:3000`
- Link generation uses `NEXT_PUBLIC_BASE_URL` (fallback: `http://localhost:3000`)

## Data normalization
- Phone inputs may include `-`, but the server stores digits only (e.g. `010-1234-5678` -> `01012345678`).
- `parentPhone` sent as empty string (`""`) is stored as `null`.

## 1) POST `/api/booking/create`
Creates:
- `Parent` (upsert by normalized `leaderPhone`)
- `ReservationSlot` resolve/create by `classDate + classTime + instructorName` when `slotId` is omitted
- `GroupPass`
- `InviteLink` (`purpose=leader_only`) as manage token
- Optional leader first-member record (`Child`, `GroupMember`) when `childName` is provided

### Request
```json
{
  "classDate": "2026-02-06",
  "classTime": "15:30",
  "instructorName": "김와이미",
  "location": "서울 강남",
  "leaderName": "김와이",
  "leaderPhone": "010-1234-5678",
  "cashReceiptNumber": "010-1234-5678",
  "headcountDeclared": 4,
  "childName": "최띠옹",
  "priorStudentAttended": false,
  "siblingsPriorAttended": false,
  "parentPriorAttended": false,
  "noteToInstructor": "아이가 처음이라 천천히 부탁드립니다.",
  "acquisitionChannel": "지인 추천"
}
```

Notes:
- Backward compatible: `slotId` can still be sent directly.
- If `slotId` is omitted, `classDate + classTime + instructorName` are required.

### Response (201)
```json
{
  "success": true,
  "groupId": "UUID",
  "slotId": "UUID",
  "manageToken": "UUID",
  "manageUrl": "http://localhost:3000/manage/<manageToken>",
  "initialMemberCreated": true,
  "leaderEditToken": "UUID",
  "leaderEditUrl": "http://localhost:3000/member/edit/<leaderEditToken>"
}
```

## 2) POST `/api/invite/create`
Leader creates member invite links.

### Request
```json
{
  "leaderToken": "leader-only-token",
  "count": 3,
  "expiresInDays": 14
}
```

### Response (201)
```json
{
  "success": true,
  "groupId": "UUID",
  "createdCount": 3,
  "inviteUrls": [
    "http://localhost:3000/invite/<token1>",
    "http://localhost:3000/invite/<token2>",
    "http://localhost:3000/invite/<token3>"
  ]
}
```

### Error
- `409` when `GroupPass.rosterStatus=locked`

## 3) POST `/api/invite/submit`
Member submits roster entry.

Behavior:
- Invite token claim is atomic (race-safe).
- Creates `Child`, `GroupMember(editToken 포함)`.
- If `GroupPass.rosterStatus=draft`, it auto-transitions to `collecting` on first successful submit.

### Request
```json
{
  "token": "roster-entry-token",
  "childName": "최띠옹",
  "childGrade": "초6",
  "priorStudentAttended": false,
  "siblingsPriorAttended": false,
  "parentPriorAttended": false,
  "parentName": "김학부모",
  "parentPhone": "010-0000-0000",
  "noteToInstructor": "처음 참여합니다."
}
```

### Response (201)
```json
{
  "success": true,
  "groupId": "UUID",
  "groupMemberId": "UUID",
  "currentMemberCount": 2,
  "editToken": "UUID",
  "editUrl": "http://localhost:3000/member/edit/<editToken>"
}
```

### Errors
- `404` invalid token
- `403` invalid token purpose
- `410` token expired
- `409` token already used
- `409` group roster locked

## 4) PATCH `/api/member/update`
Updates submitted member data by `editToken`.

### Request
```json
{
  "editToken": "edit-token",
  "noteToInstructor": "요청사항 수정했습니다",
  "parentPhone": ""
}
```

### Response (200)
```json
{
  "success": true,
  "groupMemberId": "UUID",
  "message": "Updated successfully"
}
```

### Errors
- `404` invalid edit token
- `409` when `GroupPass.rosterStatus=locked`

## 5) GET `/api/manage/[leaderToken]`
Leader-facing manage query API.

### Response (200)
```json
{
  "success": true,
  "groupId": "UUID",
  "status": "pending_info",
  "rosterStatus": "collecting",
  "headcountDeclared": 4,
  "headcountFinal": null,
  "counts": {
    "total": 2,
    "completed": 2,
    "pending": 0
  },
  "members": [
    {
      "groupMemberId": "UUID",
      "childId": "UUID",
      "childName": "최띠옹",
      "childGrade": "초6",
      "parentName": "김학부모",
      "parentPhone": "01000000000",
      "noteToInstructor": "처음 참여합니다.",
      "status": "completed",
      "createdAt": "2026-02-04T09:00:00.000Z",
      "updatedAt": "2026-02-04T09:00:00.000Z"
    }
  ]
}
```

### Errors
- `404` invalid token
- `403` not a leader token
- `410` token expired
