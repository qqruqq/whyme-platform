import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';

type RouteContext = {
  params: Promise<{
    editToken: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { editToken } = await params;

    const member = await prisma.groupMember.findUnique({
      where: { editToken },
      include: {
        child: true,
        group: {
          select: {
            groupId: true,
            rosterStatus: true,
            slot: {
              select: {
                startAt: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Invalid edit token' }, { status: 404 });
    }

    const editDeadline = subDays(member.group.slot.startAt, 1);
    const isLocked = member.group.rosterStatus === 'locked' || new Date() > editDeadline;

    const relatedMembers = member.parentPhone
      ? await prisma.groupMember.findMany({
          where: {
            groupId: member.groupId,
            parentPhone: member.parentPhone,
            status: {
              not: 'removed',
            },
            editToken: {
              not: null,
            },
          },
          select: {
            groupMemberId: true,
            editToken: true,
            child: {
              select: {
                name: true,
                grade: true,
              },
            },
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        })
      : [
          {
            groupMemberId: member.groupMemberId,
            editToken: member.editToken,
            child: {
              name: member.child.name,
              grade: member.child.grade,
            },
            createdAt: member.createdAt,
          },
        ];

    const relatedMemberPayload = relatedMembers
      .filter((relatedMember) => Boolean(relatedMember.editToken))
      .map((relatedMember) => ({
        groupMemberId: relatedMember.groupMemberId,
        childName: relatedMember.child.name,
        childGrade: relatedMember.child.grade,
        editToken: relatedMember.editToken as string,
        isCurrent: relatedMember.groupMemberId === member.groupMemberId,
      }));

    return NextResponse.json({
      success: true,
      groupId: member.group.groupId,
      groupMemberId: member.groupMemberId,
      rosterStatus: member.group.rosterStatus,
      isLocked,
      relatedMembers: relatedMemberPayload,
      member: {
        childName: member.child.name,
        childGrade: member.child.grade,
        priorStudentAttended: member.child.priorStudentAttended,
        siblingsPriorAttended: member.child.siblingsPriorAttended,
        parentPriorAttended: member.child.parentPriorAttended,
        parentName: member.parentName,
        parentPhone: member.parentPhone,
        noteToInstructor: member.noteToInstructor,
        status: member.status,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      },
    });
  } catch (error) {
    console.error('Member Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
