/**
 * 智能角色生成器（Character Generator）
 *
 * 与现有 ai-suggest 互补：
 * - ai-suggest：补全用户已填角色的空字段
 * - generator：从零生成完整角色（只需名字+性别+题材）
 *
 * 生成内容：personality/clothing/appearance/hair/eyes/build
 *          + expressions(表情动作) + signaturePose(标志动作) + colorScheme(主色调)
 */

import { chatCompletion } from './agnes-client';
import { getSetting } from './settings';

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'npc';

export interface CharacterSeed {
  name: string;            // 角色名（必填）
  gender?: string;         // 性别
  age?: string;            // 年龄
  genre?: string;          // 题材：fantasy/scifi/romance/mystery/action/horror/comedy
  role?: CharacterRole;    // 角色定位：主角/反派/配角/NPC
  style?: string;          // 艺术风格：anime/realistic/cyberpunk...
  hint?: string;           // 用户额外提示（如"冷酷的剑客"）
}

export interface GeneratedCharacter {
  name: string;
  gender: string;
  age: string;
  personality: string;
  clothing: string;
  appearance: string;
  hair: string;
  eyes: string;
  build: string;
  expressions: string;     // 表情动作（如：冷静时面无表情，愤怒时眉头紧锁）
  signaturePose: string;   // 标志动作（如：双手插兜侧身回眸）
  colorScheme: string;     // 主色调（如：深蓝+银白）
}

// 角色定位的生成倾向
const ROLE_TRAITS: Record<CharacterRole, string> = {
  protagonist: '主角：有成长弧线，外貌有辨识度但不完美，性格有闪光点也有缺点，服装实用且有个人特色',
  antagonist: '反派：气场强大，外貌有压迫感或隐藏的优雅，性格复杂（不是纯粹的坏），服装精致或有标志性符号',
  supporting: '配角：性格鲜明但不抢戏，外貌有记忆点，服装风格与主角形成对比或呼应',
  npc: 'NPC：平凡但有特色，外貌不抢眼但有辨识度，服装朴素符合其身份职业',
};

// ============================================================
// 主函数：从零生成完整角色
// ============================================================
export async function generateFullCharacter(seed: CharacterSeed): Promise<GeneratedCharacter> {
  if (!seed.name) {
    throw new Error('角色名必填');
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
  const role = seed.role || 'protagonist';
  const roleGuide = ROLE_TRAITS[role];

  const systemPrompt = `你是一位资深角色设定师，擅长为漫画/漫剧设计有辨识度、有深度的角色。
请根据给定的角色种子信息，生成一份完整的角色设定。

【角色定位指导】
${roleGuide}

【输出要求】
只输出一个 JSON 对象，包含以下字段（全部用中文，简短精准）：
- name: 角色名（沿用输入）
- gender: 性别
- age: 年龄（具体数字或描述，如"17岁"或"约25岁"）
- personality: 性格（2-3个关键词 + 一句描述，如"冷静、执着，内心有未解的执念"）
- clothing: 服装（款式+颜色+材质+标志性配饰，如"黑色长风衣，银色拉链，腰间挂着旧怀表"）
- appearance: 外貌（脸型/肤色/面部特征/气质，如"剑眉星目，肤色偏冷白，下颌线锋利，气质疏离"）
- hair: 发型发色（长度+颜色+细节，如"银白色碎短发，右侧别到耳后，有几缕不听话的呆毛"）
- eyes: 眼睛特征（颜色+形状+神态，如"深紫色狭长眼，眼神锐利但偶尔流露疲惫"）
- build: 体型（身材+身高感，如"修长偏瘦，178cm左右，肩宽腰窄"）
- expressions: 表情动作（2-3种典型表情，如"平时面无表情嘴角微抿；惊讶时眉毛轻挑；愤怒时眼神变冷下巴绷紧"）
- signaturePose: 标志动作（1个最有辨识度的姿势，如"思考时右手无意识地转动手腕上的旧怀表"）
- colorScheme: 主色调（2-3个颜色，代表角色的视觉调性，如"深蓝+银白+暗红"）

【设计原则】
1. 每个字段都要具体、可视化，避免空泛形容词
2. 角色要有辨识度——即使换个发型也能认出来
3. 服装和外貌要符合题材和角色定位
4. expressions 和 signaturePose 是角色的"演技"，要让画面生动
5. colorScheme 用于后续画面配色参考，选 2-3 个能代表角色气质的颜色

不要输出任何其他文字、注释或 markdown 代码块。只输出纯 JSON。`;

  const userPrompt = `【角色种子信息】
- 名字: ${seed.name}
- 性别: ${seed.gender || '(请根据名字和题材合理设定)'}
- 年龄: ${seed.age || '(请根据题材合理设定)'}
- 题材: ${seed.genre || '未指定（请自由发挥）'}
- 角色定位: ${role}
- 艺术风格: ${seed.style || 'anime'}
${seed.hint ? `- 用户提示: ${seed.hint}` : ''}

请生成完整的角色设定 JSON。`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseGeneratedCharacter(raw, seed);
}

// ============================================================
// 解析 LLM 返回（容错）
// ============================================================
function parseGeneratedCharacter(raw: string, seed: CharacterSeed): GeneratedCharacter {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = {};
      }
    } else {
      parsed = {};
    }
  }

  const trimStr = (v: unknown, max: number): string => {
    if (typeof v !== 'string') return '';
    return v.slice(0, max).trim();
  };

  return {
    name: seed.name,
    gender: trimStr(parsed.gender, 20) || seed.gender || '',
    age: trimStr(parsed.age, 20) || seed.age || '',
    personality: trimStr(parsed.personality, 300),
    clothing: trimStr(parsed.clothing, 300),
    appearance: trimStr(parsed.appearance, 300),
    hair: trimStr(parsed.hair, 200),
    eyes: trimStr(parsed.eyes, 200),
    build: trimStr(parsed.build, 200),
    expressions: trimStr(parsed.expressions, 400),
    signaturePose: trimStr(parsed.signaturePose, 200),
    colorScheme: trimStr(parsed.colorScheme, 100),
  };
}

// ============================================================
// 批量生成角色阵容（一键生成主角+配角+反派）
// ============================================================
export interface CastSeed {
  genre?: string;
  style?: string;
  theme?: string;       // 故事主题/背景
  castSize?: number;    // 角色数量（默认 3-4）
}

export async function generateCast(seed: CastSeed): Promise<GeneratedCharacter[]> {
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
  const count = Math.max(2, Math.min(8, seed.castSize || 3));

  const systemPrompt = `你是一位资深角色设定师。请根据题材和主题，一次性设计一组有戏剧张力的角色阵容。

【输出要求】
输出一个 JSON 对象，包含 "characters" 数组，每个元素是一个角色设定。
角色定位要包含至少 1 个主角(protagonist)，如果题材适合，包含 1 个反派(antagonist)，其余为配角(supporting)。

每个角色字段（中文，简短精准）：
- name, gender, age, role(protagonist/antagonist/supporting)
- personality, clothing, appearance, hair, eyes, build
- expressions(表情动作), signaturePose(标志动作), colorScheme(主色调)

设计原则：
1. 角色之间要有视觉对比（身高/发色/服装风格/色调）
2. 角色之间要有戏剧关系潜力（对立/同盟/暗恋/师徒等）
3. 每个角色都有辨识度，不脸谱化

只输出纯 JSON，不要任何其他文字。`;

  const userPrompt = `【题材】${seed.genre || '自由发挥'}
【艺术风格】${seed.style || 'anime'}
【故事主题】${seed.theme || '(未指定，请自由构思)'}
【角色数量】${count}

请生成 ${count} 个角色的完整设定。`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';

  let parsed: { characters?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    try {
      parsed = m ? JSON.parse(m[0]) : { characters: [] };
    } catch {
      parsed = { characters: [] };
    }
  }

  const arr = Array.isArray(parsed.characters) ? parsed.characters : [];
  return arr.map((item) => {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const trimStr = (v: unknown, max: number): string => {
      if (typeof v !== 'string') return '';
      return v.slice(0, max).trim();
    };
    return {
      name: trimStr(obj.name, 50) || '未命名角色',
      gender: trimStr(obj.gender, 20),
      age: trimStr(obj.age, 20),
      personality: trimStr(obj.personality, 300),
      clothing: trimStr(obj.clothing, 300),
      appearance: trimStr(obj.appearance, 300),
      hair: trimStr(obj.hair, 200),
      eyes: trimStr(obj.eyes, 200),
      build: trimStr(obj.build, 200),
      expressions: trimStr(obj.expressions, 400),
      signaturePose: trimStr(obj.signaturePose, 200),
      colorScheme: trimStr(obj.colorScheme, 100),
    } as GeneratedCharacter;
  });
}
