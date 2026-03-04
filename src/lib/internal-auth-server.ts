import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedSession,
  getCookieValue,
  hashSessionToken,
  INTERNAL_ROLE_COOKIE,
  INSTRUCTOR_NAME_COOKIE,
  INSTRUCTOR_SESSION_COOKIE,
  INSTRUCTOR_SESSION_MAX_AGE_SECONDS,
  type InternalUserRole,
} from '@/lib/instructor-auth';

export type AuthenticatedInternalUser = {
  userId: string;
  role: InternalUserRole;
  name: string;
  loginId: string | null;
  phone: string | null;
  email: string | null;
};

type RequireInternalUserOptions = {
  roles?: InternalUserRole[];
};

const baseCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: INSTRUCTOR_SESSION_MAX_AGE_SECONDS,
};

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

function canFallbackLegacyRole(params: { role: InternalUserRole; roles?: InternalUserRole[] }): boolean {
  if (!params.roles || params.roles.length === 0) return true;
  return params.roles.includes(params.role);
}

export function applyInternalAuthCookies(params: {
  response: NextResponse;
  sessionToken: string;
  userName: string;
  role: InternalUserRole;
}) {
  params.response.cookies.set(INSTRUCTOR_SESSION_COOKIE, params.sessionToken, {
    ...baseCookieOptions,
    httpOnly: true,
  });
  params.response.cookies.set(INSTRUCTOR_NAME_COOKIE, params.userName, {
    ...baseCookieOptions,
    httpOnly: false,
  });
  params.response.cookies.set(INTERNAL_ROLE_COOKIE, params.role, {
    ...baseCookieOptions,
    httpOnly: false,
  });
}

export function clearInternalAuthCookies(response: NextResponse) {
  response.cookies.set(INSTRUCTOR_SESSION_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(INSTRUCTOR_NAME_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(INTERNAL_ROLE_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });
}

export async function createInternalSessionRecord(params: {
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  request: Request;
}) {
  const forwardedFor = params.request.headers.get('x-forwarded-for') || '';
  const firstIp = forwardedFor.split(',').map((ip) => ip.trim()).find(Boolean) || null;
  const userAgent = params.request.headers.get('user-agent') || null;

  await prisma.internalUserSession.create({
    data: {
      userId: params.userId,
      tokenHash: hashSessionToken(params.sessionToken),
      expiresAt: params.expiresAt,
      ipAddress: firstIp,
      userAgent,
    },
  });
}

export async function revokeInternalSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getCookieValue(cookieHeader, INSTRUCTOR_SESSION_COOKIE);
  if (!sessionToken) return;

  await prisma.internalUserSession.updateMany({
    where: {
      tokenHash: hashSessionToken(sessionToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function requireInternalUser(
  request: Request,
  options: RequireInternalUserOptions = {}
): Promise<{ user: AuthenticatedInternalUser | null; response: NextResponse | null }> {
  const session = getAuthenticatedSession(request);
  if (!session) {
    return {
      user: null,
      response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }),
    };
  }

  if (!session.userId) {
    if (canFallbackLegacyRole({ role: session.role, roles: options.roles })) {
      return {
        user: {
          userId: '',
          role: session.role,
          name: session.name,
          loginId: null,
          phone: null,
          email: null,
        },
        response: null,
      };
    }
    return {
      user: null,
      response: NextResponse.json({ error: '세션 정보가 유효하지 않습니다. 다시 로그인해주세요.' }, { status: 401 }),
    };
  }

  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getCookieValue(cookieHeader, INSTRUCTOR_SESSION_COOKIE);
  if (!sessionToken) {
    return {
      user: null,
      response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }),
    };
  }

  const now = new Date();
  try {
    const sessionRow = await prisma.internalUserSession.findFirst({
      where: {
        userId: session.userId,
        tokenHash: hashSessionToken(sessionToken),
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      include: {
        user: {
          select: {
            userId: true,
            role: true,
            status: true,
            name: true,
            loginId: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!sessionRow) {
      return {
        user: null,
        response: NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 }),
      };
    }

    if (sessionRow.user.status !== 'active') {
      return {
        user: null,
        response: NextResponse.json({ error: '사용이 중지된 계정입니다.' }, { status: 403 }),
      };
    }

    if (options.roles?.length && !options.roles.includes(sessionRow.user.role)) {
      return {
        user: null,
        response: NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 }),
      };
    }

    return {
      user: {
        userId: sessionRow.user.userId,
        role: sessionRow.user.role,
        name: sessionRow.user.name,
        loginId: sessionRow.user.loginId,
        phone: sessionRow.user.phone,
        email: sessionRow.user.email,
      },
      response: null,
    };
  } catch (error) {
    if (isMissingTableError(error) && canFallbackLegacyRole({ role: session.role, roles: options.roles })) {
      return {
        user: {
          userId: '',
          role: session.role,
          name: session.name,
          loginId: null,
          phone: null,
          email: null,
        },
        response: null,
      };
    }
    throw error;
  }
}
