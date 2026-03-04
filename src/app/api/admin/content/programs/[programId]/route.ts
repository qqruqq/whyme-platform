import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireInternalUser } from '@/lib/internal-auth-server';

const paramsSchema = z.object({
  programId: z.string().uuid('programId 형식이 올바르지 않습니다.'),
});

const updateProgramSchema = z
  .object({
    title: z.string().trim().min(1, '프로그램명을 입력해주세요.').max(100, '프로그램명은 100자 이하여야 합니다.').optional(),
    description: z
      .string()
      .trim()
      .min(1, '프로그램 설명을 입력해주세요.')
      .max(900, '프로그램 설명은 900자 이하여야 합니다.')
      .optional(),
    highlights: z.string().trim().max(900, '핵심 포인트는 900자 이하여야 합니다.').optional(),
    color: z.string().trim().min(1, '색상을 입력해주세요.').max(40, '색상 값이 너무 깁니다.').optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.highlights !== undefined ||
      data.color !== undefined ||
      data.sortOrder !== undefined ||
      data.isActive !== undefined,
    {
      message: '최소 1개 이상의 변경 항목이 필요합니다.',
      path: ['title'],
    }
  );

type RouteContext = {
  params: Promise<{
    programId: string;
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
    const validation = updateProgramSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const updated = await prisma.landingProgram.update({
      where: {
        programId: paramValidation.data.programId,
      },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() } : {}),
        ...(data.highlights !== undefined ? { highlights: data.highlights.trim() } : {}),
        ...(data.color !== undefined ? { color: data.color.trim() } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      row: updated,
    });
  } catch (error) {
    console.error('Admin Content Program PATCH Error:', error);
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

    await prisma.landingProgram.delete({
      where: {
        programId: paramValidation.data.programId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Admin Content Program DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
