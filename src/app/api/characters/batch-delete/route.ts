import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

// ============================================================
// POST /api/characters/batch-delete
// 批量删除角色
//
// Body: {
//   ids: string[]    (要删除的角色 ID 数组)
// }
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') as string[] : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids 不能为空' }, { status: 400 });
  }

  try {
    const result = await prisma.character.deleteMany({
      where: { id: { in: ids } },
    });
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count 
    }, { status: 200 });
  } catch (e) {
    console.error('[batch-delete] Failed to delete characters:', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}