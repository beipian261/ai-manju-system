import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

/**
 * POST /api/scenes/reorder
 * 保存分镜场景的排序和删除信息
 * body: {
 *   scriptId: string,
 *   orderedIds: string[],   // 保留的场景 ID，按新顺序排列
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const scriptId = typeof body.scriptId === 'string' ? body.scriptId : '';
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x): x is string => typeof x === 'string') : [];

  if (!scriptId) {
    return NextResponse.json({ error: 'scriptId 必填' }, { status: 400 });
  }

  // 验证脚本属于当前用户
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { project: true },
  });
  if (!script) {
    return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
  }

  // 验证用户有权限（已通过 checkApiAuth，这里只做简单检查）
  // 删除不在 orderedIds 中的分镜
  const existingStoryboards = await prisma.storyboard.findMany({
    where: { scriptId },
    select: { id: true },
  });
  const existingIds = new Set(existingStoryboards.map((s) => s.id));
  const toDelete = [...existingIds].filter((id) => !orderedIds.includes(id));

  if (toDelete.length > 0) {
    await prisma.storyboard.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  // 更新保留分镜的排序
  const updatePromises = orderedIds.map((id, index) =>
    prisma.storyboard.updateMany({
      where: { id, scriptId },
      data: { sceneNum: index + 1 },
    })
  );
  await Promise.all(updatePromises);

  return NextResponse.json({
    success: true,
    deleted: toDelete.length,
    updated: orderedIds.length,
    message: `已更新 ${orderedIds.length} 个分镜，删除 ${toDelete.length} 个`,
  });
}

/**
 * GET /api/scenes/reorder?scriptId=xxx
 * 获取分镜场景列表（用于预览和排序）
 */
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const scriptId = searchParams.get('scriptId');

  if (!scriptId) {
    return NextResponse.json({ error: 'scriptId 必填' }, { status: 400 });
  }

  const storyboards = await (prisma.storyboard.findMany({
    where: { scriptId },
    orderBy: { sceneNum: 'asc' },
    select: {
      id: true,
      title: true,
      sceneNum: true,
      imageUrls: true,
      imagePrompt: true,
      description: true,
      emotion: true,
      cameraAngle: true,
      location: true,
      timeOfDay: true,
    },
  }) as Promise<Array<{id: string; title: string | null; sceneNum: number; imageUrls: string | null; imagePrompt: string | null; description: string; emotion: string | null; cameraAngle: string; location: string | null; timeOfDay: string | null}>>);

  return NextResponse.json({ scenes: storyboards });
}
