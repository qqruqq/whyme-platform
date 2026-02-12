import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Invalid edit token' }, { status: 404 });
    }

    const isLocked = member.group.rosterStatus === 'locked';

    return NextResponse.json({
      success: true,
      groupId: member.group.groupId,
      groupMemberId: member.groupMemberId,
      rosterStatus: member.group.rosterStatus,
      isLocked,
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
