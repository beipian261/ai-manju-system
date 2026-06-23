/**
 * 剧本质量精炼器（Multi-Agent Script Refiner）
 *
 * 核心创新：生成 → 批评 → 改写 的多轮质量闭环
 *
 * 1. Critic Agent：用专业编剧标准分析剧本问题
 * 2. Refiner Agent：根据批评意见改写优化
 * 3. 可配置轮数（默认 1 轮）
 *
 * 批评维度：
 *   - 三幕结构完整性
 *   - 角色弧光（成长曲线）
 *   - 冲突质量（是否机械降神）
 *   - 对白质量
 *   - 视觉描述丰富度
 *   - 节奏与场次分配
 */

import { chatCompletion } from './agnes-client';
import { getSetting } from './settings';

export interface ScriptCritique {
  overall_score: number;        // 0-100
  structure_score: number;      // 结构完整性
  character_score: number;      // 角色弧光
  conflict_score: number;       // 冲突质量
  dialogue_score: number;       // 对白质量
  visual_score: number;         // 视觉描述
  pacing_score: number;         // 节奏
  issues: ScriptIssue[];        // 具体问题列表
  strengths: string[];          // 优点
  suggestions: string;          // 综合改进建议（给 Refiner 用）
}

export interface ScriptIssue {
  severity: 'critical' | 'major' | 'minor';
  category: string;             // 问题分类
  scene?: number;               // 关联场景编号
  description: string;          // 问题描述
  suggestion: string;           // 如何修复
}

const CRITIC_SYSTEM_PROMPT = `你是一位资深剧本审稿人（Script Doctor），专门分析漫剧/动画剧本的质量。

## 分析维度

### 1. 三幕结构（权重 20%）
- Act 1: 铺垫是否充分？世界观和角色是否清晰引入？
- Act 2: 冲突是否升级？是否有"至暗时刻"的失败场景？
- Act 3: 高潮是否有力？结局是否合理？

### 2. 角色弧光（权重 20%）
- 主角是否有明显的成长/变化？
- 角色行为是否前后一致？
- 配角是否有独立动机，还是工具人？

### 3. 冲突质量（权重 20%）
- 反派是否主动制造障碍？
- 转机是否有伏笔（非机械降神）？
- 失败是否是主角自身原因造成的？

### 4. 对白质量（权重 15%）
- 对白是否符合角色性格？
- 是否简洁有力？
- 是否存在过多解释性对白？

### 5. 视觉描述（权重 15%）
- 场景描写是否足够丰富？
- 是否有具体的视觉元素（光线、天气、色彩）？
- 是否给图像生成提供了足够的信息？

### 6. 节奏（权重 10%）
- 场次数量是否合适（8-16场）？
- 场景长度是否均衡？
- 情绪节奏是否有起伏？

## 评分标准
- 90-100: 专业水准，无需修改
- 75-89: 少量问题，微调即可
- 60-74: 有明显问题，需要修改
- <60: 存在严重问题，需要大幅修改

## 输出格式
必须是纯 JSON 对象（不含任何说明文字）：
{
  "overall_score": 数值,
  "structure_score": 数值,
  "character_score": 数值,
  "conflict_score": 数值,
  "dialogue_score": 数值,
  "visual_score": 数值,
  "pacing_score": 数值,
  "issues": [
    {
      "severity": "critical|major|minor",
      "category": "结构|角色|冲突|对白|视觉|节奏",
      "scene": 场景编号或null,
      "description": "问题描述",
      "suggestion": "修复建议"
    }
  ],
  "strengths": ["优点1", "优点2"],
  "suggestions": "综合改进建议（供改写阶段使用，用中文，200字以内）"
}`;

const REFINER_SYSTEM_PROMPT = `你是一位专业剧本改写专家（Script Re writer）。你的任务是根据审稿意见修改剧本，保留原有优秀内容的同时修复所有问题。

## 改写原则
1. 保持原剧本的整体框架和风格
2. 严格按照批评意见逐一修复
3. 不引入新的问题
4. 保持 JSON 结构完全不变
5. 不要画蛇添足（只修改需要改的地方）

## 输出格式
输出与输入完全相同的 JSON 结构（三幕 + 场景），只修改内容不修改结构。`;

/**
 * 对生成的剧本进行批评分析
 */
export async function critiqueScript(
  scriptJson: string
): Promise<ScriptCritique | null> {
  try {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: CRITIC_SYSTEM_PROMPT },
        { role: 'user', content: `请分析以下剧本的质量：\n\n${scriptJson}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content || '';
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const critique = JSON.parse(jsonMatch[0]) as ScriptCritique;
    return critique;
  } catch (e) {
    console.warn('[script-refiner] Critique failed:', e);
    return null;
  }
}

/**
 * 根据批评意见改写剧本
 */
export async function refineScript(
  originalJson: string,
  critique: ScriptCritique
): Promise<string | null> {
  try {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: REFINER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `## 原剧本\n${originalJson}\n\n## 审稿意见\n总体评分：${critique.overall_score}/100\n\n### 需要修复的问题\n${critique.issues.map(i => `[${i.severity.toUpperCase()}] ${i.category}：${i.description}\n建议：${i.suggestion}`).join('\n\n')}\n\n### 综合改进建议\n${critique.suggestions}\n\n请输出修改后的完整剧本 JSON。`,
        },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    });

    const content = response.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    // 验证 JSON 合法性
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.acts || !Array.isArray(parsed.acts)) return null;

    return jsonMatch[0];
  } catch (e) {
    console.warn('[script-refiner] Refine failed:', e);
    return null;
  }
}

/**
 * 完整的剧本质量增强流程
 * 生成 → 批评 → 改写（单轮）
 * 如果评分已达标（>=75），跳过改写
 */
export async function enhanceScriptQuality(scriptJson: string): Promise<{
  finalScript: string;
  critique: ScriptCritique | null;
  refined: boolean;
}> {
  // 1. 批评
  const critique = await critiqueScript(scriptJson);

  if (!critique) {
    // 批评失败，返回原文（不阻断流程）
    return { finalScript: scriptJson, critique: null, refined: false };
  }

  // 2. 如果评分达标，直接返回
  if (critique.overall_score >= 75) {
    return { finalScript: scriptJson, critique, refined: false };
  }

  // 3. 改写
  const refined = await refineScript(scriptJson, critique);

  if (!refined) {
    return { finalScript: scriptJson, critique, refined: false };
  }

  return { finalScript: refined, critique, refined: true };
}
