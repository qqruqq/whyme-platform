# API Contract (MVP)

Base URL:
- Local: http://localhost:3000
- Use `NEXT_PUBLIC_BASE_URL` for generated links.

## 1) POST /api/booking (create group + leader token)
Creates:
- Parent(upsert by phone)
- GroupPass
- InviteLink (leader_only) as manage token

### Request
```json
{
  "slotId": "UUID",
  "leaderName": "김와이",
  "leaderPhone": "010-1234-5678",
  "cashReceiptNumber": "010-1234-5678",
  "headcountDeclared": 4
}

{
  "success": true,
  "groupId": "UUID",
  "manageToken": "UUID",
  "manageUrl": "http://localhost:3000/manage/<manageToken>"
}


{
  "leaderToken": "leader-only-token",
  "count": 3,
  "expiresInDays": 14
}

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

{
  "success": true,
  "groupId": "UUID",
  "groupMemberId": "UUID",
  "currentMemberCount": 2,
  "editToken": "UUID",
  "editUrl": "http://localhost:3000/member/edit/<editToken>"
}


{
  "editToken": "edit-token",
  "noteToInstructor": "요청사항 수정했습니다",
  "parentPhone": "010-1111-2222"
}


{
  "success": true,
  "groupMemberId": "UUID",
  "message": "Updated successfully"
}
