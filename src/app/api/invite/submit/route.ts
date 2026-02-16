import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiStatusError } from '@/lib/api/errors';
import { assertInviteTokenClaimed } from '@/lib/api/guards';
import { isSerializationConflictError, shouldRetrySerializableError } from '@/lib/api/retry';
import { normalizePhoneDigits } from '@/lib/phone';
import { isValidOptionalPhoneInput } from '@/lib/phone-validation';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const studentInputSchema = z.object({
  childName: z.string().min(1, '학생 이름을 입력해주세요'),
  childGrade: z.string().optional(),
  priorStudentAttended: z.boolean().optional(),
  siblingsPriorAttended: z.boolean().optional(),
  parentPriorAttended: z.boolean().optional(),
});

const inviteSubmitSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  students: z.array(studentInputSchema).min(1).max(2),
  parentName: z.string().optional(),
  parentPhone: z
    .string()
    .trim()
    .min(1, '연락처를 입력해주세요')
    .refine(isValidOptionalPhoneInput, '연락처는 숫자 10~11자리 형식이어야 합니다.'),
  noteToInstructor: z.string().optional(),
});

const MAX_SERIALIZABLE_RETRIES = 2;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = inviteSubmitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const normalizedParentPhone = normalizePhoneDigits(data.parentPhone);
    const normalizedParentName = data.parentName?.trim() || null;
    const normalizedNoteToInstructor = data.noteToInstructor?.trim() || null;

    let result:
      | {
          groupId: string;
          groupMemberIds: string[];
          editTokens: string[];
          currentCount: number;
          submittedStudentCount: number;
        }
      | null = null;

    for (let attempt = 0; attempt <= MAX_SERIALIZABLE_RETRIES; attempt += 1) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const invite = await tx.inviteLink.findUnique({
            where: { token: data.token },
            include: { group: true },
          });

          if (!invite) {
            throw new ApiStatusError(404, 'Invalid token');
          }

          if (invite.purpose !== 'roster_entry') {
            throw new ApiStatusError(403, 'Invalid token purpose');
          }

          const now = new Date();
          if (invite.expiresAt && now > invite.expiresAt) {
            throw new ApiStatusError(410, 'Token expired');
          }

          if (invite.group.rosterStatus === 'locked') {
            throw new ApiStatusError(409, 'Group roster is locked');
          }

          const claimed = await tx.inviteLink.updateMany({
            where: {
              inviteId: invite.inviteId,
              usedCount: { lt: invite.maxUses },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            data: {
              usedCount: { increment: 1 },
              usedAt: now,
              usedBy: `ParentPhone:${normalizedParentPhone}`,
            },
          });

          assertInviteTokenClaimed(claimed.count);

          const existingMembersForParent = await tx.groupMember.findMany({
            where: {
              groupId: invite.groupId,
              parentPhone: normalizedParentPhone,
              status: { not: 'removed' },
            },
            include: {
              child: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });

          const currentActiveCount = await tx.groupMember.count({
            where: {
              groupId: invite.groupId,
              status: { not: 'removed' },
            },
          });

          const projectedCount =
            currentActiveCount - existingMembersForParent.length + data.students.length;
          const declaredHeadcount = invite.group.headcountDeclared;

          if (declaredHeadcount !== null && projectedCount > declaredHeadcount) {
            throw new ApiStatusError(409, 'Group headcount exceeded');
          }

          const updatedOrCreatedMembers: { groupMemberId: string; editToken: string }[] = [];

          for (let index = 0; index < data.students.length; index += 1) {
            const student = data.students[index];
            const existingMember = existingMembersForParent[index];

            if (existingMember) {
              await tx.child.update({
                where: { childId: existingMember.childId },
                data: {
                  name: student.childName,
                  grade: student.childGrade,
                  priorStudentAttended: student.priorStudentAttended,
                  siblingsPriorAttended: student.siblingsPriorAttended,
                  parentPriorAttended: student.parentPriorAttended,
                },
              });

              const resolvedEditToken = existingMember.editToken ?? uuidv4();
              const updatedMember = await tx.groupMember.update({
                where: { groupMemberId: existingMember.groupMemberId },
                data: {
                  parentName: normalizedParentName,
                  parentPhone: normalizedParentPhone,
                  noteToInstructor: normalizedNoteToInstructor,
                  editToken: resolvedEditToken,
                  status: 'completed',
                },
              });

              updatedOrCreatedMembers.push({
                groupMemberId: updatedMember.groupMemberId,
                editToken: updatedMember.editToken as string,
              });

              continue;
            }

            const child = await tx.child.create({
              data: {
                name: student.childName,
                grade: student.childGrade,
                priorStudentAttended: student.priorStudentAttended,
                siblingsPriorAttended: student.siblingsPriorAttended,
                parentPriorAttended: student.parentPriorAttended,
              },
            });

            const editToken = uuidv4();
            const member = await tx.groupMember.create({
              data: {
                groupId: invite.groupId,
                childId: child.childId,
                parentName: normalizedParentName,
                parentPhone: normalizedParentPhone,
                noteToInstructor: normalizedNoteToInstructor,
                editToken,
                status: 'completed',
              },
            });

            updatedOrCreatedMembers.push({
              groupMemberId: member.groupMemberId,
              editToken: member.editToken as string,
            });
          }

          if (existingMembersForParent.length > data.students.length) {
            const staleMembers = existingMembersForParent.slice(data.students.length);

            await tx.groupMember.updateMany({
              where: {
                groupMemberId: {
                  in: staleMembers.map((member) => member.groupMemberId),
                },
              },
              data: {
                status: 'removed',
              },
            });
          }

          await tx.groupPass.updateMany({
            where: {
              groupId: invite.groupId,
              rosterStatus: 'draft',
            },
            data: {
              rosterStatus: 'collecting',
            },
          });

          const currentCount = await tx.groupMember.count({
            where: {
              groupId: invite.groupId,
              status: { not: 'removed' },
            },
          });

          return {
            groupId: invite.groupId,
            groupMemberIds: updatedOrCreatedMembers.map((member) => member.groupMemberId),
            editTokens: updatedOrCreatedMembers.map((member) => member.editToken),
            currentCount,
            submittedStudentCount: data.students.length,
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        break;
      } catch (error) {
        if (shouldRetrySerializableError(error, attempt, MAX_SERIALIZABLE_RETRIES)) {
          continue;
        }

        throw error;
      }
    }

    if (!result) {
      throw new ApiStatusError(503, 'Temporary concurrency issue. Please retry.');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const editUrls = result.editTokens.map((token) => `${baseUrl}/member/edit/${token}`);

    return NextResponse.json(
      {
        success: true,
        groupId: result.groupId,
        submittedStudentCount: result.submittedStudentCount,
        groupMemberIds: result.groupMemberIds,
        currentMemberCount: result.currentCount,
        editTokens: result.editTokens,
        editUrls,
        // backward-compatible fields for existing clients
        groupMemberId: result.groupMemberIds[0],
        editToken: result.editTokens[0],
        editUrl: editUrls[0],
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSerializationConflictError(error)) {
      return NextResponse.json(
        { error: 'Temporary concurrency issue. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Invite Submit Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
