import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  createInstructorSessionToken,
  hasConfiguredInstructorCode,
  getSessionExpiryDate,
  normalizeInstructorName,
  validateInstructorCode,
  type InternalUserRole,
} from '@/lib/instructor-auth';
import { hashLoginCode, verifyLoginCode } from '@/lib/login-code';
import {
  applyInternalAuthCookies,
  clearInternalAuthCookies,
  createInternalSessionRecord,
  requireInternalUser,
  revokeInternalSessionFromRequest,
} from '@/lib/internal-auth-server';

const loginSchema = z.object({
  name: z.string().trim().min(1, '강사 이름을 입력해주세요.'),
  code: z.string().trim().min(1, '강사 코드를 입력해주세요.'),
});

function normalizedNameKey(value: string): string {
  return normalizeInstructorName(value).toLocaleLowerCase('ko-KR');
}

function parseCodeMap(rawConfig: string): Map<string, string> {
  const codeMap = new Map<string, string>();
  const normalizedRaw = rawConfig.trim();
  if (!normalizedRaw) return codeMap;

  try {
    const parsed = JSON.parse(normalizedRaw) as Record<string, unknown>;
    for (const [name, code] of Object.entries(parsed)) {
      const normalizedName = normalizeInstructorName(name);
      const normalizedCode = typeof code === 'string' ? code.trim() : '';
      if (!normalizedName || !normalizedCode) continue;
      codeMap.set(normalizedNameKey(normalizedName), normalizedCode);
    }
    return codeMap;
  } catch {
    const pairs = normalizedRaw.split(',');
    for (const pair of pairs) {
      const [name, code] = pair.split(':');
      const normalizedName = normalizeInstructorName(name);
      const normalizedCode = (code || '').trim();
      if (!normalizedName || !normalizedCode) continue;
      codeMap.set(normalizedNameKey(normalizedName), normalizedCode);
    }
    return codeMap;
  }
}

function getExpectedOpsCode(name: string): string {
  const opsCodeMap = parseCodeMap(process.env.OPS_LOGIN_CODES || '');
  const configured = opsCodeMap.get(normalizedNameKey(name)) || '';
  if (configured) return configured;

  if (process.env.NODE_ENV !== 'production' && normalizeInstructorName(name) === '실무자') {
    return process.env.OPS_LOGIN_DEFAULT_CODE?.trim() || '0000';
  }
  return '';
}

function getDashboardPathByRole(role: InternalUserRole): string {
  return role === 'instructor' ? '/admin/instructor' : '/admin/ops';
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

async function loginWithLegacyInstructorCode(name: string, code: string) {
  const hasConfiguredCode = hasConfiguredInstructorCode(name);
  if (!hasConfiguredCode) {
    const existing = await prisma.reservationSlot.findFirst({
      where: {
        instructorId: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        slotId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: '등록되지 않은 강사명입니다.' }, { status: 404 });
    }
  }

  const validCode = validateInstructorCode(name, code);
  if (!validCode) {
    return NextResponse.json({ error: '강사 코드가 일치하지 않습니다.' }, { status: 401 });
  }

  const response = loginWithLegacyRole(name, 'instructor');
  response.headers.set('x-legacy-auth', '1');
  return response;
}

function loginWithLegacyRole(name: string, role: InternalUserRole) {
  const sessionToken = createInstructorSessionToken({
    userId: '',
    name,
    role,
  });

  const response = NextResponse.json({
    success: true,
    instructorName: name,
    role,
    dashboardPath: getDashboardPathByRole(role),
    legacyMode: true,
  });
  applyInternalAuthCookies({
    response,
    sessionToken,
    userName: name,
    role,
  });
  return response;
}

export async function GET(request: Request) {
  try {
    const auth = await requireInternalUser(request);
    if (!auth.user) {
      return NextResponse.json({
        success: true,
        authenticated: false,
      });
    }

    const user = auth.user;
    return NextResponse.json({
      success: true,
      authenticated: true,
      instructorName: user.name,
      role: user.role,
      dashboardPath: getDashboardPathByRole(user.role),
    });
  } catch (error) {
    console.error('Instructor Auth GET Error:', error);
    return NextResponse.json({
      success: true,
      authenticated: false,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const name = normalizeInstructorName(validation.data.name);
    const code = validation.data.code.trim();

    let user:
      | {
          userId: string;
          role: InternalUserRole;
          status: string;
          name: string;
          instructorCodeHash: string | null;
        }
      | null;
    try {
      user = await prisma.internalUser.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        const expectedOpsCode = getExpectedOpsCode(name);
        if (expectedOpsCode && expectedOpsCode === code) {
          return loginWithLegacyRole(name, 'admin');
        }
        return loginWithLegacyInstructorCode(name, code);
      }
      throw error;
    }

    if (user && user.status !== 'active') {
      return NextResponse.json({ error: '사용이 중지된 계정입니다.' }, { status: 403 });
    }

    if (user) {
      const role = user.role;
      const validWithHash = verifyLoginCode(code, user.instructorCodeHash);
      const validWithLegacyInstructorCode = role === 'instructor' && validateInstructorCode(name, code);
      const expectedOpsCode = role !== 'instructor' ? getExpectedOpsCode(name) : '';
      const validWithOpsCode = role !== 'instructor' && !!expectedOpsCode && expectedOpsCode === code;

      if (!validWithHash && !validWithLegacyInstructorCode && !validWithOpsCode) {
        return NextResponse.json({ error: '강사 코드가 일치하지 않습니다.' }, { status: 401 });
      }

      if (!user.instructorCodeHash) {
        user = await prisma.internalUser.update({
          where: {
            userId: user.userId,
          },
          data: {
            instructorCodeHash: hashLoginCode(code),
          },
        });
      }
    } else {
      let role: InternalUserRole = 'instructor';
      const expectedOpsCode = getExpectedOpsCode(name);
      if (expectedOpsCode && expectedOpsCode === code) {
        role = 'admin';
      } else {
        const hasConfiguredCode = hasConfiguredInstructorCode(name);
        if (!hasConfiguredCode) {
          const existing = await prisma.reservationSlot.findFirst({
            where: {
              instructorId: {
                equals: name,
                mode: 'insensitive',
              },
            },
            select: {
              slotId: true,
            },
          });

          if (!existing) {
            return NextResponse.json({ error: '등록되지 않은 강사명입니다.' }, { status: 404 });
          }
        }

        const validCode = validateInstructorCode(name, code);
        if (!validCode) {
          return NextResponse.json({ error: '강사 코드가 일치하지 않습니다.' }, { status: 401 });
        }
      }

      try {
        user = await prisma.internalUser.create({
          data: {
            role,
            status: 'active',
            name,
            instructorCodeHash: hashLoginCode(code),
          },
        });
      } catch (error) {
        if (isMissingTableError(error)) {
          if (role !== 'instructor') {
            return loginWithLegacyRole(name, role);
          }
          return loginWithLegacyInstructorCode(name, code);
        }
        throw error;
      }
    }

    const sessionToken = createInstructorSessionToken({
      userId: user.userId,
      name: user.name,
      role: user.role,
    });
    const expiresAt = getSessionExpiryDate();

    await prisma.internalUser.update({
      where: {
        userId: user.userId,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });
    try {
      await createInternalSessionRecord({
        userId: user.userId,
        sessionToken,
        expiresAt,
        request,
      });
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error;
      }
    }

    const response = NextResponse.json({
      success: true,
      instructorName: user.name,
      role: user.role,
      dashboardPath: getDashboardPathByRole(user.role),
    });
    applyInternalAuthCookies({
      response,
      sessionToken,
      userName: user.name,
      role: user.role,
    });

    return response;
  } catch (error) {
    console.error('Instructor Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await revokeInternalSessionFromRequest(request);
  } catch (_error) {
    // noop
  }

  const response = NextResponse.json({ success: true });
  clearInternalAuthCookies(response);
  return response;
}
