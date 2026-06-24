import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { checkApiAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

// POST: 为指定台词生成配音脚本（语音方向指导 + SSML）
export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const storyboardId = typeof body.storyboardId === 'string' ? body.storyboardId.trim() : '';
  const voice = typeof body.voice === 'string' ? body.voice : '';
  const speed = typeof body.speed === 'number' ? body.speed : 1.0;
  const pitch = typeof body.pitch === 'number' ? body.pitch : 0;
  const emotions = Array.isArray(body.emotions) ? body.emotions : [];

  if (!storyboardId) {
    return NextResponse.json({ error: 'storyboardId 必填' }, { status: 400 });
  }

  try {
    const storyboard = await prisma.storyboard.findUnique({
      where: { id: storyboardId },
      select: {
        id: true,
        sceneNum: true,
        title: true,
        dialogue: true,
        emotion: true,
        description: true,
        charactersInScene: true,
      },
    });

    if (!storyboard || !storyboard.dialogue) {
      return NextResponse.json({ error: '分镜不存在或无对话内容' }, { status: 404 });
    }

    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

    // 使用 AI 生成配音脚本
    const systemPrompt = `你是一位专业的配音导演。请为以下台词生成配音指导脚本。

输出 JSON 格式：
{
  "voiceDirection": "配音方向描述（语气、节奏、重点强调）",
  "ssml": "SSML 标记的语音合成脚本",
  "estimatedDuration": "预计时长（秒）",
  "tips": ["配音建议1", "配音建议2"]
}

SSML 使用以下标签：
- <speak> 包裹整体
- <prosody rate="slow|medium|fast" pitch="+0st|-2st"> 调整语速音调
- <emphasis level="strong"> 强调关键词
- <break time="500ms"/> 停顿
- <say-as interpret-as="interjection"> 语气词处理`;

    const userPrompt = `请为以下台词生成配音脚本：

台词：${storyboard.dialogue}
场景：${storyboard.title || `第${storyboard.sceneNum}场`}
场景描述：${storyboard.description}
情绪：${storyboard.emotion || '未指定'}
角色声线选择：${voice}
语速设置：${speed}x
音调调整：${pitch > 0 ? '+' : ''}${pitch}
情绪标记：${emotions.join('、') || '未指定'}`;

    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content || '';

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          voiceDirection: '生成失败，请重试',
          ssml: `<speak>${storyboard.dialogue}</speak>`,
          estimatedDuration: '3',
          tips: [],
        };
      }
    }

    return NextResponse.json({
      storyboardId,
      sceneNum: storyboard.sceneNum,
      dialogue: storyboard.dialogue,
      voiceDirection: result.voiceDirection || '',
      ssml: result.ssml || `<speak>${storyboard.dialogue}</speak>`,
      estimatedDuration: result.estimatedDuration || '3',
      tips: Array.isArray(result.tips) ? result.tips : [],
      voice,
      speed,
      pitch,
      emotions,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '配音脚本生成失败';
    logger.error('[voice generate error]', error);
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
