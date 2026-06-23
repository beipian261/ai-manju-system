import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { generateCast, CastSeed } from '@/lib/character-generator';

// ============================================================
// POST /api/characters/generate-cast
// 一键生成角色阵容：根据题材批量生成主角+配角+反派
//
// Body: {
//   genre?: string      (题材：fantasy/scifi/romance/mystery/action)
//   style?: string      (艺术风格：anime/...)
//   theme?: string      (故事主题/背景描述)
//   castSize?: number   (角色数量，2-8，默认 3)
//   projectId?: string  (如果提供，生成后自动写入 DB)
//   saveToDb?: boolean  (是否写入 DB，默认 false；提供 projectId 时默认 true)
// }
// ============================================================

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max).trim();
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const castSize = typeof body.castSize === 'number'
    ? Math.max(2, Math.min(8, Math.floor(body.castSize)))
    : 3;

  const seed: CastSeed = {
    genre: trimStr(body.genre, 50) || undefined,
    style: trimStr(body.style, 50) || undefined,
    theme: trimStr(body.theme, 500) || undefined,
    castSize,
  };

  try {
    const cast = await generateCast(seed);

    if (cast.length === 0) {
      return NextResponse.json({ error: 'AI 返回了空的角色阵容，请重试' }, { status: 500 });
    }

    // 如果提供了 projectId，写入数据库
    const projectId = trimStr(body.projectId, 64);
    const saveToDb = body.saveToDb !== false && projectId.length > 0;

    let savedCharacters: { id: string; name: string }[] = [];
    if (saveToDb && projectId) {
      // 验证项目存在
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 });
      }

      // 批量写入
      const createResults = await Promise.allSettled(
        cast.map((c) =>
          prisma.character.create({
            data: {
              name: c.name,
              gender: c.gender || null,
              age: c.age || null,
              personality: c.personality || null,
              clothing: c.clothing || null,
              appearance: c.appearance || null,
              hair: c.hair || null,
              eyes: c.eyes || null,
              build: c.build || null,
              expressions: c.expressions || null,
              signaturePose: c.signaturePose || null,
              colorScheme: c.colorScheme || null,
              projectId,
            },
          })
        )
      );

      savedCharacters = createResults
        .filter((r) => r.status === 'fulfilled')
        .map((r) => {
          const rec = (r as PromiseFulfilledResult<{ id: string; name: string }>).value;
          return { id: rec.id, name: rec.name };
        });
    }

    return NextResponse.json({
      cast,
      count: cast.length,
      saved: savedCharacters,
      projectId: projectId || null,
    }, { status: saveToDb && projectId ? 201 : 200 });

  } catch (e) {
    console.error('[generate-cast] error:', e);
    const msg = e instanceof Error ? e.message : '角色阵容生成失败';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
