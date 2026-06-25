/**
 * 剧本解析器（Script Parser）
 * 支持两种输入格式：
 *   1. 格式 A：传统换行分隔的场景描述
 *   2. 格式 B：结构化 JSON（由 LLM multi-pass 剧本生成器输出
 *
 * 统一输出 StoryboardFrame[] 用于分镜展示与图片生成
 */

import { inferCameraAngle, inferEmotion } from '@/features/generation/prompt-library';

// ============================================================
// 标准分镜结构（用于图片生成 API）
// ============================================================
export interface StoryboardFrame {
  scene_number: number;
  title: string;
  location: string;
  time_of_day: string;
  description: string;        // 视觉画面详细描述（中文）
  camera_angle: string;       // 镜头角度代码（对应 prompt-library.ts）
  emotion: string;            // 情绪代码
  dialogue?: string;          // 对白（可选）
  visual_keywords: string;    // 英文视觉关键词（给图像模型）
  characters_in_scene: string[];
  weather?: string;           // 天气/光线关键词（英文）
  act_num?: number;           // 第几幕
  // ===== 新字段：直接映射到图片生成提示词 =====
  lighting?: string;          // 光影方案 key（如 golden_hour / neon）
  composition?: string;       // 构图 key（如 rule_of_thirds / symmetry）
  color_palette?: string;     // 色板 key（如 warm_amber / cool_blue）
  camera_movement?: string;   // 镜头运动 key（如 tracking_shot / push_in）
}

// ============================================================
// LLM 输出的 JSON 结构（参考 prompt-library.ts 中的 schema
// ============================================================
interface ParsedScriptJSON {
  title?: string;
  logline?: string;
  genre?: string;
  world_style?: string;
  acts?: Array<{
    act_num: number;
    name: string;
    scenes: Array<{
      scene_number: number;
      title?: string;
      location?: string;
      time_of_day?: string;
      weather?: string;
      description?: string;
      camera_angle?: string;
      emotion?: string;
      dialogue?: string;
      visual_keywords?: string;
      characters_in_scene?: string[];
      lighting?: string;
      composition?: string;
      color_palette?: string;
      camera_movement?: string;
    }>;
  }>;
  // 备用：扁平数组结构
  scenes?: Array<{
    scene_number: number;
    title?: string;
    location?: string;
    time_of_day?: string;
    weather?: string;
    description?: string;
    camera_angle?: string;
    emotion?: string;
    dialogue?: string;
    visual_keywords?: string;
    characters_in_scene?: string[];
    // 新字段
    lighting?: string;
    composition?: string;
    color_palette?: string;
    camera_movement?: string;
  }>;
}

// ============================================================
// 从纯文本解析剧本（用于向后兼容）
// 支持格式：场景1\n描述:xxx\n对白:xxx\n镜头:xxx
// ============================================================
function parseFromText(rawContent: string): StoryboardFrame[] {
  const frames: StoryboardFrame[] = [];
  const text = rawContent.trim();

  // 按"场景X:"或"Scene X:"分割
  const sceneRegex = /(?:场景|Scene)\s*(\d+)[：:]/gi;
  const chunks: Array<{ num: number; content: string }> = [];

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let lastNum = 0;

  while ((match = sceneRegex.exec(text)) !== null) {
    if (chunks.length > 0) {
      chunks[chunks.length - 1].content = text.slice(lastIndex, match.index).trim();
    }
    lastNum = parseInt(match[1], 10);
    chunks.push({ num: lastNum, content: '' });
    lastIndex = sceneRegex.lastIndex;
  }

  if (chunks.length > 0) {
    chunks[chunks.length - 1].content = text.slice(lastIndex).trim();
  }

  // 如果没发现场景标记，则将整个文本视为一个场景
  const effectiveChunks = chunks.length > 0
    ? chunks
    : [{ num: 1, content: text }];

  effectiveChunks.forEach((chunk) => {
    const descMatch = chunk.content.match(/(?:描述|description|画面|场景描述)\s*[:：]\s*([^\n]+)/i);
    const dialogMatch = chunk.content.match(/(?:对白|dialogue|台词)\s*[:：]\s*([^\n]+)/i);
    const emoMatch = chunk.content.match(/(?:情绪|emotion|氛围)\s*[:：]\s*([^\n]+)/i);
    const camMatch = chunk.content.match(/(?:镜头|camera|camera_angle)\s*[:：]\s*([^\n]+)/i);
    const locMatch = chunk.content.match(/(?:地点|location|场景)\s*[:：]\s*([^\n]+)/i);
    const timeMatch = chunk.content.match(/(?:时间|time_of_day|time)\s*[:：]\s*([^\n]+)/i);
    const vkMatch = chunk.content.match(/(?:视觉关键词|visual_keywords|visual)\s*[:：]\s*([^\n]+)/i);

    const description = descMatch
      ? descMatch[1].trim()
      : chunk.content.replace(/^(描述|画面|scene|场景)[：:].*$/gim, '').trim().slice(0, 400);

    const camHint = camMatch ? camMatch[1].trim() : '';
    const emoHint = emoMatch ? emoMatch[1].trim() : '';

    frames.push({
      scene_number: chunk.num,
      title: `场景 ${chunk.num}`,
      location: locMatch ? locMatch[1].trim() : '',
      time_of_day: timeMatch ? timeMatch[1].trim() : 'afternoon',
      description: description || chunk.content.slice(0, 300),
      camera_angle: inferCameraAngle(camHint || 'medium_shot'),
      emotion: inferEmotion(emoHint || 'peaceful'),
      dialogue: dialogMatch ? dialogMatch[1].trim() : undefined,
      visual_keywords: vkMatch ? vkMatch[1].trim() : '',
      characters_in_scene: [],
    });
  });

  return frames;
}

// ============================================================
// 从 JSON 解析剧本（从 multi-pass 生成器输出）
// ============================================================
function parseFromJSON(json: ParsedScriptJSON): StoryboardFrame[] {
  const frames: StoryboardFrame[] = [];

  if (json.acts && json.acts.length > 0) {
    json.acts.forEach((act) => {
      if (!act.scenes) return;
      act.scenes.forEach((scene) => {
        const camKey = inferCameraAngle(scene.camera_angle || 'medium_shot');
        const emoKey = inferEmotion(scene.emotion || 'peaceful');

        frames.push({
          scene_number: scene.scene_number,
          title: scene.title || `场景 ${scene.scene_number}`,
          location: scene.location || '',
          time_of_day: scene.time_of_day || 'afternoon',
          weather: scene.weather,
          description: scene.description || '',
          camera_angle: camKey,
          emotion: emoKey,
          dialogue: scene.dialogue,
          visual_keywords: scene.visual_keywords || '',
          characters_in_scene: scene.characters_in_scene || [],
          act_num: act.act_num,
          lighting: scene.lighting,
          composition: scene.composition,
          color_palette: scene.color_palette,
          camera_movement: scene.camera_movement,
        });
      });
    });
  } else if (json.scenes && json.scenes.length > 0) {
    json.scenes.forEach((scene) => {
      const camKey = inferCameraAngle(scene.camera_angle || 'medium_shot');
      const emoKey = inferEmotion(scene.emotion || 'peaceful');

      frames.push({
        scene_number: scene.scene_number,
        title: scene.title || `场景 ${scene.scene_number}`,
        location: scene.location || '',
        time_of_day: scene.time_of_day || 'afternoon',
        weather: scene.weather,
        description: scene.description || '',
        camera_angle: camKey,
        emotion: emoKey,
        dialogue: scene.dialogue,
        visual_keywords: scene.visual_keywords || '',
        characters_in_scene: scene.characters_in_scene || [],
        lighting: scene.lighting,
        composition: scene.composition,
        color_palette: scene.color_palette,
        camera_movement: scene.camera_movement,
      });
    });
  }

  return frames.sort((a, b) => a.scene_number - b.scene_number);
}

// ============================================================
// 尝试从任意字符串中解析 JSON（LLM 可能输出 markdown 代码块）
// ============================================================
function tryExtractJSON(raw: string): ParsedScriptJSON | null {
  if (!raw) return null;

  // 先尝试直接 JSON.parse
  try {
    const json = JSON.parse(raw);
    if (json && (json.acts || json.scenes)) return json;
  } catch {
    // 继续尝试
  }

  // 尝试提取 ```json ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = raw.match(codeBlockRegex);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // 继续
    }
  }

  // 尝试提取第一个 { 到最后一个 }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = raw.slice(firstBrace, lastBrace + 1);
      const json = JSON.parse(candidate);
      if (json && (json.acts || json.scenes)) return json;
    } catch {
      // 继续
    }
  }

  // 尝试更宽松的提取：找到最大平衡花括号子串
  let depth = 0;
  let maxStart = -1;
  let maxEnd = -1;
  let currentStart = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') {
      if (depth === 0) currentStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && currentStart !== -1) {
        const subLen = i - currentStart;
        if (maxEnd - maxStart < subLen) {
          maxStart = currentStart;
          maxEnd = i;
        }
        currentStart = -1;
      }
    }
  }

  if (maxStart !== -1 && maxEnd > maxStart) {
    try {
      const json = JSON.parse(raw.slice(maxStart, maxEnd + 1));
      if (json && (json.acts || json.scenes)) return json;
    } catch {
      // 不处理
    }
  }

  return null;
}

// ============================================================
// 主入口：解析任意格式（文本 / JSON）的剧本
// ============================================================
export function parseScriptToStoryboards(rawContent: string): StoryboardFrame[] {
  const json = tryExtractJSON(rawContent);
  if (json) {
    const frames = parseFromJSON(json);
    if (frames.length > 0) return frames;
  }
  return parseFromText(rawContent);
}

// ============================================================
// 获取剧本元信息（用于展示）
// ============================================================
export function getScriptMetadata(rawContent: string): {
  title: string;
  logline: string;
  sceneCount: number;
  characterCount: number;
} {
  const json = tryExtractJSON(rawContent);
  const frames = parseScriptToStoryboards(rawContent);
  const allCharacters = new Set<string>();
  frames.forEach((f) => f.characters_in_scene.forEach((c) => allCharacters.add(c)));

  return {
    title: json?.title || '漫剧剧本',
    logline: json?.logline || '',
    sceneCount: frames.length,
    characterCount: allCharacters.size,
  };
}
