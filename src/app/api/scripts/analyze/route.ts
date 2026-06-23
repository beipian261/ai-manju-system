import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import prisma from '@/lib/prisma-client';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';

// ============================================================
// POST /api/scripts/analyze
// 分析剧本质量和角色需求
//
// Body: {
//   scriptId: string    (必填)
// }
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const scriptId = typeof body.scriptId === 'string' ? body.scriptId.trim() : '';

  if (!scriptId) {
    return NextResponse.json({ error: 'scriptId 必填' }, { status: 400 });
  }

  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { project: true },
  });

  if (!script) {
    return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
  
  // 调用 AI 分析剧本
  const analysis = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { 
        role: 'system', 
        content: `你是一位专业的剧本分析师和角色设计师。请分析以下剧本内容，输出一个 JSON 对象，包含：
        
1. quality_score: 0-100 的质量分数
2. quality_comment: 对剧本质量的评价（优点和改进建议）
3. recommended_characters: 建议的角色数量（整数）
4. suggested_characters: 建议的角色列表（包含名字和简短描述）
5. estimated_scenes: 估计的场景数量
6. story_structure: 故事结构评价（三幕式/英雄之旅等）
7. strengths: 剧本优点列表
8. improvements: 改进建议列表

输出格式：纯 JSON，不要其他文字。`
      },
      { 
        role: 'user', 
        content: `请分析以下剧本：\n\n${script.content}` 
      },
    ],
    temperature: 0.5,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  let result;
  try {
    result = JSON.parse(analysis.choices[0]?.message?.content || '{}');
  } catch {
    result = {
      quality_score: 70,
      quality_comment: '剧本分析失败，使用默认评估',
      recommended_characters: 3,
      suggested_characters: [],
      estimated_scenes: 5,
      story_structure: '未检测到明确结构',
      strengths: ['内容存在'],
      improvements: ['建议添加更多细节'],
    };
  }

  return NextResponse.json({
    ...result,
    scriptId: script.id,
    projectId: script.projectId,
    projectTitle: script.project?.title,
    projectGenre: script.project?.genre,
    projectStyle: script.project?.style,
  }, { status: 200 });
}