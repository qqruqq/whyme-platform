import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireInternalUser } from '@/lib/internal-auth-server';

const createInstructorSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(80, '이름은 80자 이하여야 합니다.'),
  role: z.string().trim().min(1, '역할을 입력해주세요.').max(80, '역할은 80자 이하여야 합니다.'),
  summary: z.string().trim().max(120, '한 줄 소개는 120자 이하여야 합니다.').optional(),
  description: z
    .string()
    .trim()
    .min(1, '소개 설명을 입력해주세요.')
    .max(800, '소개 설명은 800자 이하여야 합니다.'),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

function normalizeNullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireInternalUser(request, { roles: ['admin', 'super_admin'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const rows = await prisma.landingInstructor.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error('Admin Content Instructors GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireInternalUser(request, { roles: ['admin', 'super_admin'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const body = await request.json();
    const validation = createInstructorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const created = await prisma.landingInstructor.create({
      data: {
        name: data.name.trim(),
        role: data.role.trim(),
        summary: normalizeNullableText(data.summary),
        description: data.description.trim(),
        sortOrder: data.sortOrder ?? 100,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      row: created,
    });
  } catch (error) {
    console.error('Admin Content Instructors POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
