/**
 * 角色批量生成器
 * 
 * 优化策略：一次 AI 调用生成所有角色，相比串行调用提升 5-10 倍速度
 * 
 * 适用场景：从剧本提取多个角色时使用
 */

import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';

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
  expressions: string;
  signaturePose: string;
  colorScheme: string;
}

export interface BatchGenerateOptions {
  genre?: string;
  style?: string;
  hint?: string;
}

// ============================================================
// 批量生成角色设定（一次 AI 调用生成所有角色）
// ============================================================
export async function batchGenerateCharacters(
  names: string[],
  options: BatchGenerateOptions = {}
): Promise<GeneratedCharacter[]> {
  if (names.length === 0) return [];

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const systemPrompt = `你是一位资深角色设定师，擅长为漫画/漫剧设计有辨识度、有深度的角色阵容。

请根据给定的角色名列表，一次性生成所有角色的完整设定。

【输出要求】
输出一个 JSON 对象，包含 "characters" 数组，每个元素是一个角色设定。

每个角色字段（全部用中文，简短精准）：
- name: 角色名（沿用输入）
- gender: 性别（确保男女比例均衡，不要全部都是男性或女性）
- age: 年龄（每个角色年龄要多样化，不要全部一样，合理分布在15-50岁之间）
- personality: 性格（2-3个关键词 + 一句描述）
- clothing: 服装（款式+颜色+材质+标志性配饰）
- appearance: 外貌（脸型/肤色/面部特征/气质）
- hair: 发型发色（长度+颜色+细节）
- eyes: 眼睛特征（颜色+形状+神态）
- build: 体型（身材+身高感）
- expressions: 表情动作（2-3种典型表情）
- signaturePose: 标志动作（1个最有辨识度的姿势）
- colorScheme: 主色调（2-3个颜色）

【设计原则】
1. 每个角色都要有辨识度——即使换个发型也能认出来
2. 角色之间要有视觉对比（身高/发色/服装风格/色调）
3. 角色之间要有戏剧关系潜力（对立/同盟/师徒等）
4. 每个字段都要具体、可视化，避免空泛形容词
5. 年龄和性别要多样化，避免单调

${options.hint ? `【用户额外提示】\n${options.hint}` : ''}

只输出纯 JSON，不要任何其他文字、注释或 markdown 代码块。`;

  const userPrompt = `【角色名单】
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}
【题材】${options.genre || '未指定（请自由发挥）'}
【艺术风格】${options.style || 'anime'}

请一次性生成 ${names.length} 个角色的完整设定，确保每个角色都有独特的个性和视觉风格。`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: Math.min(8000, names.length * 800),
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
  
  const results: GeneratedCharacter[] = [];
  
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const item = arr[i] || arr.find((c: any) => c.name === name);
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    
    results.push({
      name: name,
      gender: (typeof obj.gender === 'string' ? obj.gender : '').slice(0, 20),
      age: (typeof obj.age === 'string' ? obj.age : '').slice(0, 20),
      personality: (typeof obj.personality === 'string' ? obj.personality : '').slice(0, 300),
      clothing: (typeof obj.clothing === 'string' ? obj.clothing : '').slice(0, 300),
      appearance: (typeof obj.appearance === 'string' ? obj.appearance : '').slice(0, 300),
      hair: (typeof obj.hair === 'string' ? obj.hair : '').slice(0, 200),
      eyes: (typeof obj.eyes === 'string' ? obj.eyes : '').slice(0, 200),
      build: (typeof obj.build === 'string' ? obj.build : '').slice(0, 200),
      expressions: (typeof obj.expressions === 'string' ? obj.expressions : '').slice(0, 400),
      signaturePose: (typeof obj.signaturePose === 'string' ? obj.signaturePose : '').slice(0, 200),
      colorScheme: (typeof obj.colorScheme === 'string' ? obj.colorScheme : '').slice(0, 100),
    });
  }

  return results;
}