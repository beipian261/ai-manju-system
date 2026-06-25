import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';

// PATCH: 更新分镜的评审状态
export async function PATCH(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const storyboardId = typeof body.storyboardId === 'string' ? body.storyboardId.trim() : '';
  const reviewStatus = typeof body.reviewStatus === 'string' ? body.reviewStatus.trim() : '';

  if (!storyboardId || !reviewStatus) {
    return NextResponse.json({ error: 'storyboardId 和 reviewStatus 必填' }, { status: 400 });
  }

  const validStatuses = ['pending', 'reviewing', 'approved', 'rejected'];
  if (!validStatuses.includes(reviewStatus)) {
    return NextResponse.json({ error: `reviewStatus 必须是: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  try {
    const updated = await prisma.storyboard.update({
      where: { id: storyboardId },
      data: { reviewStatus },
    });

    return NextResponse.json({ storyboard: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update review status';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
