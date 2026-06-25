/**
 * 智能助手（Smart Assistant）
 *
 * 统一的智能对话接口，负责：
 * 1. 意图识别 — 判断用户想要做什么（生成剧本/设计角色/规划场景/优化提示词/提问）
 * 2. 上下文感知 — 从 DB 读取项目状态，给出有上下文的建议
 * 3. 动作推荐 — 根据意图返回下一步可执行的 API 动作（前端可直接调用）
 * 4. 创作建议 — 给出专业的漫画创作建议（对话式）
 *
 * 设计原则：
 * - 轻量：只做意图识别 + 建议，不直接执行耗时任务（那些交给专门的 API）
 * - 上下文感知：知道项目进展到哪一步
 * - 可追踪：每次对话记录意图和建议
 */

import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';

// ============================================================
// 数据类型
// ============================================================

export type AssistantIntent =
  | 'generate_script'       // 用户想生成/修改剧本
  | 'design_character'      // 用户想设计角色
  | 'plan_scene'            // 用户想规划场景/分镜
  | 'optimize_prompt'       // 用户想优化图像提示词
  | 'get_advice'            // 用户想要创作建议
  | 'explain'               // 用户想了解某个概念
  | 'fix_problem'           // 用户在解决问题
  | 'general';              // 一般对话

export interface SuggestedAction {
  label: string;            // 按钮文字（中文，10字以内）
  description: string;      // 操作说明（中文，一句话）
  apiEndpoint: string;      // 可调用的 API 路径
  method: 'GET' | 'POST' | 'PATCH';
  bodyTemplate?: Record<string, unknown>;  // 请求体模板
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantContext {
  projectId?: string;
  projectTitle?: string;
  genre?: string;
  currentStep?: string;      // 'script' | 'characters' | 'storyboards' | 'images' | 'video'
  characterCount?: number;
  storyboardCount?: number;
  hasScript?: boolean;
}

export interface AssistantResponse {
  intent: AssistantIntent;
  reply: string;             // 助手的回复（中文，markdown 格式）
  suggestedActions: SuggestedAction[];
  followUpQuestions: string[];  // 追问建议（前端可展示为快捷按钮）
  confidence: number;           // 意图识别置信度（0-1）
}

// ============================================================
// 意图识别系统提示
// ============================================================

const INTENT_RECOGNITION_PROMPT = `你是一位资深漫画创作助手，擅长帮助创作者从想法到完成漫剧的全流程。

你的工作是：
1. 识别用户的意图
2. 给出专业、具体、可执行的建议
3. 推荐下一步行动

【系统能力说明】
本系统可以：
- 生成漫剧剧本（自动分幕分场景）
- 智能角色设计（外观/性格/表情/标志动作）
- 一键生成角色阵容（主角+配角+反派）
- 场景设定生成（背景/氛围/时间/天气）
- 场景序列规划（故事分镜规划）
- 智能图像提示词生成（专业镜头语言）
- AI 图像生成（SDXL 风格）
- AI 视频生成

【输出要求】
只输出纯 JSON：
{
  "intent": "意图类型（generate_script/design_character/plan_scene/optimize_prompt/get_advice/explain/fix_problem/general）",
  "reply": "你的回复（中文，自然流畅，专业但不生硬，可以使用 markdown。如果需要举例，举具体的例子，不要笼统。200字以内）",
  "suggestedActions": [
    {
      "label": "按钮文字（10字以内）",
      "description": "操作说明（20字以内）",
      "apiEndpoint": "/api/...",
      "method": "POST",
      "bodyTemplate": {}
    }
  ],
  "followUpQuestions": ["追问问题1", "追问问题2"],
  "confidence": 0-1之间的小数
}

【最多推荐 3 个行动，0-3 个追问问题】

【语气要求】
- 自然、直接，像和朋友聊天
- 专业但不卖弄术语
- 有具体建议，不说废话
- 如果用户描述的需求很模糊，先确认一个关键信息，再给建议`;

// ============================================================
// 主函数
// ============================================================

export async function runAssistant(params: {
  userMessage: string;
  history?: AssistantMessage[];    // 最近的对话历史（最多 6 条）
  context?: AssistantContext;      // 项目上下文
}): Promise<AssistantResponse> {
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const { userMessage, history = [], context } = params;

  // 构建上下文提示
  const contextStr = context ? buildContextString(context) : '';

  // 构建消息数组
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: INTENT_RECOGNITION_PROMPT + (contextStr ? `\n\n【当前项目状态】\n${contextStr}` : '') },
    // 注入历史（最多 6 条）
    ...history.slice(-6).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseAssistantResponse(raw);
}

// ============================================================
// 工具函数：构建上下文字符串
// ============================================================

function buildContextString(ctx: AssistantContext): string {
  const lines: string[] = [];
  if (ctx.projectTitle) lines.push(`项目：${ctx.projectTitle}`);
  if (ctx.genre) lines.push(`题材：${ctx.genre}`);
  if (ctx.currentStep) {
    const stepLabels: Record<string, string> = {
      script: '剧本创作',
      characters: '角色设计',
      storyboards: '分镜规划',
      images: 'AI图片生成',
      video: '视频合成',
    };
    lines.push(`当前步骤：${stepLabels[ctx.currentStep] || ctx.currentStep}`);
  }
  if (ctx.hasScript !== undefined) lines.push(ctx.hasScript ? '剧本：已生成' : '剧本：未生成');
  if (typeof ctx.characterCount === 'number') lines.push(`角色数量：${ctx.characterCount}`);
  if (typeof ctx.storyboardCount === 'number') lines.push(`分镜数量：${ctx.storyboardCount}`);
  return lines.join('；');
}

// ============================================================
// 解析辅助
// ============================================================

const VALID_INTENTS: AssistantIntent[] = [
  'generate_script', 'design_character', 'plan_scene', 'optimize_prompt',
  'get_advice', 'explain', 'fix_problem', 'general',
];

function parseAssistantResponse(raw: string): AssistantResponse {
  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* keep empty */ }
    }
  }

  const str = (v: unknown, max: number, fallback = ''): string => {
    if (typeof v !== 'string') return fallback;
    return v.slice(0, max).trim() || fallback;
  };

  const rawIntent = str(parsed.intent, 50);
  const intent: AssistantIntent = VALID_INTENTS.includes(rawIntent as AssistantIntent)
    ? (rawIntent as AssistantIntent)
    : 'general';

  const rawActions = Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [];
  const suggestedActions: SuggestedAction[] = rawActions.slice(0, 3).map((item) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return {
      label: str(obj.label, 20, '操作'),
      description: str(obj.description, 50, ''),
      apiEndpoint: str(obj.apiEndpoint, 100, '/api/agnes/chat'),
      method: (typeof obj.method === 'string' && ['GET', 'POST', 'PATCH'].includes(obj.method)
        ? obj.method
        : 'POST') as 'GET' | 'POST' | 'PATCH',
      bodyTemplate: (typeof obj.bodyTemplate === 'object' && obj.bodyTemplate !== null)
        ? (obj.bodyTemplate as Record<string, unknown>)
        : undefined,
    };
  });

  const rawQuestions = Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [];
  const followUpQuestions = rawQuestions
    .filter((q) => typeof q === 'string')
    .map((q) => (q as string).slice(0, 80))
    .slice(0, 3);

  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.7;

  return {
    intent,
    reply: str(parsed.reply, 2000, '你好！我是你的漫画创作助手，有什么需要帮忙的吗？'),
    suggestedActions,
    followUpQuestions,
    confidence,
  };
}
