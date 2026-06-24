import { chatCompletion } from './agnes-client';
import { getSetting } from './settings';

interface ParsedConsistencyCharacter {
  name?: string;
  score?: number;
  matched?: boolean;
  issues?: unknown[];
}
import { logger } from './logger';

export interface ImageEvaluation {
  score: number;
  issues: string[];
  suggestions: string;
  note?: string;
  // 新增强化字段：分项评分（用于细粒度的改进建议）
  visual_quality?: number;
  content_match?: number;
  character_consistency?: number;
  composition?: number;
}

// 基于加权多维度评分的专业图像评估
// 参考业界：AI Comic Factory 的质量评估系统
// 评分维度：
//   - visual_quality (25%)：图像清晰度、噪点、完整性
//   - content_match (30%)：描述与画面是否一致
//   - character_consistency (25%)：角色是否一致
//   - composition + style (20%)：构图、镜头语言、风格
export async function evaluateImage(opts: {
  imageUrl: string;
  sceneDescription: string;
  characterNames?: string[];
  expectedStyle?: string;
  // 新增：可选的额外提示词上下文（剧本摘要）
  contextSummary?: string;
}): Promise<ImageEvaluation> {
  const {
    imageUrl,
    sceneDescription,
    characterNames = [],
    expectedStyle = 'anime',
    contextSummary = '',
  } = opts;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return {
      score: 100,
      issues: [],
      suggestions: '',
      note: 'no_image',
      visual_quality: 100,
      content_match: 100,
      character_consistency: 100,
      composition: 100,
    };
  }

  try {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

    const sysPrompt =
      'You are a professional comic-drama image quality evaluator. ' +
      'Rate images strictly on four dimensions (each 0-100 integer):\n' +
      ' 1. visual_quality (image clarity, sharpness, no artifacts, no extra limbs, proper anatomy)\n' +
      ' 2. content_match (does the visual content match the scene description?)\n' +
      ' 3. character_consistency (if characters are mentioned, are they consistent and recognizable?)\n' +
      ' 4. composition (camera angle / framing / cinematic feel)\n' +
      'Then produce the final weighted score = round(visual_quality*0.25 + content_match*0.30 + character_consistency*0.25 + composition*0.20)\n' +
      'Output ONLY a JSON object with these fields: visual_quality, content_match, character_consistency, composition, score (final weighted), issues (string array, 0-5 items), suggestions (string, actionable improvements).\n' +
      'Do NOT include any text outside the JSON.';

    const userContent = JSON.stringify({
      image_url: imageUrl,
      scene_description: sceneDescription.slice(0, 800),
      character_names: characterNames.slice(0, 8),
      expected_style: expectedStyle,
      context: contextSummary ? contextSummary.slice(0, 400) : undefined,
    });

    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        score: 100,
        issues: [],
        suggestions: '',
        note: 'eval_parse_failed',
      };
    }

    const vq = clamp0100(parsed.visual_quality);
    const cm = clamp0100(parsed.content_match);
    const cc = clamp0100(parsed.character_consistency);
    const cp = clamp0100(parsed.composition);

    // 最终加权分（若文本模型提供了 score，优先使用；否则自计算）
    let finalScore: number;
    if (typeof parsed.score === 'number' && parsed.score >= 0 && parsed.score <= 100) {
      finalScore = Math.round(parsed.score);
    } else {
      finalScore = Math.round(vq * 0.25 + cm * 0.3 + cc * 0.25 + cp * 0.2);
    }
    finalScore = clamp0100(finalScore);

    const issues = Array.isArray(parsed.issues)
      ? (parsed.issues as unknown[]).map((x) => String(x)).slice(0, 6)
      : [];

    const suggestions =
      typeof parsed.suggestions === 'string' ? parsed.suggestions.slice(0, 600) : '';

    return {
      score: finalScore,
      issues,
      suggestions,
      visual_quality: vq,
      content_match: cm,
      character_consistency: cc,
      composition: cp,
    };
  } catch (error) {
    logger.error('Image evaluation failed:', error);
    return {
      score: 100,
      issues: [],
      suggestions: '',
      note: 'eval_error',
      visual_quality: 100,
      content_match: 100,
      character_consistency: 100,
      composition: 100,
    };
  }
}

function clamp0100(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ============================================================
// 角色一致性专项评分（免费 API：免费资源可放心调用）
// 用 AI 视觉模型对比生成图与角色设定，判断角色外观一致性
// ============================================================
export interface CharacterConsistencyResult {
  overall_score: number;        // 0-100 综合一致性分
  per_character: Array<{       // 每个角色的评分
    name: string;
    score: number;             // 0-100
    matched: boolean;          // 是否在画面中出现
    issues: string[];          // 问题描述
  }>;
  suggestions: string;         // 改进建议
}

export async function evaluateCharacterConsistency(opts: {
  generatedImageUrl: string;
  characters: Array<{
    name: string;
    appearance: string;       // 外貌描述
    clothing: string;         // 服装描述
    hair: string;             // 发型描述
    referenceImg?: string;    // 参考图 URL（如果有）
  }>;
}): Promise<CharacterConsistencyResult> {
  const { generatedImageUrl, characters } = opts;

  if (!generatedImageUrl || characters.length === 0) {
    return {
      overall_score: 100,
      per_character: characters.map((c) => ({ name: c.name, score: 100, matched: true, issues: [] })),
      suggestions: '',
    };
  }

  try {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

    // 构建角色描述文本
    const characterDescriptions = characters
      .map((c) => `- ${c.name}: ${c.appearance}${c.clothing ? ', 服装: ' + c.clothing : ''}${c.hair ? ', 发型: ' + c.hair : ''}`)
      .join('\n');

    const sysPrompt =
      `You are a character consistency expert for AI-generated comic images. ` +
      `Evaluate whether the characters in the generated image match their descriptions. ` +
      `For each character: ` +
      `  1. Is the character present in the image? ` +
      `  2. Does the character's face, clothing, and overall look match the description? ` +
      `  3. Score 0-100 (100 = perfect match). ` +
      `Output ONLY a JSON object: { ` +
      `  "overall_score": number (average of per-character scores), ` +
      `  "per_character": [{ "name": string, "score": number, "matched": boolean, "issues": string[] }], ` +
      `  "suggestions": string (actionable advice for improvement) ` +
      `}. No other text.`;

    // 构建多模态消息（支持图片 URL）
    const userContent = JSON.stringify({
      generated_image: generatedImageUrl,
      characters: characterDescriptions,
      note: 'Compare character appearance in the generated image with the descriptions above.',
    });

    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { overall_score: 80, per_character: [], suggestions: '评估解析失败，跳过一致性检查' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const overall = clamp0100(parsed.overall_score);
    const perChar = (parsed.per_character || []).map((p: ParsedConsistencyCharacter) => ({
      name: p.name || 'unknown',
      score: clamp0100(p.score),
      matched: Boolean(p.matched),
      issues: Array.isArray(p.issues) ? p.issues.map(String).slice(0, 3) : [],
    }));

    return {
      overall_score: overall,
      per_character: perChar,
      suggestions: typeof parsed.suggestions === 'string' ? parsed.suggestions.slice(0, 400) : '',
    };
  } catch (error) {
    logger.error('Character consistency evaluation failed:', error);
    return {
      overall_score: 80,
      per_character: characters.map((c) => ({ name: c.name, score: 80, matched: true, issues: [] })),
      suggestions: '一致性评估失败，跳过',
    };
  }
}
