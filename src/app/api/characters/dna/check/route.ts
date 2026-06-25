// POST /api/characters/dna/check
// 检查已生成图片与角色 DNA 的一致性

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: { projectId?: string; characterId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const projectId = body.projectId;
  const characterId = body.characterId;

  if (!projectId && !characterId) {
    return NextResponse.json({ error: 'projectId 或 characterId 必填' }, { status: 400 });
  }

  const where = characterId ? { id: characterId } : { projectId };
  const characters = await prisma.character.findMany({
    where,
    include: { assets: true },
  });

  if (characters.length === 0) {
    return NextResponse.json({ error: '未找到角色' }, { status: 404 });
  }

  const results = [];
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  for (const character of characters) {
    // 只有有 DNA 摘要和参考图的才检查
    if (!character.dnaSummary && !character.referenceImg) {
      results.push({
        name: character.name,
        id: character.id,
        status: 'skipped',
        reason: '缺少 DNA 摘要和参考图',
        score: null,
      });
      continue;
    }

    // 检查项目中是否有这个角色的分镜图片
    const storyboards = await prisma.storyboard.findMany({
      where: {
        script: { projectId: character.projectId },
        imageUrls: { not: null },
        charactersInScene: { contains: character.name },
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    if (storyboards.length === 0) {
      results.push({
        name: character.name,
        id: character.id,
        status: 'no_images',
        reason: '没有已生成的分镜图片可以检查',
        score: null,
      });
      continue;
    }

    // 用 AI 检查 DNA 一致性
    const imagePrompt = `角色: ${character.name}`;
    const dnaInfo = character.dnaSummary || '无 DNA 摘要';
    const refImg = character.referenceImg || '无参考图';

    const sysPrompt = `你是一位角色一致性审核专家。判断以下角色的 DNA 描述与实际生成效果是否一致。

角色 DNA: ${dnaInfo}
参考图: ${refImg}

对于每张图片，评分 0-100（100 = 完全符合 DNA，0 = 完全不符）：
- >=80: 一致性好，角色特征清晰可辨认
- 60-79: 基本一致，有轻微偏差
- 40-59: 有明显不一致
- <40: 完全不像

输出 JSON 格式：
{
  "overall_score": 平均分,
  "per_image": [
    { "score": 数值, "issues": ["问题描述"] }
  ],
  "suggestion": "改进建议"
}`;

    try {
      const response = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: imagePrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      results.push({
        name: character.name,
        id: character.id,
        status: 'checked',
        score: parsed.overall_score || null,
        perImage: parsed.per_image || [],
        suggestion: parsed.suggestion || '',
        imageCount: storyboards.length,
        dnaSummary: character.dnaSummary?.slice(0, 100),
        hasReference: !!character.referenceImg,
        dnaLocked: character.dnaLocked,
      });
    } catch (e) {
      results.push({
        name: character.name,
        id: character.id,
        status: 'error',
        reason: 'AI 检查失败',
        score: null,
      });
    }
  }

  const scores = results.filter(r => r.score !== null).map(r => r.score);
  const overallAvg = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return NextResponse.json({
    success: true,
    overallAverage: overallAvg,
    totalCharacters: characters.length,
    checkedCount: results.filter(r => r.status === 'checked').length,
    results,
    needsDNALock: results.some(r => r.status === 'checked' && r.dnaLocked === false),
  });
}
