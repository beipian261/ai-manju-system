/**
 * 智能分镜提示词引擎（Smart Prompt Engine）
 *
 * 核心突破：把"规则拼接式"提示词升级为"AI 驱动的专业级提示词生成"
 * - AI 根据场景上下文，从光影/构图/镜头运动/色板库中选最匹配的方案
 * - 生成专业级场景描述和氛围描述
 * - 上下文感知：避免连续相同景别
 * - 角色一致性注入
 * - 失败自动降级到 enrichImagePrompt（规则模式），保证流程不中断
 */

import prisma from '@/lib/db/prisma';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { buildCharacterSheet, enrichImagePrompt, CharacterSheet } from '@/features/characters/character-prompt';
import { logger } from '@/lib/utils/logger';
import {
  LIGHTING_SCHEMES,
  COMPOSITION_RULES,
  COLOR_PALETTES,
  CAMERA_MOVEMENT,
  CAMERA_ANGLES,
  EMOTION_TONES,
  ART_STYLES,
  QUALITY_TAGS,
  normalizeCameraKey,
  normalizeEmotionKey,
  normalizeStyleKey,
  normalizeLightingKey,
  normalizeCompositionKey,
  normalizeColorPaletteKey,
  normalizeCameraMovementKey,
} from '@/features/generation/prompt-library';

const MAX_FINAL_PROMPT_LENGTH = 3500;

// 智能提示词输出结构
export interface SmartPromptResult {
  sceneDescription: string;    // AI 增强后的场景描述（英文）
  lighting: string;            // 光影方案 key
  composition: string;         // 构图 key
  cameraMovement: string;      // 镜头运动 key
  colorPalette: string;        // 色板 key
  atmosphere: string;          // AI 生成的氛围描述（英文）
  finalPrompt: string;         // 组装后的完整提示词（喂给图像模型）
  usedFallback: boolean;       // 是否降级到规则模式
}

// 输入参数
export interface SmartPromptInput {
  storyboardId?: string;       // 已存在的分镜 ID（优先从 DB 读）
  sceneDescription?: string;   // 场景描述（中文或英文）
  emotion?: string;            // 情绪
  location?: string;           // 地点
  timeOfDay?: string;          // 时间
  cameraAngle?: string;        // 镜头角度
  visualKeywords?: string;     // 视觉关键词
  artStyle?: string;           // 艺术风格
  projectId?: string;          // 项目 ID（用于读角色）
  // 上下文感知
  prevCameraAngle?: string;    // 前一个场景的镜头角度（避免连续重复）
  prevEmotion?: string;        // 前一个场景的情绪
}

// LLM 返回的原始结构
interface LLMPlan {
  sceneDescription?: string;
  lighting?: string;
  composition?: string;
  cameraMovement?: string;
  colorPalette?: string;
  atmosphere?: string;
}

// ============================================================
// 主函数：生成智能分镜提示词
// ============================================================
export async function generateSmartStoryboardPrompt(
  input: SmartPromptInput
): Promise<SmartPromptResult> {
  // 1. 如果有 storyboardId，从 DB 读取完整场景信息
  let sceneDescription = input.sceneDescription || '';
  let emotion = input.emotion || '';
  let location = input.location || '';
  let timeOfDay = input.timeOfDay || '';
  let cameraAngle = input.cameraAngle || '';
  let visualKeywords = input.visualKeywords || '';
  let artStyle = input.artStyle || 'anime';
  let projectId = input.projectId || '';

  if (input.storyboardId) {
    const sb = await prisma.storyboard.findUnique({
      where: { id: input.storyboardId },
      include: { script: { include: { project: true } } },
    });
    if (sb) {
      sceneDescription = sceneDescription || sb.description;
      emotion = emotion || sb.emotion || '';
      location = location || sb.location || '';
      timeOfDay = timeOfDay || sb.timeOfDay || '';
      cameraAngle = cameraAngle || sb.cameraAngle || '';
      visualKeywords = visualKeywords || sb.visualKeywords || '';
      projectId = projectId || sb.script.projectId;
      artStyle = artStyle || sb.script.project?.style || 'anime';
    }
  }

  // 2. 读取项目角色，构建 CharacterSheet
  let characterSheets: CharacterSheet[] = [];
  if (projectId) {
    try {
      const characters = await prisma.character.findMany({ where: { projectId } });
      characterSheets = characters.map((c) =>
        buildCharacterSheet({
          name: c.name, age: c.age, gender: c.gender, personality: c.personality,
          clothing: c.clothing, appearance: c.appearance, hair: c.hair, eyes: c.eyes,
          build: c.build, referenceImg: c.referenceImg,
        })
      );
    } catch {
      // 角色读取失败不阻断
    }
  }

  // 3. 调用 LLM 生成结构化参数
  let plan: LLMPlan | null = null;
  try {
    plan = await callLLMForPlan({
      sceneDescription,
      emotion,
      location,
      timeOfDay,
      cameraAngle,
      visualKeywords,
      artStyle,
      prevCameraAngle: input.prevCameraAngle,
      prevEmotion: input.prevEmotion,
      characterNames: characterSheets.map((c) => c.name),
    });
  } catch (e) {
    logger.warn('[smart-prompt] LLM plan failed, will fallback:', e instanceof Error ? e.message : e);
  }

  // 4. LLM 失败 → 降级到规则模式
  if (!plan) {
    return fallbackToRuleMode({
      sceneDescription, emotion, cameraAngle, visualKeywords, artStyle, characterSheets,
    });
  }

  // 5. 解析 + 验证 LLM 返回的 key
  const lightingKey = normalizeLightingKey(plan.lighting);
  const compositionKey = normalizeCompositionKey(plan.composition);
  const cameraMovementKey = normalizeCameraMovementKey(plan.cameraMovement);
  const colorPaletteKey = normalizeColorPaletteKey(plan.colorPalette);
  const enhancedSceneDesc = (plan.sceneDescription || sceneDescription).slice(0, 800);
  const atmosphere = (plan.atmosphere || '').slice(0, 400);

  // 6. 组装专业级 finalPrompt
  const finalPrompt = assembleFinalPrompt({
    sceneDescription: enhancedSceneDesc,
    lightingKey,
    compositionKey,
    cameraMovementKey,
    colorPaletteKey,
    atmosphere,
    cameraAngleKey: normalizeCameraKey(cameraAngle),
    emotionKey: normalizeEmotionKey(emotion),
    styleKey: normalizeStyleKey(artStyle),
    characterSheets,
    visualKeywords,
  });

  return {
    sceneDescription: enhancedSceneDesc,
    lighting: lightingKey,
    composition: compositionKey,
    cameraMovement: cameraMovementKey,
    colorPalette: colorPaletteKey,
    atmosphere,
    finalPrompt,
    usedFallback: false,
  };
}

// ============================================================
// 调用 LLM 生成结构化视觉方案
// ============================================================
async function callLLMForPlan(params: {
  sceneDescription: string;
  emotion: string;
  location: string;
  timeOfDay: string;
  cameraAngle: string;
  visualKeywords: string;
  artStyle: string;
  prevCameraAngle?: string;
  prevEmotion?: string;
  characterNames: string[];
}): Promise<LLMPlan> {
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const systemPrompt = `你是一位专业的电影摄影指导和分镜师。根据场景信息，为这个分镜选择最合适的视觉参数，并生成专业级场景描述。

【可选参数 key（必须从这些 key 中选，不要自创）】
- lighting 光影: golden_hour, blue_hour, backlit, side_lighting, top_light, hard_shadow, soft_box, neon, moonlight, candlelight, rim_light, volumetric, split_lighting, practical_light, high_key, low_key
- composition 构图: rule_of_thirds, golden_ratio, leading_lines, symmetry, framing, diagonal, center, negative_space, foreground_layering, triangle, dutch_tilt, close_up_fill
- cameraMovement 镜头运动: static, slow_pan_left, slow_pan_right, slow_push_in, slow_pull_out, handheld, steady_tracking, crane_up, arc_around, subtle_breathing
- colorPalette 色板: warm_amber, cool_blue, complementary, monochrome, cinematic_teal_orange, pastel, high_contrast_bw, earth_tones, vivid_neon, muted_vintage

【选择原则】
1. lighting: 根据时间(timeOfDay)、情绪(emotion)、地点(location) 选最匹配的光影。如 night+神秘→moonlight；sunset+浪漫→golden_hour；室内+紧张→split_lighting
2. composition: 根据场景类型选。对话→rule_of_thirds 或 symmetry；追逐→diagonal；独白→center 或 negative_space；揭示环境→leading_lines
3. cameraMovement: 根据情绪强度。平静→static 或 subtle_breathing；紧张→handheld；揭示→slow_push_in；史诗→crane_up
4. colorPalette: 根据题材和情绪。电影感→cinematic_teal_orange；恐怖→cool_blue 或 high_contrast_bw；温馨→warm_amber；赛博→vivid_neon

【上下文感知】
${params.prevCameraAngle ? `- 前一场景镜头: ${params.prevCameraAngle}（如果当前场景非特写/强调，尽量避免完全相同的镜头角度，保持节奏变化）` : '- 这是第一个场景，无前序约束'}
${params.prevEmotion ? `- 前一场景情绪: ${params.prevEmotion}（考虑情绪起伏，避免连续相同情绪造成平淡）` : ''}

【输出要求】
只输出一个 JSON 对象，字段：
- sceneDescription: 英文，增强后的专业场景描述（2-3句，包含环境、角色动作、关键视觉元素），基于输入描述扩展
- lighting: 从可选 key 中选一个
- composition: 从可选 key 中选一个
- cameraMovement: 从可选 key 中选一个
- colorPalette: 从可选 key 中选一个
- atmosphere: 英文，2-3句氛围描述（光线质感、空气感、情绪张力）

不要输出任何其他文字、注释或 markdown 代码块。`;

  const userPrompt = `【场景信息】
- 场景描述: ${params.sceneDescription || '(无，请基于其他信息生成)'}
- 情绪: ${params.emotion || 'peaceful'}
- 地点: ${params.location || '未指定'}
- 时间: ${params.timeOfDay || 'day'}
- 镜头角度: ${params.cameraAngle || 'medium_shot'}
- 视觉关键词: ${params.visualKeywords || '(无)'}
- 艺术风格: ${params.artStyle || 'anime'}
- 场景中的角色: ${params.characterNames.length > 0 ? params.characterNames.join(', ') : '(无角色)'}`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseLLMPlan(raw);
}

// ============================================================
// 解析 LLM 返回（容错：JSON → 正则提取）
// ============================================================
function parseLLMPlan(raw: string): LLMPlan {
  // 尝试直接 JSON.parse
  try {
    return JSON.parse(raw);
  } catch {
    // 尝试提取 { ... }
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        // 继续
      }
    }
    // 逐字段正则提取
    const plan: LLMPlan = {};
    const fields: (keyof LLMPlan)[] = ['sceneDescription', 'lighting', 'composition', 'cameraMovement', 'colorPalette', 'atmosphere'];
    for (const f of fields) {
      const re = new RegExp(`"${f}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
      const mm = raw.match(re);
      if (mm) {
        (plan as Record<string, unknown>)[f] = mm[1].replace(/\\"/g, '"').replace(/\\n/g, ' ');
      }
    }
    if (Object.keys(plan).length === 0) {
      throw new Error('LLM 返回无法解析');
    }
    return plan;
  }
}

// ============================================================
// 组装专业级 finalPrompt
// 把光影/构图/镜头运动/色板/氛围/角色/场景/风格/质量 全部拼成英文提示词
// ============================================================
function assembleFinalPrompt(params: {
  sceneDescription: string;
  lightingKey: keyof typeof LIGHTING_SCHEMES;
  compositionKey: keyof typeof COMPOSITION_RULES;
  cameraMovementKey: keyof typeof CAMERA_MOVEMENT;
  colorPaletteKey: keyof typeof COLOR_PALETTES;
  atmosphere: string;
  cameraAngleKey: keyof typeof CAMERA_ANGLES;
  emotionKey: keyof typeof EMOTION_TONES;
  styleKey: keyof typeof ART_STYLES;
  characterSheets: CharacterSheet[];
  visualKeywords?: string;
}): string {
  const parts: string[] = [];

  // 1. 镜头角度（景别）
  parts.push(CAMERA_ANGLES[params.cameraAngleKey]);

  // 2. 构图
  parts.push(COMPOSITION_RULES[params.compositionKey]);

  // 3. AI 增强后的场景描述
  if (params.sceneDescription) {
    parts.push(params.sceneDescription.slice(0, 600));
  }

  // 4. 视觉关键词
  if (params.visualKeywords) {
    parts.push(params.visualKeywords.slice(0, 300));
  }

  // 5. 光影方案
  parts.push(LIGHTING_SCHEMES[params.lightingKey]);

  // 6. 色板
  parts.push(COLOR_PALETTES[params.colorPaletteKey]);

  // 7. 氛围描述
  if (params.atmosphere) {
    parts.push(params.atmosphere);
  }

  // 8. 情绪氛围
  parts.push(EMOTION_TONES[params.emotionKey]);

  // 9. 角色一致性（最重要）
  if (params.characterSheets.length > 0) {
    params.characterSheets.forEach((sheet, i) => {
      parts.push(`[CHARACTER ${i + 1} MUST APPEAR: ${sheet.englishDescription}]`);
    });
  }

  // 10. 镜头运动（视频生成时用，图片生成时作为静态构图参考）
  parts.push(`camera movement: ${CAMERA_MOVEMENT[params.cameraMovementKey]}`);

  // 11. 艺术风格
  parts.push(`art style: ${ART_STYLES[params.styleKey]}`);

  // 12. 质量技术词
  parts.push(QUALITY_TAGS.base);
  parts.push(QUALITY_TAGS.face);
  parts.push(QUALITY_TAGS.composition);
  parts.push(QUALITY_TAGS.lighting);
  parts.push(QUALITY_TAGS.color);
  parts.push(QUALITY_TAGS.depth);

  let result = parts.join('. ');
  if (result.length > MAX_FINAL_PROMPT_LENGTH) {
    result = result.slice(0, MAX_FINAL_PROMPT_LENGTH);
  }
  return result;
}

// ============================================================
// 降级到规则模式（LLM 失败时）
// 复用现有 enrichImagePrompt，保证流程不中断
// ============================================================
function fallbackToRuleMode(params: {
  sceneDescription: string;
  emotion: string;
  cameraAngle: string;
  visualKeywords: string;
  artStyle: string;
  characterSheets: CharacterSheet[];
}): SmartPromptResult {
  const styleKey = normalizeStyleKey(params.artStyle);
  const finalPrompt = enrichImagePrompt({
    sceneDescription: params.sceneDescription,
    characterSheets: params.characterSheets,
    styleKey: styleKey as keyof typeof ART_STYLES,
    cameraAngleHint: params.cameraAngle,
    emotionHint: params.emotion,
    visualKeywords: params.visualKeywords,
  });

  // 规则模式不涉及光影/构图/镜头运动/色板的智能选择，留空
  return {
    sceneDescription: params.sceneDescription,
    lighting: '',
    composition: '',
    cameraMovement: '',
    colorPalette: '',
    atmosphere: '',
    finalPrompt,
    usedFallback: true,
  };
}

// ============================================================
// 批量生成智能提示词（用于一键优化整个剧本的所有分镜）
// 支持上下文感知：按场景顺序处理，每个场景知道前一个场景的镜头/情绪
// ============================================================
export async function generateSmartPromptsBatch(
  storyboardIds: string[]
): Promise<{ results: Array<{ storyboardId: string; result: SmartPromptResult | null; error?: string }>; succeeded: number; fallbacked: number; failed: number }> {
  const results: Array<{ storyboardId: string; result: SmartPromptResult | null; error?: string }> = [];
  let succeeded = 0;
  let fallbacked = 0;
  let failed = 0;

  // 按 sceneNum 排序，保证上下文感知的顺序正确
  const storyboards = await prisma.storyboard.findMany({
    where: { id: { in: storyboardIds } },
    orderBy: { sceneNum: 'asc' },
  });

  let prevCameraAngle: string | undefined;
  let prevEmotion: string | undefined;

  for (const sb of storyboards) {
    try {
      const result = await generateSmartStoryboardPrompt({
        storyboardId: sb.id,
        prevCameraAngle,
        prevEmotion,
      });

      // 写回数据库
      await prisma.storyboard.update({
        where: { id: sb.id },
        data: {
          imagePrompt: result.finalPrompt,
          promptMode: 'smart',
          lighting: result.lighting || null,
          composition: result.composition || null,
          cameraMovement: result.cameraMovement || null,
          colorPalette: result.colorPalette || null,
          atmosphere: result.atmosphere || null,
        },
      });

      results.push({ storyboardId: sb.id, result });
      if (result.usedFallback) {
        fallbacked++;
      } else {
        succeeded++;
      }
      prevCameraAngle = sb.cameraAngle || undefined;
      prevEmotion = sb.emotion || undefined;
    } catch (e) {
      failed++;
      results.push({
        storyboardId: sb.id,
        result: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { results, succeeded, fallbacked, failed };
}
