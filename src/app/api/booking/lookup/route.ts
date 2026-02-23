import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits } from '@/lib/phone';
import { z } from 'zod';

const phoneInputSchema = z
  .string()
  .regex(/^[0-9-]{10,13}$/, '유효한 학부모 연락처 형식이 아닙니다');

const bookingLookupSchema = z
  .object({
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '교육 일정(날짜) 형식이 올바르지 않습니다'),
    classTime: z.string().regex(/^\d{2}:\d{2}$/, '교육 일정(시간) 형식이 올바르지 않습니다'),
    instructorName: z.string().min(1, '강사명을 입력해주세요'),
    parentPhone: phoneInputSchema.optional(),
    // backward compatibility
    leaderPhone: phoneInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.parentPhone && !data.leaderPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '학부모 연락처를 입력해주세요.',
        path: ['parentPhone'],
      });
    }
  });

function toClassStartAt(classDate: string, classTime: string): Date | null {
  const date = new Date(`${classDate}T${classTime}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = bookingLookupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { classDate, classTime, instructorName, parentPhone, leaderPhone } = validation.data;
    const startAt = toClassStartAt(classDate, classTime);

    if (!startAt) {
      return NextResponse.json({ error: 'Invalid schedule format' }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneDigits(parentPhone ?? (leaderPhone as string));
    const slotWindowStart = new Date(startAt.getTime() - 30 * 1000);
    const slotWindowEnd = new Date(startAt.getTime() + 30 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const slot = await tx.reservationSlot.findFirst({
        where: {
          instructorId: instructorName.trim(),
          startAt: {
            gte: slotWindowStart,
            lte: slotWindowEnd,
          },
        },
      });

      if (!slot) {
        return null;
      }

      const parent = await tx.parent.findUnique({
        where: { phone: normalizedPhone },
      });

      if (parent) {
        const leaderGroup = await tx.groupPass.findFirst({
          where: {
            slotId: slot.slotId,
            leaderParentId: parent.parentId,
          },
          include: {
            inviteLinks: {
              where: {
                purpose: 'leader_only',
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            groupMembers: {
              where: {
                parentPhone: normalizedPhone,
                status: {
                  not: 'removed',
                },
                editToken: {
                  not: null,
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              select: {
                editToken: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const leaderInvite = leaderGroup?.inviteLinks[0];
        if (leaderGroup && leaderInvite) {
          return {
            slot,
            groupId: leaderGroup.groupId,
            status: leaderGroup.status,
            rosterStatus: leaderGroup.rosterStatus,
            lookupType: 'leader_manage' as const,
            manageToken: leaderInvite.token,
            editToken: leaderGroup.groupMembers[0]?.editToken ?? null,
          };
        }
      }

      const member = await tx.groupMember.findFirst({
        where: {
          parentPhone: normalizedPhone,
          status: {
            not: 'removed',
          },
          editToken: {
            not: null,
          },
          group: {
            slotId: slot.slotId,
          },
        },
        include: {
          group: {
            select: {
              groupId: true,
              status: true,
              rosterStatus: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!member) {
        return null;
      }

      return {
        slot,
        groupId: member.group.groupId,
        status: member.group.status,
        rosterStatus: member.group.rosterStatus,
        lookupType: 'member_edit' as const,
        manageToken: null,
        editToken: member.editToken,
      };
    });

    if (!result) {
      return NextResponse.json(
        { error: '예약 내역을 찾지 못했습니다. 입력 정보를 확인해 주세요.' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const manageUrl = result.manageToken ? `${baseUrl}/manage/${result.manageToken}` : null;
    const editUrl = result.editToken ? `${baseUrl}/member/edit/${result.editToken}` : null;

    return NextResponse.json({
      success: true,
      lookupType: result.lookupType,
      groupId: result.groupId,
      slotId: result.slot.slotId,
      status: result.status,
      rosterStatus: result.rosterStatus,
      manageToken: result.manageToken,
      manageUrl,
      editToken: result.editToken,
      editUrl,
    });
  } catch (error) {
    console.error('Booking Lookup Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
