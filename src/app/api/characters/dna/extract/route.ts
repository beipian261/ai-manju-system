// POST /api/characters/dna/extract
// AI 从角色描述提取结构化 DNA 摘要，写入 dnaSummary 字段

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import prisma from '@/lib/prisma-client';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: { characterId?: string; projectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  // 支持单角色和批量（projectId = 全项目角色）
  if (body.characterId) {
    const result = await extractDNA(body.characterId);
    return NextResponse.json(result);
  }

  if (body.projectId) {
    const characters = await prisma.character.findMany({ where: { projectId: body.projectId } });
    const results = [];
    for (const c of characters) {
      results.push(await extractDNA(c.id));
    }
    return NextResponse.json({ success: true, results });
  }

  return NextResponse.json({ error: 'characterId 或 projectId 必填' }, { status: 400 });
}

async function extractDNA(characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { assets: { where: { isPrimary: true }, take: 1 } },
  });

  if (!character) {
    return { success: false, error: '角色不存在' };
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const sysPrompt = `你是一位角色 DNA 提取专家。根据角色描述，生成用于图像生成的、极其精简的英文 DNA 摘要。

DNA 摘要必须满足以下要求：
1. 必须是纯英文，50-100 词以内
2. 包含：face shape/features, hair, eyes, skin, body type, outfit, signature details
3. 必须是**可注入提示词**的格式——像 "round face, freckles, messy blonde hair, bright blue eyes, pale skin, lean build, worn leather jacket, signature crooked hat" 这样
4. 只输出 DNA 文本，不要任何解释、标签、markdown

关键是：这个文本会被直接拼接到图片生成提示词中，所以必须简洁、精确、像专业 prompt。`;

  const charDesc = [
    `Name: ${character.name}`,
    character.gender && `Gender: ${character.gender}`,
    character.age && `Age: ${character.age}`,
    character.appearance && `Appearance: ${character.appearance}`,
    character.hair && `Hair: ${character.hair}`,
    character.eyes && `Eyes: ${character.eyes}`,
    character.build && `Build: ${character.build}`,
    character.clothing && `Clothing: ${character.clothing}`,
    character.expressions && `Expressions: ${character.expressions}`,
    character.signaturePose && `Signature pose: ${character.signaturePose}`,
    character.colorScheme && `Color scheme: ${character.colorScheme}`,
  ].filter(Boolean).join('\n');

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: `请为以下角色生成 DNA 摘要：\n\n${charDesc}` },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const dnaSummary = response.choices[0]?.message?.content?.trim() || '';

  // 更新数据库
  await prisma.character.update({
    where: { id: characterId },
    data: { dnaSummary, dnaLocked: !!character.referenceImg },
  });

  return {
    success: true,
    characterId,
    characterName: character.name,
    dnaSummary,
    hasReference: !!character.referenceImg,
    dnaLocked: !!character.referenceImg,
  };
}

// GET: 获取角色的 DNA 档案
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const characterId = searchParams.get('characterId');
  const projectId = searchParams.get('projectId');

  if (characterId) {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { assets: true },
    });
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        dnaSummary: character.dnaSummary,
        dnaLocked: character.dnaLocked,
        referenceImg: character.referenceImg,
        colorScheme: character.colorScheme,
        signaturePose: character.signaturePose,
      },
      assets: character.assets.map(a => ({
        id: a.id,
        type: a.type,
        url: a.url,
        label: a.label,
        isPrimary: a.isPrimary,
      })),
    });
  }

  if (projectId) {
    const characters = await prisma.character.findMany({
      where: { projectId },
      include: { assets: true },
    });
    return NextResponse.json({
      success: true,
      characters: characters.map(c => ({
        id: c.id,
        name: c.name,
        dnaSummary: c.dnaSummary,
        dnaLocked: c.dnaLocked,
        referenceImg: c.referenceImg,
        assets: c.assets.map(a => ({
          id: a.id, type: a.type, url: a.url, label: a.label, isPrimary: a.isPrimary,
        })),
      })),
    });
  }

  return NextResponse.json({ error: 'characterId 或 projectId 必填' }, { status: 400 });
}
