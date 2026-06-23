import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { checkApiAuth } from '@/lib/auth';

// AI 导演分析：根据分镜的剧本内容，生成专业级导演建议
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
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';

  if (!storyboardId) {
    return NextResponse.json({ error: 'storyboardId 必填' }, { status: 400 });
  }

  // 加载分镜数据
  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
    include: { script: { include: { project: true } } },
  });

  if (!storyboard) {
    return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
  }

  // 加载项目角色
  const characters = projectId
    ? await prisma.character.findMany({ where: { projectId } })
    : await prisma.character.findMany({
        where: { project: { scripts: { some: { id: storyboard.scriptId } } } },
      });

  // 构建上下文
  const sceneContext = [
    `场景编号: ${storyboard.sceneNum}`,
    `场景标题: ${storyboard.title || '未命名'}`,
    `场景描述: ${storyboard.description}`,
    storyboard.dialogue ? `对话内容: ${storyboard.dialogue}` : '',
    storyboard.location ? `地点: ${storyboard.location}` : '',
    storyboard.timeOfDay ? `时间: ${storyboard.timeOfDay}` : '',
    storyboard.emotion ? `情绪: ${storyboard.emotion}` : '',
    storyboard.cameraAngle ? `当前镜头: ${storyboard.cameraAngle}` : '',
    storyboard.visualKeywords ? `视觉关键词: ${storyboard.visualKeywords}` : '',
  ].filter(Boolean).join('\n');

  const characterContext = characters.length > 0
    ? characters.map(c => `- ${c.name}(${c.gender || '?'}): ${c.personality || '未知性格'}, ${c.appearance || '未知外貌'}`).join('\n')
    : '无角色数据';

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const systemPrompt = `你是一位专业的漫剧导演，精通视觉叙事、镜头语言和情绪节奏。
请分析给定的场景，从以下 5 个维度给出专业建议，每条建议必须包含置信度(high/medium)。

输出 JSON 格式：
{
  "emotionAnalysis": "情绪分析：检测情绪转折点、张力变化、节奏建议",
  "suggestions": [
    { "type": "构图", "title": "构图 (Composition)", "content": "具体建议", "confidence": "high" },
    { "type": "景别", "title": "景别 (Shot Size)", "content": "具体建议", "confidence": "high" },
    { "type": "节奏", "title": "节奏 (Pacing)", "content": "具体建议", "confidence": "medium" },
    { "type": "转场", "title": "转场 (Transition)", "content": "具体建议", "confidence": "high" },
    { "type": "色调", "title": "色调 (Color)", "content": "具体建议", "confidence": "high" }
  ]
}

要求：
- 建议必须具体、可操作，不要泛泛而谈
- 考虑与前后场景的衔接和节奏变化
- 色调建议要考虑情绪和场景氛围的匹配
- 用中文回答`;

  const userPrompt = `请分析以下场景：

【场景信息】
${sceneContext}

【出场角色】
${characterContext}

请给出导演建议。`;

  try {
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content || '';

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // 如果 JSON 解析失败，尝试提取
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({
          emotionAnalysis: '分析结果解析失败，请重试',
          suggestions: [],
          raw: content.slice(0, 500),
        });
      }
    }

    return NextResponse.json({
      storyboardId,
      sceneNum: storyboard.sceneNum,
      title: storyboard.title,
      description: storyboard.description,
      dialogue: storyboard.dialogue,
      emotionAnalysis: result.emotionAnalysis || '',
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'AI 分析失败';
    console.error('[director analyze error]', error);
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
