import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { getClientIdentifier, checkRateLimit } from '@/lib/rate-limiter';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';

// ==============================
// POST /api/agnes/analyze-outline
// 大纲质量分析 + 优化建议
// ==============================

const ANALYSIS_PROMPT = `你是一位专业的故事编辑。请分析以下故事大纲，用 JSON 格式返回分析结果。

分析维度（0-100）：
1. characterCompleteness（角色完整度）：主要角色是否有姓名、身份、性格特征
2. conflictIntensity（冲突强度）：是否有明确的反派/阻力、是否有多层冲突
3. pacingBalance（节奏合理性）：三幕结构是否完整、高潮是否存在
4. worldBuilding（世界观清晰度）：时间/地点/规则是否明确
5. creativity（创意指数）：故事概念是否新颖、是否有记忆点

额外输出：
- overallScore（总评分 0-100）
- summary（一句话总结，不超过 40 字）
- suggestions（改进建议列表，每项含 priority: "high" | "medium" | "low" 和具体建议文本）
- strengths（已有亮点列表）

请严格按照 JSON 格式返回，不要包含 markdown 代码块标记。`;

const OPTIMIZE_PROMPT = `你是一位资深编剧。请优化以下故事大纲，使其更加完整和专业。

优化要求：
1. 如果缺少角色姓名/身份/性格，补充 2-3 个关键角色设定
2. 如果缺少冲突或反派，添加明确的对抗力量
3. 如果缺少三幕结构中的高潮，补充高潮情节描述
4. 如果世界观模糊，添加场景/时间/规则描述
5. 保持原有故事核心不变，增强戏剧张力
6. 保持原有格式（使用【】标记分节），不超过 3000 字

请直接输出优化后的大纲，不要添加任何解释或 markdown。`;

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  // Rate limit: 5 req/min
  const id = getClientIdentifier(req);
  const { allowed } = checkRateLimit(id, 'analyze-outline', 5);
  if (!allowed) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const outline = typeof body.outline === 'string' ? body.outline.trim() : '';
  const mode = typeof body.mode === 'string' ? body.mode : 'analyze';

  if (!outline) {
    return NextResponse.json({ error: '大纲内容必填' }, { status: 400 });
  }

  if (outline.length < 20) {
    return NextResponse.json({ error: '大纲太短，至少需要 20 个字符' }, { status: 400 });
  }

  try {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

    if (mode === 'optimize') {
      const response = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: OPTIMIZE_PROMPT },
          { role: 'user', content: outline },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const optimizedText = response.choices?.[0]?.message?.content || '';

      return NextResponse.json({
        optimizedOutline: optimizedText.trim(),
        originalLength: outline.length,
        optimizedLength: optimizedText.length,
      });
    }

    // Analysis mode
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: outline },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const rawText = response.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let analysis: Record<string, unknown> | null = null;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        return NextResponse.json({
          rawAnalysis: rawText,
          parseError: true,
        });
      }
    }

    if (!analysis) {
      return NextResponse.json({ error: 'AI 分析返回格式异常，请重试' }, { status: 500 });
    }

    const clamp = (v: unknown, fallback: number): number => {
      const n = typeof v === 'number' ? Math.round(v) : fallback;
      return Math.max(0, Math.min(100, n));
    };

    return NextResponse.json({
      characterCompleteness: clamp(analysis.characterCompleteness, 50),
      conflictIntensity: clamp(analysis.conflictIntensity, 50),
      pacingBalance: clamp(analysis.pacingBalance, 50),
      worldBuilding: clamp(analysis.worldBuilding, 50),
      creativity: clamp(analysis.creativity, 50),
      overallScore: clamp(analysis.overallScore, 50),
      summary: typeof analysis.summary === 'string' ? analysis.summary.slice(0, 100) : '大纲分析完成',
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions.slice(0, 8) : [],
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths.slice(0, 5) : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '分析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
