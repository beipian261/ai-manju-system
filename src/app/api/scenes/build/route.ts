import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { buildScene, suggestSceneFlow, expandSceneDetail, SceneType } from '@/lib/scene-builder';
import prisma from '@/lib/prisma-client';

// ============================================================
// POST /api/scenes/build
//   body: { mode: 'single'|'flow'|'expand', ...params }
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const mode = typeof body.mode === 'string' ? body.mode : 'single';

  // ── mode: single — 从描述生成单个场景设定 ──────────────────
  if (mode === 'single') {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) {
      return NextResponse.json({ error: 'description 必填' }, { status: 400 });
    }

    const validSceneTypes: SceneType[] = ['interior', 'exterior', 'urban', 'nature', 'fantasy', 'scifi', 'action', 'intimate', 'crowd', 'void'];
    const rawType = typeof body.sceneType === 'string' ? body.sceneType : '';

    const seed = {
      description: description.slice(0, 500),
      genre: typeof body.genre === 'string' ? body.genre.slice(0, 50) : undefined,
      characters: Array.isArray(body.characters)
        ? (body.characters as unknown[]).filter((c) => typeof c === 'string').map((c) => (c as string).slice(0, 50))
        : undefined,
      sceneType: (validSceneTypes.includes(rawType as SceneType) ? rawType : undefined) as SceneType | undefined,
      emotionalTone: typeof body.emotionalTone === 'string' ? body.emotionalTone.slice(0, 50) : undefined,
      isKeyScene: typeof body.isKeyScene === 'boolean' ? body.isKeyScene : false,
      previousScene: typeof body.previousScene === 'string' ? body.previousScene.slice(0, 200) : undefined,
      style: typeof body.style === 'string' ? body.style.slice(0, 50) : undefined,
    };

    try {
      const result = await buildScene(seed);

      // 如果传了 storyboardId，把场景数据回写到分镜
      const storyboardId = typeof body.storyboardId === 'string' ? body.storyboardId : null;
      if (storyboardId) {
        const existing = await prisma.storyboard.findUnique({
          where: { id: storyboardId },
          select: { id: true },
        });
        if (existing) {
          await prisma.storyboard.update({
            where: { id: storyboardId },
            data: {
              location: result.location || null,
              timeOfDay: result.timeOfDay || null,
              atmosphere: result.atmosphere || null,
              visualKeywords: result.atmosphere
                ? JSON.stringify(result.atmosphere.split(',').map((s) => s.trim()).slice(0, 8))
                : null,
            },
          });
        }
      }

      return NextResponse.json({ scene: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `场景生成失败: ${msg}` }, { status: 500 });
    }
  }

  // ── mode: flow — 从故事大纲生成场景序列 ───────────────────
  if (mode === 'flow') {
    const storyOutline = typeof body.storyOutline === 'string' ? body.storyOutline.trim() : '';
    if (!storyOutline) {
      return NextResponse.json({ error: 'storyOutline 必填' }, { status: 400 });
    }

    const totalScenes = typeof body.totalScenes === 'number' ? body.totalScenes : 5;

    try {
      const result = await suggestSceneFlow({
        storyOutline: storyOutline.slice(0, 1000),
        genre: typeof body.genre === 'string' ? body.genre.slice(0, 50) : undefined,
        totalScenes,
        style: typeof body.style === 'string' ? body.style.slice(0, 50) : undefined,
      });
      return NextResponse.json({ flow: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `场景序列生成失败: ${msg}` }, { status: 500 });
    }
  }

  // ── mode: expand — 扩展已有场景描述 ───────────────────────
  if (mode === 'expand') {
    const currentDescription = typeof body.currentDescription === 'string' ? body.currentDescription.trim() : '';
    if (!currentDescription) {
      return NextResponse.json({ error: 'currentDescription 必填' }, { status: 400 });
    }

    try {
      const result = await expandSceneDetail({
        currentDescription: currentDescription.slice(0, 500),
        genre: typeof body.genre === 'string' ? body.genre.slice(0, 50) : undefined,
        characters: Array.isArray(body.characters)
          ? (body.characters as unknown[]).filter((c) => typeof c === 'string').map((c) => (c as string).slice(0, 50))
          : undefined,
        emotionalTone: typeof body.emotionalTone === 'string' ? body.emotionalTone.slice(0, 50) : undefined,
      });

      // 如果传了 storyboardId，把扩展结果回写
      const storyboardId = typeof body.storyboardId === 'string' ? body.storyboardId : null;
      if (storyboardId && result.expanded) {
        const existing = await prisma.storyboard.findUnique({
          where: { id: storyboardId },
          select: { id: true },
        });
        if (existing) {
          await prisma.storyboard.update({
            where: { id: storyboardId },
            data: {
              atmosphere: result.atmosphere || null,
            },
          });
        }
      }

      return NextResponse.json({ result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `场景扩展失败: ${msg}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `未知 mode: ${mode}，支持 single/flow/expand` }, { status: 400 });
}
