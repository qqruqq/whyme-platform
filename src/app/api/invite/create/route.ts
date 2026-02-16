import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiStatusError } from '@/lib/api/errors';
import { isSerializationConflictError, shouldRetrySerializableError } from '@/lib/api/retry';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

const SHARED_INVITE_MAX_USES = 2147483647;

const inviteCreateSchema = z.object({
  leaderToken: z.string().min(1, 'leaderToken is required'),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

const MAX_SERIALIZABLE_RETRIES = 2;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = inviteCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { leaderToken, expiresInDays } = validation.data;
    const expiresAt = addDays(new Date(), expiresInDays);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    let inviteToken: string | null = null;
    let groupId: string | null = null;
    let createdNew = false;

    for (let attempt = 0; attempt <= MAX_SERIALIZABLE_RETRIES; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const leaderLink = await tx.inviteLink.findUnique({
            where: { token: leaderToken },
            include: { group: true },
          });

          if (!leaderLink) {
            throw new ApiStatusError(404, 'Invalid token');
          }

          if (leaderLink.purpose !== 'leader_only') {
            throw new ApiStatusError(403, 'Forbidden: Not a leader token');
          }

          if (leaderLink.expiresAt && new Date() > leaderLink.expiresAt) {
            throw new ApiStatusError(410, 'Token expired');
          }

          if (leaderLink.group.rosterStatus === 'locked') {
            throw new ApiStatusError(409, 'Roster is locked');
          }

          const now = new Date();
          const existingSharedInvite = await tx.inviteLink.findFirst({
            where: {
              groupId: leaderLink.groupId,
              purpose: 'roster_entry',
              maxUses: SHARED_INVITE_MAX_USES,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              token: true,
            },
          });

          if (existingSharedInvite) {
            return {
              groupId: leaderLink.groupId,
              inviteToken: existingSharedInvite.token,
              createdNew: false,
            };
          }

          const invite = await tx.inviteLink.create({
            data: {
              groupId: leaderLink.groupId,
              token: uuidv4(),
              purpose: 'roster_entry',
              maxUses: SHARED_INVITE_MAX_USES,
              usedCount: 0,
              expiresAt,
            },
            select: {
              token: true,
            },
          });

          return {
            groupId: leaderLink.groupId,
            inviteToken: invite.token,
            createdNew: true,
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        inviteToken = result.inviteToken;
        groupId = result.groupId;
        createdNew = result.createdNew;
        break;
      } catch (error) {
        if (shouldRetrySerializableError(error, attempt, MAX_SERIALIZABLE_RETRIES)) {
          continue;
        }

        throw error;
      }
    }

    if (!inviteToken || !groupId) {
      throw new ApiStatusError(503, 'Temporary concurrency issue. Please retry.');
    }

    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

    return NextResponse.json(
      {
        success: true,
        groupId,
        createdCount: createdNew ? 1 : 0,
        inviteUrl,
        inviteUrls: [inviteUrl],
        reusedExisting: !createdNew,
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

    console.error('Invite Create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
