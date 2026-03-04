import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashLoginCode } from '@/lib/login-code';
import { requireInternalUser } from '@/lib/internal-auth-server';

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요.').max(80, '이름은 80자 이하여야 합니다.').optional(),
    phone: z.string().trim().max(30, '연락처는 30자 이하여야 합니다.').optional(),
    email: z
      .string()
      .trim()
      .email('이메일 형식이 올바르지 않습니다.')
      .max(120, '이메일은 120자 이하여야 합니다.')
      .optional(),
    code: z.string().trim().min(4, '코드는 4자리 이상이어야 합니다.').max(64, '코드는 64자 이하여야 합니다.').optional(),
  })
  .refine((data) => data.name !== undefined || data.phone !== undefined || data.email !== undefined || data.code !== undefined, {
    message: '최소 1개 이상의 변경 항목이 필요합니다.',
    path: ['name'],
  });

function normalizeNullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireInternalUser(request);
    if (!auth.user) {
      return auth.response as NextResponse;
    }
    if (!auth.user.userId) {
      return NextResponse.json(
        { error: '내부 사용자 테이블 초기화가 필요합니다. 마이그레이션 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

    const user = await prisma.internalUser.findUnique({
      where: {
        userId: auth.user.userId,
      },
      select: {
        userId: true,
        role: true,
        status: true,
        loginId: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Admin Profile GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireInternalUser(request);
    if (!auth.user) {
      return auth.response as NextResponse;
    }
    if (!auth.user.userId) {
      return NextResponse.json(
        { error: '내부 사용자 테이블 초기화가 필요합니다. 마이그레이션 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const updateData: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      instructorCodeHash?: string;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    const normalizedPhone = normalizeNullableText(data.phone);
    if (normalizedPhone !== undefined) {
      updateData.phone = normalizedPhone;
    }

    const normalizedEmail = normalizeNullableText(data.email);
    if (normalizedEmail !== undefined) {
      updateData.email = normalizedEmail;
    }

    if (data.code !== undefined) {
      updateData.instructorCodeHash = hashLoginCode(data.code);
    }

    const updated = await prisma.internalUser.update({
      where: {
        userId: auth.user.userId,
      },
      data: updateData,
      select: {
        userId: true,
        role: true,
        status: true,
        loginId: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error) {
    console.error('Admin Profile PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
