// AI 剧本润色 API
// 对已有剧本进行智能优化：节奏调整、台词优化、情感增强
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';

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
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const optimizeType = typeof body.optimizeType === 'string' ? body.optimizeType : 'full';
  const style = typeof body.style === 'string' ? body.style : 'drama';

  if (!content) {
    return NextResponse.json({ error: 'content 必填' }, { status: 400 });
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  let systemPrompt = '';
  let userPrompt = '';

  switch (optimizeType) {
    case 'dialogue':
      systemPrompt = '你是一位专业的编剧和台词顾问。请优化剧本中的对话，使其更自然、更符合角色性格，同时保持原意不变。';
      userPrompt = `请优化以下剧本对话：\n\n${content}\n\n要求：1) 台词更自然流畅 2) 符合角色身份和性格 3) 保持剧情原意`;
      break;
    case 'emotion':
      systemPrompt = '你是一位情感表达专家。请增强剧本中的情感表达，添加适当的情绪标记和氛围描述。';
      userPrompt = `请增强以下剧本的情感表达：\n\n${content}\n\n要求：1) 添加情绪标记 2) 增强氛围描写 3) 保持剧情结构不变`;
      break;
    case 'rhythm':
      systemPrompt = '你是一位电影节奏专家。请分析并优化剧本的节奏，指出可能存在的节奏问题并给出优化建议。';
      userPrompt = `请分析并优化以下剧本的节奏：\n\n${content}\n\n要求：1) 分析节奏问题 2) 提供优化建议 3) 如果合适，调整场景顺序或添加过渡场景`;
      break;
    case 'character':
      systemPrompt = '你是一位角色塑造专家。请分析剧本中的角色刻画，提供增强角色深度的建议。';
      userPrompt = `请分析以下剧本中的角色：\n\n${content}\n\n要求：1) 分析角色性格和动机 2) 提供增强角色深度的建议 3) 优化角色对话使其更符合性格`;
      break;
    case 'full':
    default:
      systemPrompt = '你是一位资深编剧和剧本顾问。请对剧本进行全面优化，包括台词、情感、节奏和角色刻画。';
      userPrompt = `请全面优化以下剧本：\n\n${content}\n\n风格：${style}\n\n要求：1) 优化对话使其更自然 2) 增强情感表达 3) 调整节奏 4) 深化角色刻画 5) 保持原有剧情和场景结构不变`;
  }

  try {
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const optimizedContent = response.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      originalContent: content,
      optimizedContent,
      optimizeType,
      suggestions: extractSuggestions(optimizedContent),
    });
  } catch (e) {
    console.error('[script-polish] error:', e);
    return NextResponse.json({
      error: '剧本润色失败',
      message: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}

function extractSuggestions(content: string): string[] {
  const suggestions: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('建议') || line.includes('优化') || line.includes('改进')) {
      suggestions.push(line.trim());
    }
  }
  return suggestions.length > 0 ? suggestions : ['优化已完成，剧本更加流畅自然'];
}

// GET: 获取可用的优化类型
export async function GET() {
  return NextResponse.json({
    optimizeTypes: [
      { key: 'full', name: '全面优化', description: '对剧本进行全面优化，包括台词、情感、节奏和角色' },
      { key: 'dialogue', name: '台词优化', description: '优化对话使其更自然、更符合角色性格' },
      { key: 'emotion', name: '情感增强', description: '增强情感表达，添加情绪标记' },
      { key: 'rhythm', name: '节奏调整', description: '分析并优化剧本节奏' },
      { key: 'character', name: '角色深化', description: '分析角色刻画，增强角色深度' },
    ],
  });
}