import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{
    leaderToken: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { leaderToken } = await params;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const leaderLink = await prisma.inviteLink.findUnique({
      where: { token: leaderToken },
      include: {
        group: {
          include: {
            leader: {
              select: {
                phone: true,
              },
            },
            slot: {
              select: {
                startAt: true,
                endAt: true,
                instructorId: true,
              },
            },
            inviteLinks: {
              where: {
                purpose: 'roster_entry',
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                token: true,
                expiresAt: true,
              },
            },
            groupMembers: {
              where: {
                status: {
                  not: 'removed',
                },
              },
              include: {
                child: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
    });

    if (!leaderLink) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (leaderLink.purpose !== 'leader_only') {
      return NextResponse.json({ error: 'Forbidden: Not a leader token' }, { status: 403 });
    }

    if (leaderLink.expiresAt && new Date() > leaderLink.expiresAt) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }

    const members = leaderLink.group.groupMembers.map((member) => ({
      groupMemberId: member.groupMemberId,
      childId: member.childId,
      childName: member.child.name,
      childGrade: member.child.grade,
      parentName: member.parentName,
      parentPhone: member.parentPhone,
      status: member.status,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }));

    const completedCount = members.filter((member) => member.status === 'completed').length;
    const pendingCount = members.filter((member) => member.status === 'pending').length;
    const sharedInvite = leaderLink.group.inviteLinks[0] ?? null;
    const leaderEditableMember = leaderLink.group.groupMembers.find(
      (member) =>
        member.status !== 'removed' &&
        member.parentPhone === leaderLink.group.leader.phone &&
        Boolean(member.editToken)
    );

    return NextResponse.json({
      success: true,
      groupId: leaderLink.group.groupId,
      status: leaderLink.group.status,
      rosterStatus: leaderLink.group.rosterStatus,
      classStartAt: leaderLink.group.slot.startAt,
      classEndAt: leaderLink.group.slot.endAt,
      instructorName: leaderLink.group.slot.instructorId,
      sharedInviteUrl: sharedInvite ? `${baseUrl}/invite/${sharedInvite.token}` : null,
      sharedInviteExpiresAt: sharedInvite?.expiresAt ?? null,
      leaderEditToken: leaderEditableMember?.editToken ?? null,
      headcountDeclared: leaderLink.group.headcountDeclared,
      headcountFinal: leaderLink.group.headcountFinal,
      counts: {
        total: members.length,
        completed: completedCount,
        pending: pendingCount,
      },
      members,
    });
  } catch (error) {
    console.error('Manage Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
