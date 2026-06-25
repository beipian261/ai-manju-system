// 角色定妆照生成 API
// 为每个角色生成标准参考图，确保所有分镜中角色外貌一致
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { getSetting } from '@/lib/config/settings';
import { generateImage as agnesGenerateImage } from '@/lib/ai/agnes-client';
import {
  buildCharacterSheet,
  buildCharacterPortraitPrompt,
  buildNegativePrompt,
  CharacterSheet,
} from '@/features/characters/character-prompt';
import { normalizeStyleKey } from '@/features/generation/prompt-library';

// 定妆照视角配置
const PORTRAIT_VIEWS = [
  { key: 'front', name: '正面照', prompt: 'front view, looking at camera, centered portrait' },
  { key: 'side', name: '侧面照', prompt: 'side view, profile portrait' },
  { key: 'three_quarter', name: '四分之三身', prompt: 'three-quarter view, upper body portrait' },
];

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const characterId = typeof body.characterId === 'string' ? body.characterId.trim() : '';
  const view = typeof body.view === 'string' ? body.view : 'front';
  const forceRegenerate = body.forceRegenerate === true;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 获取项目风格
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { style: true },
  });
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const styleKey = normalizeStyleKey(project.style || 'anime');
  const IMAGE_MODEL = await getSetting('AGNES_IMAGE_MODEL');

  // 如果指定了单个角色
  if (characterId) {
    const character = await prisma.character.findUnique({ where: { id: characterId } });
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 如果已有定妆照且不强制重新生成
    if (character.referenceImg && !forceRegenerate) {
      return NextResponse.json({
        success: true,
        characterId: character.id,
        name: character.name,
        referenceImg: character.referenceImg,
        reused: true,
      });
    }

    // 生成定妆照
    const result = await generateCharacterPortrait(character, styleKey, IMAGE_MODEL, view);
    
    // 保存到角色
    await prisma.character.update({
      where: { id: characterId },
      data: { referenceImg: result.imageUrl },
    });

    return NextResponse.json({
      success: true,
      characterId: character.id,
      name: character.name,
      referenceImg: result.imageUrl,
      view,
      reused: false,
    });
  }

  // 批量生成所有角色的定妆照
  const characters = await prisma.character.findMany({ where: { projectId } });
  if (characters.length === 0) {
    return NextResponse.json({ error: '项目中没有角色' }, { status: 400 });
  }

  const results = [];
  for (const character of characters) {
    // 已有定妆照且不强制重新生成则跳过
    if (character.referenceImg && !forceRegenerate) {
      results.push({
        characterId: character.id,
        name: character.name,
        referenceImg: character.referenceImg,
        reused: true,
      });
      continue;
    }

    try {
      const result = await generateCharacterPortrait(character, styleKey, IMAGE_MODEL, 'front');
      await prisma.character.update({
        where: { id: character.id },
        data: { referenceImg: result.imageUrl },
      });
      results.push({
        characterId: character.id,
        name: character.name,
        referenceImg: result.imageUrl,
        reused: false,
      });
    } catch (e) {
      results.push({
        characterId: character.id,
        name: character.name,
        error: e instanceof Error ? e.message : String(e),
        reused: false,
      });
    }
  }

  const successCount = results.filter(r => r.referenceImg).length;

  return NextResponse.json({
    success: successCount > 0,
    projectId,
    total: characters.length,
    generated: successCount,
    results,
  });
}

async function generateCharacterPortrait(
  character: {
    id: string;
    name: string;
    age?: string | null;
    gender?: string | null;
    personality?: string | null;
    clothing?: string | null;
    appearance?: string | null;
    hair?: string | null;
    eyes?: string | null;
    build?: string | null;
    referenceImg?: string | null;
  },
  styleKey: string,
  model: string,
  view: string
): Promise<{ imageUrl: string }> {
  const sheet = buildCharacterSheet(character);
  const portraitPrompt = buildCharacterPortraitPrompt(sheet, styleKey as keyof typeof import('@/features/generation/prompt-library').ART_STYLES);
  
  // 增加视角描述
  const viewConfig = PORTRAIT_VIEWS.find(v => v.key === view) || PORTRAIT_VIEWS[0];
  const fullPrompt = `${portraitPrompt}, ${viewConfig.prompt}`;

  const negative = buildNegativePrompt({ style: styleKey });

  // 使用第一个角色作为参考（如果有的话）
  const characterRef = character.referenceImg || undefined;

  const response = await agnesGenerateImage({
    model,
    prompt: fullPrompt,
    size: '1024x1024',
    n: 1,
    quality: 'hd',
    character_ref: characterRef,
    negative_prompt: negative,
  });

  const imageUrl = response.data?.[0]?.url || response.data?.[0]?.b64_json || '';
  if (!imageUrl) {
    throw new Error('图片生成失败');
  }

  return { imageUrl };
}

// GET: 获取可用视角
export async function GET() {
  return NextResponse.json({
    views: PORTRAIT_VIEWS,
    description: '角色定妆照 - 为每个角色生成标准参考图，确保所有分镜中角色外貌一致',
    features: [
      '标准正面定妆照',
      '多视角参考（正面/侧面/四分之三）',
      '固定种子增强一致性',
      '自动保存为角色参考图',
      '后续分镜自动使用参考图',
    ],
  });
}