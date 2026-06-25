// ============================================================
// Job handler：生成剧本
// 从 src/app/api/scripts/route.ts 的 generateScriptMultiPass 抽出，
// 改为 job handler 形式（由 worker 调度，不再 fire-and-forget）
// ============================================================

import prisma from '@/lib/db/prisma';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { updateProjectStatus } from '@/lib/utils/project-status';
import { emitProgress } from '@/lib/bus/progress-bus';
import { buildCharacterConsistencyInstructions, buildCharacterSheet } from '@/features/characters/character-prompt';
import { SCRIPT_PROMPTS } from '@/features/generation/prompt-library';
import { registerJobHandler } from '@/lib/queue/job-queue';
import { logger } from '@/lib/utils/logger';

// AI JSON 解析：剧本验证用到的中间结构
interface ParsedAct {
  act_num?: number;
  name?: string;
  scenes?: ParsedScene[];
  [key: string]: unknown;
}
interface ParsedScene {
  scene_number?: number;
  emotion?: string;
  dialogue?: string;
  description?: string;
  [key: string]: unknown;
}

// 注册 handler（模块加载即生效）
registerJobHandler('script', async (job) => {
  const scriptId = job.payload.scriptId as string;
  const projectId = job.payload.projectId as string;
  const outline = job.payload.outline as string;
  const style = (job.payload.style as string) || 'anime';

  if (!scriptId || !projectId || !outline) {
    throw new Error('script job 缺少必要参数 scriptId/projectId/outline');
  }

  await generateScriptMultiPass(scriptId, projectId, outline, style, job.setProgress, job.projectId);
  return { scriptId, projectId };
});

// ============================================================
// 多轮剧本生成（逻辑与原 generateScriptMultiPass 一致，仅改为接收 setProgress）
// ============================================================
async function generateScriptMultiPass(
  scriptId: string,
  projectId: string,
  outline: string,
  style: string,
  setProgress: (pct: number, message?: string) => Promise<void>,
  progressProjectId: string | null
) {
  try {
    emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 5, message: '加载角色与世界观', projectId: progressProjectId || undefined });
    await setProgress(5, '加载角色与世界观');

    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
    const characters = await prisma.character.findMany({ where: { projectId } });

    const characterSheets = characters.map((c) =>
      buildCharacterSheet({
        name: c.name, age: c.age, gender: c.gender, personality: c.personality,
        clothing: c.clothing, appearance: c.appearance, hair: c.hair, eyes: c.eyes,
        build: c.build, referenceImg: c.referenceImg, dnaSummary: c.dnaSummary,
      })
    );

    const characterInstructions = buildCharacterConsistencyInstructions(characters);

    emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 15, message: 'AI 创作剧本大纲', projectId: progressProjectId || undefined });
    await setProgress(15, 'AI 创作剧本大纲');

    const systemPrompt = SCRIPT_PROMPTS.outline_to_full;

    let userPrompt = `【故事大纲】\n${outline}\n\n【整体画风】${style}\n\n`;
    if (characterSheets.length > 0) {
      userPrompt += `【登场角色】（共 ${characterSheets.length} 位）\n`;
      characterSheets.forEach((cs) => {
        const apprDesc = cs.face || cs.signature_look || '标准外貌';
        userPrompt += `- ${cs.name}：${apprDesc}；穿着 ${cs.outfit_main || '日常服饰'}；性格 ${cs.personality || '开朗'}\n`;
      });
    }
    if (characterInstructions) userPrompt += `\n${characterInstructions}\n\n`;
    userPrompt += '\n请输出一个高质量、结构完整的漫剧剧本（严格的 JSON 格式，无任何说明文本）。';

    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 6000,
    });

    emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 65, message: '整理与验证剧本结构', projectId: progressProjectId || undefined });
    await setProgress(65, '整理与验证剧本结构');

    let scriptContent = response.choices[0]?.message?.content || '';

    // Pass 2：JSON 解析失败时重试
    try {
      const parsed = JSON.parse(scriptContent);
      if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
        if (!(parsed.acts && Array.isArray(parsed.acts) && parsed.acts.length > 0)) {
          throw new Error('Empty scenes');
        }
      }
    } catch {
      emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 75, message: '修复 JSON 格式（第二次重试）', projectId: progressProjectId || undefined });
      await setProgress(75, '修复 JSON 格式');

      const retryResponse = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一位严谨的 JSON 输出助手。仅输出合法 JSON 对象，不要任何解释、代码块标记或额外文字。',
          },
          {
            role: 'user',
            content:
              '请将以下剧本内容重写为合法 JSON（保留原始内容和结构）。JSON 格式要求：\n' +
              '{"title":"","logline":"","genre":"","acts":[{"act_num":1,"name":"铺垫","scenes":[{"scene_number":1,"title":"","location":"","time_of_day":"morning","weather":"","description":"详细视觉描述","camera_angle":"medium_shot","emotion":"dramatic","dialogue":"","visual_keywords":"","characters_in_scene":[]}]}]}\n\n原始内容：\n' +
              scriptContent.slice(0, 4500),
          },
        ],
        temperature: 0.3,
        max_tokens: 5000,
      });

      const retryContent = retryResponse.choices[0]?.message?.content || '';
      const jsonMatch = retryContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) scriptContent = jsonMatch[0];
      else scriptContent = retryContent;
    }

    // 最终二次解析
    let finalContent = scriptContent;
    try {
      JSON.parse(finalContent);
    } catch {
      const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) finalContent = jsonMatch[0];
    }

    // Pass 3：质量校验
    emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 80, message: '质量校验（Pass 3）', projectId: progressProjectId || undefined });
    await setProgress(80, '质量校验');

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(finalContent);
    } catch {
      // 跳过
    }

    const validationResult = await validateScriptStructure(parsed, outline, TEXT_MODEL);
    if (validationResult.needsRewrite) {
      logger.info(`[script:${scriptId}] Pass 3 校验未通过，重写... 原因：${validationResult.reasons.join(', ')}`);
      emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 82, message: '质量校验未通过，自动修复中...', projectId: progressProjectId || undefined });
      await setProgress(82, '自动修复中');

      const rewriteResponse = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一位专业的漫剧编剧。请根据以下剧本内容，修复其质量问题后输出修复版剧本。

【质量规则】
1. 必须有真正的失败/危机场景（情绪标签：tense/melancholy/dramatic，不能是 comedic/cheerful）
2. 反派必须主动采取行动（造谣/破坏/威胁/设局），不能只是旁观
3. 转机/救星出场前必须有伏笔（至少一场暗示其存在的戏）
4. 主角开头和结尾必须有明显变化/成长
5. 总场次 8-16 场
6. Act 2（冲突）至少 3 场，最后一场必须是危机/失败
7. Act 3（高潮）至少 2 场

【当前剧本问题】
${validationResult.reasons.map(r => `- ${r}`).join('\n')}

【输出要求】
输出严格 JSON（与原格式一致），仅输出 JSON，不要任何其他文字。`,
          },
          { role: 'user', content: finalContent.slice(0, 8000) },
        ],
        temperature: 0.6,
        max_tokens: 6000,
      });

      const rewriteContent = rewriteResponse.choices[0]?.message?.content || '';
      const jsonMatch = rewriteContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) finalContent = jsonMatch[0];
    }

    emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 90, message: '保存剧本', projectId: progressProjectId || undefined });
    await setProgress(90, '保存剧本');

    await prisma.script.update({
      where: { id: scriptId },
      data: { content: finalContent, status: 'completed' },
    });

    await updateProjectStatus(projectId, 'storyboarding');
    emitProgress({ type: 'script', id: scriptId, status: 'completed', progress: 100, message: '剧本生成完成', projectId: progressProjectId || undefined });
    await setProgress(100, '剧本生成完成');
  } catch (error) {
    logger.error('Script generation failed:', error);
    const errMsg = error instanceof Error ? error.message : '未知错误';
    const friendlyMsg = (() => {
      const p = [/cannot provide/i, /violen/i, /illegal/i, /safety|harmful|inappropriate/i, /content.*policy/i];
      if (p.some(r => r.test(errMsg))) return '内容安全策略拦截，请将大纲中的敏感词替换后重试';
      if (errMsg.includes('timeout') || errMsg.includes('超时')) return '生成超时，请简化大纲';
      return errMsg.slice(0, 100);
    })();
    await prisma.script
      .update({ where: { id: scriptId }, data: { status: 'failed' } })
      .catch(() => null);
    emitProgress({ type: 'script', id: scriptId, status: 'failed', message: '生成失败: ' + friendlyMsg, projectId: progressProjectId || undefined });
    throw error; // 让 worker 标记 Job 为 failed
  }
}

// ============================================================
// 剧本结构质量校验（从 scripts/route.ts 移植，逻辑不变）
// ============================================================
interface ValidationResult {
  needsRewrite: boolean;
  reasons: string[];
}

const FAILURE_EMOTIONS = new Set(['tense', 'melancholy', 'dramatic', 'action', 'mysterious', 'horror', 'cold']);
const LIGHT_EMOTIONS = new Set(['comedic', 'cheerful', 'peaceful', 'romantic', 'festive']);

async function validateScriptStructure(
  parsed: Record<string, unknown>,
  outline: string,
  model: string
): Promise<ValidationResult> {
  const reasons: string[] = [];

  let allScenes: ParsedScene[] = [];
  if (Array.isArray(parsed.acts) && parsed.acts.length > 0) {
    for (const act of parsed.acts as ParsedAct[]) {
      if (Array.isArray(act.scenes)) allScenes.push(...act.scenes);
    }
  } else if (Array.isArray(parsed.scenes)) {
    allScenes = parsed.scenes;
  }

  if (allScenes.length === 0) {
    reasons.push('剧本中没有场景');
    return { needsRewrite: reasons.length > 0, reasons };
  }

  if (allScenes.length < 8) reasons.push(`总场次 ${allScenes.length} 太少（至少需要 8 场）`);
  else if (allScenes.length > 16) reasons.push(`总场次 ${allScenes.length} 太多（最多 16 场）`);

  if (Array.isArray(parsed.acts) && parsed.acts.length >= 2) {
    const act2 = (parsed.acts as ParsedAct[]).find((a) => a.act_num === 2 || a.name?.includes('冲突'));
    if (act2 && Array.isArray(act2.scenes)) {
      const act2Scenes = act2.scenes;
      if (act2Scenes.length < 3) reasons.push(`Act 2（冲突）只有 ${act2Scenes.length} 场，需要至少 3 场`);
      const failureScenes = act2Scenes.filter((s: ParsedScene) => FAILURE_EMOTIONS.has((s.emotion || '').toLowerCase()));
      if (failureScenes.length === 0) reasons.push('Act 2 缺少失败/危机场景（需要 tense/melancholy/dramatic 情绪）');
    }
  }

  const allEmotions = allScenes.map((s: ParsedScene) => s.emotion?.toLowerCase()).filter((e): e is string => Boolean(e));
  const lightOnly = allEmotions.length > 0 && allEmotions.every((e) => LIGHT_EMOTIONS.has(e));
  if (lightOnly && allScenes.length > 6) reasons.push('剧本全程情绪过于轻松，缺少紧张/危机/戏剧性冲突');

  const scenesWithDialogue = allScenes.filter((s: ParsedScene) => s.dialogue && s.dialogue.length > 10);
  if (scenesWithDialogue.length < allScenes.length * 0.3 && allScenes.length > 5) {
    reasons.push('大部分场景缺少对白，可能导致角色形象单薄');
  }

  const scenesWithDetail = allScenes.filter((s: ParsedScene) => s.description && s.description.length > 30);
  if (scenesWithDetail.length < allScenes.length * 0.5) reasons.push('部分场景视觉描述过于简短（需要至少 30 字）');

  // outline 参数保留兼容签名，本地规则已足够时不再强依赖
  void outline;

  if (reasons.length > 0 && reasons.length <= 3) {
    try {
      const aiCheck = await chatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: `你是一位剧本质量审核员。判断以下剧本是否存在严重叙事问题。

严重问题包括：
- 主角一路顺风，没有真正的失败或挫折
- 反派只是旁观或说一句风凉话，没有主动制造障碍
- 结局来得太突然，缺乏铺垫（机械降神）
- 主角性格从头到尾完全一样，没有成长
- 商业/创业题材但缺乏商业逻辑

输出 JSON：{ "has_issues": true/false, "specific_issues": ["具体问题1", "..."] }
输出 ONLY JSON，不要其他文字。`,
          },
          { role: 'user', content: JSON.stringify(parsed, null, 2).slice(0, 6000) },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      const aiContent = aiCheck.choices[0]?.message?.content || '';
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiResult = JSON.parse(jsonMatch[0]);
        if (aiResult.has_issues && Array.isArray(aiResult.specific_issues)) {
          reasons.push(...aiResult.specific_issues.slice(0, 2));
        } else if (!aiResult.has_issues) {
          reasons.length = 0;
        }
      }
    } catch {
      // AI 检查失败，以本地检查为准
    }
  }

  return { needsRewrite: reasons.length > 0, reasons: [...new Set(reasons)] };
}
