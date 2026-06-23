// 角色 DNA 锁定 API
// 锁定后，生图时强制注入该角色的所有参考图 + 特征摘要
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { chatCompletion } from '@/lib/agnes-client';
import { buildCharacterSheet } from '@/lib/character-prompt';

// POST: 锁定/解锁角色 DNA
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const characterId = params.id;
  if (!characterId) {
    return NextResponse.json({ error: '角色 ID 必填' }, { status: 400 });
  }

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { assets: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
  });
  if (!character) {
    return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body 可选
  }

  const lock = body.lock !== false; // 默认锁定

  if (lock) {
    // 锁定前检查：至少有 1 张参考图
    if (character.assets.length === 0 && !character.referenceImg) {
      return NextResponse.json(
        { error: '锁定 DNA 需要至少 1 张参考图，请先上传' },
        { status: 400 }
      );
    }

    // AI 生成角色特征摘要（用于后续生图注入 prompt）
    let dnaSummary = character.dnaSummary;
    if (!dnaSummary) {
      try {
        const sheet = buildCharacterSheet(character);
        const CHAT_MODEL = await getSetting('AGNES_CHAT_MODEL');

        const summaryResponse = await chatCompletion({
          model: CHAT_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a character design assistant. Generate a concise English visual summary of this character for AI image generation. Focus on: face shape, hair color and style, eye color, body type, clothing, and any distinctive features. Keep it under 200 words. Output ONLY the summary, no preamble.',
            },
            {
              role: 'user',
              content: sheet.englishDescription,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        });

        dnaSummary = summaryResponse.choices?.[0]?.message?.content?.trim() || null;
      } catch (e) {
        console.warn('[character-dna] AI summary generation failed:', e);
        // 失败不阻断锁定流程
      }
    }

    const updated = await prisma.character.update({
      where: { id: characterId },
      data: {
        dnaLocked: true,
        dnaSummary,
      },
      include: { assets: true },
    });

    return NextResponse.json({
      success: true,
      character: updated,
      message: `角色「${character.name}」DNA 已锁定，后续生图将强制注入 ${updated.assets.length} 张参考图`,
    });
  } else {
    // 解锁
    const updated = await prisma.character.update({
      where: { id: characterId },
      data: { dnaLocked: false },
      include: { assets: true },
    });

    return NextResponse.json({
      success: true,
      character: updated,
      message: `角色「${character.name}」DNA 已解锁`,
    });
  }
}

// GET: 获取角色 DNA 状态
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const character = await prisma.character.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      dnaLocked: true,
      dnaSummary: true,
      referenceImg: true,
      assets: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!character) {
    return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  }

  return NextResponse.json({
    character,
    assetCount: character.assets.length,
    canLock: character.assets.length > 0 || !!character.referenceImg,
  });
}
