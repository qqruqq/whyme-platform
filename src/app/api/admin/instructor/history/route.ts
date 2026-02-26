import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits } from '@/lib/phone';
import { extractInstructorMemos, extractLocationFromMemo } from '@/lib/group-memo';

function toNullableString(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentPhoneInput = searchParams.get('parentPhone')?.trim() || '';
    const childNameInput = searchParams.get('childName')?.trim() || '';

    if (!parentPhoneInput || !childNameInput) {
      return NextResponse.json(
        { error: '학부모 연락처와 학생 이름을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const normalizedParentPhone = normalizePhoneDigits(parentPhoneInput);
    if (normalizedParentPhone.length < 10) {
      return NextResponse.json({ error: '학부모 연락처 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const matchedMembers = await prisma.groupMember.findMany({
      where: {
        parentPhone: normalizedParentPhone,
        status: {
          not: 'removed',
        },
        child: {
          name: {
            contains: childNameInput,
            mode: 'insensitive',
          },
        },
      },
      include: {
        child: true,
        group: {
          include: {
            slot: {
              select: {
                startAt: true,
                endAt: true,
                instructorId: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 60,
    });

    const rows = matchedMembers
      .sort((a, b) => b.group.slot.startAt.getTime() - a.group.slot.startAt.getTime())
      .map((member) => ({
        groupId: member.groupId,
        classStartAt: member.group.slot.startAt,
        classEndAt: member.group.slot.endAt,
        instructorName: member.group.slot.instructorId,
        groupStatus: member.group.status,
        rosterStatus: member.group.rosterStatus,
        childName: member.child.name,
        childGrade: toNullableString(member.child.grade),
        priorStudentAttended: member.child.priorStudentAttended,
        siblingsPriorAttended: member.child.siblingsPriorAttended,
        parentPriorAttended: member.child.parentPriorAttended,
        parentName: toNullableString(member.parentName),
        parentPhone: toNullableString(member.parentPhone),
        parentRequestNote: toNullableString(member.noteToInstructor),
        location: extractLocationFromMemo(member.group.memoToInstructor),
        instructorMemos: extractInstructorMemos(member.group.memoToInstructor),
      }));

    return NextResponse.json({
      success: true,
      count: rows.length,
      rows,
    });
  } catch (error) {
    console.error('Instructor History Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
