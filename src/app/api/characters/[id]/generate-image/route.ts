import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { generateImage } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { emitProgress } from '@/lib/progress-bus';
import {
  buildCharacterPrompt,
  buildCharacterPortraitPrompt,
  buildCharacterSheet,
} from '@/lib/character-prompt';
import { normalizeStyleKey } from '@/lib/prompt-library';
import { checkApiAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

// 生成角色主形象图：根据角色属性生成 1 张肖像图，存到 Character.referenceImg
// 该图作为后续分镜图生成的"角色一致性"参考

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const character = await prisma.character.findUnique({
    where: { id: id },
  });
  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  emitProgress({
    type: 'image',
    id: character.id,
    status: 'started',
    progress: 0,
    message: `正在为「${character.name}」生成主形象`,
  });

  try {
    const IMAGE_MODEL = await getSetting('AGNES_IMAGE_MODEL');

    // 第一步：获取项目风格信息
    let projectStyle = 'anime';
    const projectId = character.projectId;
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { style: true },
      });
      if (project?.style) projectStyle = project.style;
    }

    // 第二步：使用 CharacterSheet 生成高质量定妆照提示词
    const sheet = buildCharacterSheet({
      name: character.name,
      age: character.age,
      gender: character.gender,
      personality: character.personality,
      clothing: character.clothing,
      appearance: character.appearance,
      hair: character.hair,
      eyes: character.eyes,
      build: character.build,
      referenceImg: character.referenceImg,
    });

    const portraitPrompt = buildCharacterPortraitPrompt(sheet, normalizeStyleKey(projectStyle));

    emitProgress({
      type: 'image',
      id: character.id,
      status: 'progress',
      progress: 30,
      message: `生成 ${character.name} 的定妆照`,
    });

    const response = await generateImage({
      model: IMAGE_MODEL,
      prompt: portraitPrompt,
      size: '1024x1024',
      n: 1,
      negative_prompt: 'low quality, blurry, distorted, deformed, bad anatomy, extra limbs, watermark, text, logo, multiple people, multiple characters, group, crowd',
    });

    const imageUrl = response.data?.[0]?.url || response.data?.[0]?.b64_json || '';
    if (!imageUrl) {
      emitProgress({ type: 'image', id: character.id, status: 'failed', message: '未返回图片 URL' });
      return NextResponse.json({ error: 'Image generation returned no URL' }, { status: 500 });
    }

    await prisma.character.update({
      where: { id: character.id },
      data: { referenceImg: String(imageUrl).slice(0, 100_000) },
    });

    emitProgress({
      type: 'image',
      id: character.id,
      status: 'completed',
      progress: 100,
      message: '主形象已保存',
    });

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Image generation failed';
    logger.error('Character portrait generation failed:', error);
    emitProgress({ type: 'image', id: character.id, status: 'failed', message: msg.slice(0, 200) });
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
