import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  createInstructorSessionToken,
  getAuthenticatedInstructorName,
  hasConfiguredInstructorCode,
  INSTRUCTOR_NAME_COOKIE,
  INSTRUCTOR_SESSION_COOKIE,
  INSTRUCTOR_SESSION_MAX_AGE_SECONDS,
  normalizeInstructorName,
  validateInstructorCode,
} from '@/lib/instructor-auth';

const loginSchema = z.object({
  name: z.string().trim().min(1, '강사 이름을 입력해주세요.'),
  code: z.string().trim().min(1, '강사 코드를 입력해주세요.'),
});

const cookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: INSTRUCTOR_SESSION_MAX_AGE_SECONDS,
};

export async function GET(request: Request) {
  const instructorName = getAuthenticatedInstructorName(request);
  if (!instructorName) {
    return NextResponse.json({
      success: true,
      authenticated: false,
    });
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    instructorName,
  });
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

    const sessionToken = createInstructorSessionToken(name);
    const response = NextResponse.json({
      success: true,
      instructorName: name,
    });

    response.cookies.set(INSTRUCTOR_SESSION_COOKIE, sessionToken, {
      ...cookieOptions,
      httpOnly: true,
    });
    response.cookies.set(INSTRUCTOR_NAME_COOKIE, name, {
      ...cookieOptions,
      httpOnly: false,
    });

    return response;
  } catch (error) {
    console.error('Instructor Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(INSTRUCTOR_SESSION_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(INSTRUCTOR_NAME_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
