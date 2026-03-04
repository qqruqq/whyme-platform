import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireInternalUser } from '@/lib/internal-auth-server';

const paramsSchema = z.object({
  instructorId: z.string().uuid('instructorId 형식이 올바르지 않습니다.'),
});

const updateInstructorSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요.').max(80, '이름은 80자 이하여야 합니다.').optional(),
    role: z.string().trim().min(1, '역할을 입력해주세요.').max(80, '역할은 80자 이하여야 합니다.').optional(),
    summary: z.string().trim().max(120, '한 줄 소개는 120자 이하여야 합니다.').optional(),
    description: z
      .string()
      .trim()
      .min(1, '소개 설명을 입력해주세요.')
      .max(800, '소개 설명은 800자 이하여야 합니다.')
      .optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.role !== undefined ||
      data.summary !== undefined ||
      data.description !== undefined ||
      data.sortOrder !== undefined ||
      data.isActive !== undefined,
    {
      message: '최소 1개 이상의 변경 항목이 필요합니다.',
      path: ['name'],
    }
  );

function normalizeNullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

type RouteContext = {
  params: Promise<{
    instructorId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireInternalUser(request, { roles: ['admin', 'super_admin'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const params = await context.params;
    const paramValidation = paramsSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: paramValidation.error.flatten() },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateInstructorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const updated = await prisma.landingInstructor.update({
      where: {
        instructorId: paramValidation.data.instructorId,
      },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.role !== undefined ? { role: data.role.trim() } : {}),
        ...(data.summary !== undefined ? { summary: normalizeNullableText(data.summary) } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      row: updated,
    });
  } catch (error) {
    console.error('Admin Content Instructor PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = await requireInternalUser(request, { roles: ['admin', 'super_admin'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const params = await context.params;
    const paramValidation = paramsSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: paramValidation.error.flatten() },
        { status: 400 }
      );
    }

    await prisma.landingInstructor.delete({
      where: {
        instructorId: paramValidation.data.instructorId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Admin Content Instructor DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
