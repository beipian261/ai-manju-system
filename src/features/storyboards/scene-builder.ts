/**
 * 智能场景构建器（Scene Builder）
 *
 * 功能：
 * 1. buildScene()         — 根据简短描述生成完整场景设定（背景/氛围/时间/天气/构图建议）
 * 2. suggestSceneFlow()   — 从故事情节生成场景序列（连续分镜规划）
 * 3. expandSceneDetail()  — 对已有场景进行细节扩展（让 prompt 更专业）
 *
 * 和 smart-prompt-engine 的分工：
 * - scene-builder：先"设计场景"（做什么、在哪、什么氛围）
 * - smart-prompt-engine：把设计好的场景"翻译成图像提示词"（怎么画）
 */

import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';

// ============================================================
// 数据类型
// ============================================================

export type SceneType =
  | 'interior'      // 室内
  | 'exterior'      // 室外
  | 'urban'         // 城市街景
  | 'nature'        // 自然环境
  | 'fantasy'       // 奇幻/异世界
  | 'scifi'         // 科幻环境
  | 'action'        // 动作场景
  | 'intimate'      // 亲密/对话
  | 'crowd'         // 人群/宏大
  | 'void';         // 抽象/虚空

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind' | 'sunny' | 'overcast';

export interface SceneResult {
  title: string;               // 场景标题（中文）
  description: string;         // 场景描述（中文，详细）
  englishDescription: string;  // 英文场景描述（用于图像 prompt）
  sceneType: SceneType;
  location: string;            // 具体地点（中文，如"古城废墟的钟楼顶层"）
  timeOfDay: TimeOfDay;
  weather: Weather;
  atmosphere: string;          // 氛围关键词（英文，如 "tense, stormy, dramatic"）
  keyElements: string[];       // 场景关键元素（道具/背景细节，中文）
  cameraHint: string;          // 镜头建议（如"low angle looking up"）
  lightingHint: string;        // 光影建议（如"dramatic backlit storm clouds"）
  colorMoodHint: string;       // 色彩情绪建议（如"dark blues and grays"）
  narrativeRole: string;       // 叙事功能（如"转折点"、"高潮"、"铺垫"）
}

export interface SceneFlowResult {
  totalScenes: number;
  scenes: Array<{
    order: number;
    title: string;
    briefDescription: string;  // 一句话场景描述（中文）
    narrativeRole: string;      // 叙事功能
    suggestedCamera: string;    // 镜头建议
    estimatedPageCount: number; // 预估页数（1-4）
  }>;
}

export interface SceneSeed {
  description: string;         // 用户输入的场景描述（可以很简短）
  genre?: string;              // 题材
  characters?: string[];       // 出场角色名字
  sceneType?: SceneType;
  emotionalTone?: string;      // 情绪基调（如"悲壮"、"浪漫"、"紧张"）
  isKeyScene?: boolean;        // 是否关键场景（高潮/转折）
  previousScene?: string;      // 上一个场景的描述（用于保持连贯）
  style?: string;              // 艺术风格
}

// ============================================================
// 常量
// ============================================================

const SCENE_TYPE_GUIDE: Record<SceneType, string> = {
  interior: '室内场景——注意空间感、光源来源（窗光/灯光）、家具细节',
  exterior: '室外场景——注意天空、地平线、远景深度',
  urban: '城市街景——注意建筑细节、人群密度、招牌/路灯/交通',
  nature: '自然环境——注意植被层次、光线穿透、水面/山川/天气',
  fantasy: '奇幻环境——可以有不合理的建筑/地形/生物，重点是视觉奇观',
  scifi: '科幻环境——硬科技质感，全息、金属、发光元素，透视感强',
  action: '动作场景——破坏感、运动模糊、动态构图，重点是力量感和速度感',
  intimate: '亲密/对话场景——小空间、soft light、浅景深，重点是人物关系',
  crowd: '人群/宏大场景——远景宏大，注意层次感和规模感',
  void: '抽象/虚空场景——可以打破物理规律，意象化处理',
};

// ============================================================
// 主函数 1：从简短描述生成完整场景设定
// ============================================================
export async function buildScene(seed: SceneSeed): Promise<SceneResult> {
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const sceneTypeGuide = seed.sceneType ? SCENE_TYPE_GUIDE[seed.sceneType] : '请根据场景描述自动判断最合适的场景类型';

  const systemPrompt = `你是一位资深漫画分镜导演，擅长把简短的场景描述扩展成完整的、可视化的场景设定。

【输出要求】
只输出纯 JSON，包含以下字段：
- title: 场景标题（中文，10字以内）
- description: 详细场景描述（中文，50-100字，包含空间/光影/氛围/细节）
- englishDescription: 英文场景描述（30-60词，适合作为图像生成 prompt 的背景描述）
- sceneType: 场景类型（interior/exterior/urban/nature/fantasy/scifi/action/intimate/crowd/void 之一）
- location: 具体地点（中文，如"古城废墟的钟楼顶层"或"校园图书馆的角落"）
- timeOfDay: 时间（dawn/morning/noon/afternoon/dusk/evening/night/midnight 之一）
- weather: 天气（clear/cloudy/rain/storm/snow/fog/wind/sunny/overcast 之一）
- atmosphere: 氛围关键词（英文，3-5个词，如 "tense, stormy, dramatic, high-contrast"）
- keyElements: 场景关键元素数组（中文，3-5个，如 ["破碎的玻璃窗", "摇曳的烛光", "倒塌的书架"]）
- cameraHint: 镜头建议（英文，如 "low angle shot looking up at character against dark sky"）
- lightingHint: 光影建议（英文，如 "dramatic backlit storm clouds with lightning flash"）
- colorMoodHint: 色彩情绪（英文，如 "dark blues and stormy grays with electric white"）
- narrativeRole: 叙事功能（中文，如 "情节转折点" 或 "高潮前铺垫" 或 "角色内心外化"）

【设计原则】
1. 所有细节要可视化——读者看了脑海中能浮现具体画面
2. englishDescription 要像电影剧本场景说明，简洁有力
3. atmosphere 直接影响色彩和光影，要精准
4. cameraHint/lightingHint/colorMoodHint 要协调统一，服务于情绪

${seed.sceneType ? `【场景类型指导】\n${sceneTypeGuide}` : ''}`;

  const userPrompt = `【场景描述】${seed.description}
${seed.genre ? `【题材】${seed.genre}` : ''}
${seed.characters && seed.characters.length > 0 ? `【出场角色】${seed.characters.join('、')}` : ''}
${seed.emotionalTone ? `【情绪基调】${seed.emotionalTone}` : ''}
${seed.isKeyScene ? '【注意】这是关键场景（高潮/转折），视觉冲击力要强' : ''}
${seed.previousScene ? `【上一场景】${seed.previousScene}（请保持场景连贯性，避免视觉重复）` : ''}
${seed.style ? `【艺术风格】${seed.style}` : ''}

请生成完整场景设定 JSON。`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseSceneResult(raw, seed);
}

// ============================================================
// 主函数 2：从故事情节生成场景序列（分镜规划）
// ============================================================
export async function suggestSceneFlow(params: {
  storyOutline: string;        // 故事大纲或情节描述
  genre?: string;
  totalScenes?: number;        // 期望场景数（2-12，默认 5）
  style?: string;
}): Promise<SceneFlowResult> {
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
  const count = Math.max(2, Math.min(12, params.totalScenes || 5));

  const systemPrompt = `你是一位资深漫画编辑，擅长把故事大纲拆解成合理的分镜场景序列。

【输出要求】
只输出纯 JSON，格式：
{
  "totalScenes": number,
  "scenes": [
    {
      "order": 1,
      "title": "场景标题（中文）",
      "briefDescription": "一句话场景描述（中文，20字以内，说明发生了什么）",
      "narrativeRole": "叙事功能（如：开场建立/冲突引入/情感转折/高潮/结局）",
      "suggestedCamera": "镜头建议（英文，如 wide establishing shot 或 close-up reaction）",
      "estimatedPageCount": 1-4之间的整数
    }
  ]
}

【设计原则】
1. 场景要有节奏感：快慢交替，宏观和细节镜头交替
2. 每个场景都有清晰的叙事功能
3. estimatedPageCount 反映场景复杂度（单个动作=1页，复杂战斗/对白=3-4页）
4. 场景序列要有情绪弧线：建立→发展→高潮→落幕`;

  const userPrompt = `【故事大纲】${params.storyOutline}
${params.genre ? `【题材】${params.genre}` : ''}
${params.style ? `【风格】${params.style}` : ''}
【场景数量】约 ${count} 个场景

请生成场景序列 JSON。`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseSceneFlowResult(raw, count);
}

// ============================================================
// 主函数 3：扩展场景细节（让已有分镜描述更专业）
// ============================================================
export async function expandSceneDetail(params: {
  currentDescription: string;   // 当前分镜描述
  genre?: string;
  characters?: string[];
  emotionalTone?: string;
}): Promise<{ expanded: string; atmosphere: string; cameraHint: string }> {
  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const systemPrompt = `你是一位专业的漫画分镜编剧。把简单的场景描述扩展成专业、可视化的分镜说明。

【输出要求】
只输出纯 JSON：
{
  "expanded": "扩展后的详细场景描述（英文，40-80词，适合作为 Stable Diffusion 风格的图像提示词背景描述）",
  "atmosphere": "氛围关键词（英文，3-4个词组，用逗号分隔）",
  "cameraHint": "镜头建议（英文，一句话，包含景别+角度+运动）"
}

【注意】
- expanded 要添加：光源方向、表面质感、远景细节、空气状态（雾气/尘埃/光柱）
- atmosphere 要能指导调色师
- 不要在 JSON 以外输出任何文字`;

  const userPrompt = `【原始描述】${params.currentDescription}
${params.genre ? `【题材】${params.genre}` : ''}
${params.characters && params.characters.length > 0 ? `【出场角色】${params.characters.join('、')}` : ''}
${params.emotionalTone ? `【情绪基调】${params.emotionalTone}` : ''}`;

  const response = await chatCompletion({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(raw);
    return {
      expanded: typeof parsed.expanded === 'string' ? parsed.expanded.slice(0, 500) : params.currentDescription,
      atmosphere: typeof parsed.atmosphere === 'string' ? parsed.atmosphere.slice(0, 200) : '',
      cameraHint: typeof parsed.cameraHint === 'string' ? parsed.cameraHint.slice(0, 200) : '',
    };
  } catch {
    return {
      expanded: params.currentDescription,
      atmosphere: '',
      cameraHint: '',
    };
  }
}

// ============================================================
// 解析辅助函数
// ============================================================

function parseSceneResult(raw: string, seed: SceneSeed): SceneResult {
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

  const arr = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === 'string').map((x) => (x as string).slice(0, 50));
  };

  const validSceneTypes: SceneType[] = ['interior', 'exterior', 'urban', 'nature', 'fantasy', 'scifi', 'action', 'intimate', 'crowd', 'void'];
  const validTimeOfDay: TimeOfDay[] = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'evening', 'night', 'midnight'];
  const validWeather: Weather[] = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'wind', 'sunny', 'overcast'];

  const rawType = str(parsed.sceneType, 20);
  const rawTime = str(parsed.timeOfDay, 20);
  const rawWeather = str(parsed.weather, 20);

  return {
    title: str(parsed.title, 50, '未命名场景'),
    description: str(parsed.description, 500, seed.description),
    englishDescription: str(parsed.englishDescription, 500, ''),
    sceneType: (validSceneTypes.includes(rawType as SceneType) ? rawType : (seed.sceneType || 'exterior')) as SceneType,
    location: str(parsed.location, 100, ''),
    timeOfDay: (validTimeOfDay.includes(rawTime as TimeOfDay) ? rawTime : 'afternoon') as TimeOfDay,
    weather: (validWeather.includes(rawWeather as Weather) ? rawWeather : 'clear') as Weather,
    atmosphere: str(parsed.atmosphere, 200, ''),
    keyElements: arr(parsed.keyElements).slice(0, 6),
    cameraHint: str(parsed.cameraHint, 200, ''),
    lightingHint: str(parsed.lightingHint, 200, ''),
    colorMoodHint: str(parsed.colorMoodHint, 200, ''),
    narrativeRole: str(parsed.narrativeRole, 50, ''),
  };
}

function parseSceneFlowResult(raw: string, expectedCount: number): SceneFlowResult {
  let parsed: { totalScenes?: unknown; scenes?: unknown[] } = {};

  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* keep empty */ }
    }
  }

  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

  return {
    totalScenes: typeof parsed.totalScenes === 'number' ? parsed.totalScenes : scenes.length || expectedCount,
    scenes: scenes.map((item, idx) => {
      const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const str = (v: unknown, max: number, fallback = ''): string => {
        if (typeof v !== 'string') return fallback;
        return v.slice(0, max).trim() || fallback;
      };
      return {
        order: typeof obj.order === 'number' ? obj.order : idx + 1,
        title: str(obj.title, 50, `场景 ${idx + 1}`),
        briefDescription: str(obj.briefDescription, 100, ''),
        narrativeRole: str(obj.narrativeRole, 50, ''),
        suggestedCamera: str(obj.suggestedCamera, 150, ''),
        estimatedPageCount: typeof obj.estimatedPageCount === 'number'
          ? Math.max(1, Math.min(4, obj.estimatedPageCount))
          : 2,
      };
    }),
  };
}
