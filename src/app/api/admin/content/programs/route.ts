import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireInternalUser } from '@/lib/internal-auth-server';

const createProgramSchema = z.object({
  title: z.string().trim().min(1, '프로그램명을 입력해주세요.').max(100, '프로그램명은 100자 이하여야 합니다.'),
  description: z
    .string()
    .trim()
    .min(1, '프로그램 설명을 입력해주세요.')
    .max(900, '프로그램 설명은 900자 이하여야 합니다.'),
  highlights: z.string().trim().max(900, '핵심 포인트는 900자 이하여야 합니다.').optional(),
  color: z.string().trim().min(1, '색상을 입력해주세요.').max(40, '색상 값이 너무 깁니다.').optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireInternalUser(request, { roles: ['admin', 'super_admin'] });
    if (!auth.user) {
      return auth.response as NextResponse;
    }

    const rows = await prisma.landingProgram.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error('Admin Content Programs GET Error:', error);
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
    const validation = createProgramSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const created = await prisma.landingProgram.create({
      data: {
        title: data.title.trim(),
        description: data.description.trim(),
        highlights: data.highlights?.trim() || '',
        color: data.color?.trim() || '#1f4e79',
        sortOrder: data.sortOrder ?? 100,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      row: created,
    });
  } catch (error) {
    console.error('Admin Content Programs POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
