/**
 * 专业 AI 漫剧提示词库（Prompt Library
 *
 * 基于业界标准角色一致性方案：
 * - IP-Adapter / Reference Injection / Character Sheet / LORA 风格锁
 * - 电影级专业镜头语言
 * - 三幕剧结构（Act 1: Setup / Act 2: Confrontation / Act 3: Resolution
 *
 * 每个模块都提供可组合函数，支持动态拼接。
 */

// ============================================================
// 镜头语言库（Camera Angle Library
// 参考电影摄影专业术语：参考专业电影摄影术语表
// ============================================================
export const CAMERA_ANGLES = {
  extreme_close_up: 'extreme close-up (ECU), only the subject\'s eyes or mouth visible, dramatic and emotional framing',
  close_up: 'close-up shot (CU), head and shoulders, emphasizes facial expression and emotion',
  medium_close_up: 'medium close-up (MCU), from chest up, balances character and action',
  medium_shot: 'medium shot (MS), from waist up, standard dialogue framing',
  medium_long_shot: 'medium long shot (MLS), from knees up, shows character action',
  long_shot: 'long shot (LS), full body, establishes location and scale',
  extreme_long_shot: 'extreme long shot (ELS), wide establishing view, environment dominates',
  over_shoulder: 'over-the-shoulder shot (OTS), shows dialogue interaction, natural perspective',
  two_shot: 'two-shot, two characters in frame, shows relationship dynamics',
  pov_shot: 'point-of-view shot (POV), camera becomes the character\'s eyes, immersive',
  low_angle: 'low angle shot, looking up at subject, conveys power and dominance',
  high_angle: 'high angle shot, looking down at subject, conveys vulnerability',
  birds_eye: "bird's-eye view, overhead perspective, map-like view of the scene",
  dutch_angle: 'dutch angle / canted angle, tilted camera, disorientation or tension',
  top_down: 'top-down flat lay, symmetrical composition, product-style presentation',
  tracking_shot: 'tracking shot, camera follows subject, cinematic motion feel',
  wide_establishing: 'wide establishing shot, reveals full location, sets the scene',
} as const;

// ============================================================
// 情绪/氛围库（Emotion & Mood Library）
// ============================================================
export const EMOTION_TONES = {
  romantic: 'warm romantic tones, soft pink and gold lighting, intimate mood, tender atmosphere',
  tense: 'high tension mood, dramatic contrast lighting, sweat and grit, nervous energy',
  mysterious: 'mysterious foggy atmosphere, low-key lighting, shadows hiding secrets',
  epic: 'epic and grand scale, volumetric god rays, dramatic cinematic composition',
  peaceful: 'serene peaceful mood, soft natural daylight, gentle breeze, calm expression',
  comedic: 'lighthearted comedic tone, bright colors, exaggerated expression, playful',
  melancholy: 'melancholy bittersweet mood, cool blue palette, soft rain or autumn leaves',
  dramatic: 'dramatic theatrical lighting, chiaroscuro, high contrast, emotional depth',
  cheerful: 'cheerful vibrant energy, bright sunshine colors, positive upbeat mood',
  horror: 'horror suspense atmosphere, dark shadows, unsettling angles, menacing mood',
  action: 'dynamic action energy, motion blur, dynamic pose, kinetic composition',
  intimate: 'intimate private moment, shallow depth of field, warm lamp light',
  contemplative: 'contemplative thoughtful expression, soft backlight, serene atmosphere',
  hopeful: 'hopeful uplifting mood, golden hour lighting, positive expression',
  melancholic: 'sad melancholic mood, cool color temperature, soft rain, somber expression',
  nostalgic: 'nostalgic retro aesthetic, warm film grain, golden sunset tones',
  cold: 'cold clinical atmosphere, icy blue tones, sharp crisp shadows',
  festive: 'festive celebratory mood, decorative warm lighting, joyful expression',
  magical: 'magical mystical enchantment, particle effects, ethereal glow, fantasy atmosphere',
} as const;

// ============================================================
// 艺术风格库（Art Style Library）
// ============================================================
export const ART_STYLES = {
  anime: 'premium japanese anime illustration, studio-quality line art, soft cel-shading, beautiful detailed eyes, anime cinematic composition',
  realistic: 'ultra realistic photorealistic, 8k professional photography, sharp focus, cinematic lighting',
  cinematic_photo: 'cinematic photograph, 35mm film grain, shallow depth of field, professional color grading',
  comic_book: 'american comic book style, bold ink outlines, vibrant flat colors, dynamic halftone shading',
  manga_bw: 'japanese manga style, black and white, screentone shading, detailed ink work, dynamic panel layout',
  pixar_3d: 'pixar-style 3d rendering, stylized cgi, beautiful materials, soft global illumination',
  watercolor: 'traditional watercolor painting, soft color bleeding, paper texture, organic brush strokes',
  oil_painting: 'classic oil painting, rich impasto brushwork, warm tones, renaissance composition',
  cyberpunk: 'cyberpunk aesthetic, neon light reflections, rain-soaked streets, high-tech low-life atmosphere',
  fantasy: 'high fantasy illustration, epic composition, magical atmosphere, detailed fantasy world-building',
  chibi: 'chibi / super-deformed style, big expressive eyes, cute proportions, playful pose',
  ghibli: 'studio ghibli inspired, hand-drawn feel, soft watercolor backgrounds, whimsical atmosphere',
  webtoon: 'korean webtoon / manhwa style, vertical panel layout, clean line art, soft coloring',
  vintage: 'vintage retro illustration, aged paper texture, muted color palette, nostalgic aesthetic',
  disney: 'modern disney-style animation, clean shapes, expressive character acting, warm colors',
  noir: 'film noir aesthetic, black and white, dramatic chiaroscuro lighting, moody atmosphere',
  cartoon_2d: 'clean 2d cartoon illustration, flat vector style, bold silhouette, friendly design',
  low_poly: 'low poly 3d aesthetic, geometric minimalism, stylized faceted shapes, game-ready',
  ink_wash: 'chinese ink wash painting (水墨画), sumi-e style, flowing brush strokes, minimal composition',
} as const;

// ============================================================
// 质量/技术关键词（Quality & Technical Tags）
// 这些是让图像达到专业级的关键
// ============================================================
export const QUALITY_TAGS = {
  base: 'masterpiece, best quality, highly detailed, 8k resolution, ultra detailed',
  face: 'beautiful detailed eyes, detailed facial features, expressive face, perfect anatomy',
  composition: 'cinematic composition, rule of thirds, golden ratio, professional framing',
  lighting: 'dramatic cinematic lighting, volumetric light, ray tracing, global illumination, soft shadows',
  color: 'professional color grading, beautiful color palette, harmonic color scheme, vibrant colors',
  depth: 'shallow depth of field, bokeh background, cinematic focus, sharp foreground',
  texture: 'rich texture detail, fabric weave, skin pores, realistic material properties',
  
  // ===== 漫画/漫剧专用质量标签 =====
  comic_art: 'dynamic comic panel composition, engaging framing, sequential art quality, expressive character acting',
  comic_action: 'dynamic action lines, impact frames, speed lines, dramatic motion blur, kinetic energy',
  comic_expression: 'exaggerated comic expressions, clear readable emotions, dramatic facial acting',
  comic_background: 'detailed environment background, atmospheric perspective, immersive setting',
  
  // ===== 负向提示词（分层） =====
  // 基础层：通用画质问题
  negative_base: 'low quality, blurry, distorted, deformed, bad anatomy, watermark, text, logo, signature, jpeg artifacts, noise, grain, oversaturated, bad proportions, cropped',
  // 角色层：角色相关畸形
  negative_character: 'extra limbs, extra fingers, fused fingers, bad hands, mutated hands, missing limbs, disconnected limbs, ugly, poorly drawn face, bad teeth',
  // 风格层：风格污染
  negative_style: '3d render, photorealistic, photograph, realistic shading, real life, instagram filter, bad filters, instagram, snapchat',
  // 漫画层：漫画专属负面
  negative_comic: 'speech bubbles, panel borders, manga text, sound effects text, gridded layout, screentone overuse, printer artifacts',

  negative_default: 'low quality, blurry, distorted, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, jpeg artifacts, noise, grain, oversaturated',
} as const;

// ============================================================
// 镜头移动/动作库（用于视频生成）
// ============================================================
export const CAMERA_MOVEMENT = {
  static: 'locked-off camera, static shot, no camera movement',
  slow_pan_left: 'slow cinematic pan left, smooth camera movement',
  slow_pan_right: 'slow cinematic pan right, smooth camera movement',
  slow_push_in: 'gentle push-in dolly move, emotional reveal',
  slow_pull_out: 'slow pull-back reveal, dramatic scope expansion',
  handheld: 'subtle handheld motion, organic feel, documentary realism',
  steady_tracking: 'smooth steadicam tracking, follows character motion',
  crane_up: 'crane shot ascending, reveals the grand environment',
  arc_around: 'circular arc move around subject, dynamic 3d feel',
  subtle_breathing: 'subtle breathing-room only, micro-motion, still cinematic',
} as const;

// ============================================================
// 剧本结构模板（Three-Act Structure）
// ============================================================
export type DramaGenre = keyof typeof GENRE_TONES;

export const GENRE_TONES = {
  fantasy: 'high fantasy, magical, epic heroic adventure tone',
  romance: 'modern romance, emotional depth, sweet and heartfelt moments',
  scifi: 'sci-fi futuristic, high-tech cyberpunk, speculative fiction tone',
  mystery: 'suspense mystery, detective investigation, noir atmosphere',
  action: 'action-thriller, high stakes, dynamic pacing',
  horror: 'psychological horror, building dread, supernatural eerie tone',
  comedy: 'light comedy, witty dialogue, humor-driven',
  slice_of_life: 'slice-of-life, warm everyday moments, relatable',
  drama: 'pure drama, character-driven emotional storytelling',
} as const;

// ============================================================
// 工具函数：从数组中取一个随机元素（用于多样化）
// ============================================================
export function pickRandom<T>(arr: readonly T[], seed = 0): T {
  const idx = (seed > 0 ? seed : Math.floor(Math.random() * arr.length)) % arr.length;
  return arr[idx as number];
}

// 获取所有镜头角度的英文名称列表
export function getCameraAngleKeys(): string[] {
  return Object.keys(CAMERA_ANGLES);
}

// 根据中文提示词映射到专业镜头术语
export function inferCameraAngle(rawHint: string): keyof typeof CAMERA_ANGLES {
  const hint = (rawHint || '').toLowerCase();
  if (hint.includes('特写') || hint.includes('closeup') || hint.includes('close-up')) return 'close_up';
  if (hint.includes('近景')) return 'medium_close_up';
  if (hint.includes('中景')) return 'medium_shot';
  if (hint.includes('全景') || hint.includes('full')) return 'long_shot';
  if (hint.includes('远景') || hint.includes('wide')) return 'extreme_long_shot';
  if (hint.includes('仰') || hint.includes('low')) return 'low_angle';
  if (hint.includes('俯') || hint.includes('high')) return 'high_angle';
  if (hint.includes('俯视') || hint.includes('bird')) return 'birds_eye';
  if (hint.includes('过肩') || hint.includes('shoulder')) return 'over_shoulder';
  if (hint.includes('第一人称') || hint.includes('pov')) return 'pov_shot';
  if (hint.includes('双人') || hint.includes('two')) return 'two_shot';
  if (hint.includes('荷兰') || hint.includes('倾斜') || hint.includes('dutch')) return 'dutch_angle';
  if (hint.includes('POV') || hint.includes('视角')) return 'pov_shot';
  return 'medium_shot';
}

// 情绪关键词规范化
export function inferEmotion(rawEmotion: string | undefined): keyof typeof EMOTION_TONES {
  const e = (rawEmotion || '').toLowerCase();
  if (e.includes('浪漫') || e.includes('love') || e.includes('恋')) return 'romantic';
  if (e.includes('紧张') || e.includes('tense') || e.includes('惊险')) return 'tense';
  if (e.includes('神秘')) return 'mysterious';
  if (e.includes('史诗') || e.includes('epic') || e.includes('宏大')) return 'epic';
  if (e.includes('平静') || e.includes('peace') || e.includes('宁静')) return 'peaceful';
  if (e.includes('喜剧') || e.includes('funny') || e.includes('幽默')) return 'comedic';
  if (e.includes('忧郁') || e.includes('sad') || e.includes('忧伤')) return 'melancholy';
  if (e.includes('戏剧') || e.includes('dramatic')) return 'dramatic';
  if (e.includes('欢快') || e.includes('cheer') || e.includes('愉快')) return 'cheerful';
  if (e.includes('恐怖') || e.includes('horror') || e.includes('吓人')) return 'horror';
  if (e.includes('动作') || e.includes('action') || e.includes('打斗')) return 'action';
  if (e.includes('亲密') || e.includes('intimate')) return 'intimate';
  if (e.includes('沉思') || e.includes('thoughtful') || e.includes('思考')) return 'contemplative';
  if (e.includes('希望') || e.includes('hope')) return 'hopeful';
  if (e.includes('怀旧') || e.includes('nostalgic')) return 'nostalgic';
  if (e.includes('魔幻') || e.includes('magic') || e.includes('魔法')) return 'magical';
  if (e.includes('冷') || e.includes('cold')) return 'cold';
  if (e.includes('节日') || e.includes('festive') || e.includes('庆祝')) return 'festive';
  return 'peaceful';
}

// 艺术风格规范化
export function inferArtStyle(rawStyle: string | undefined): keyof typeof ART_STYLES {
  const s = (rawStyle || '').toLowerCase();
  if (s.includes('anime') || s.includes('动画') || s.includes('动漫') || s.includes('二次元')) return 'anime';
  if (s.includes('real') || s.includes('真实') || s.includes('照片')) return 'realistic';
  if (s.includes('photo') || s.includes('cinema')) return 'cinematic_photo';
  if (s.includes('comic') || s.includes('漫画') || s.includes('美漫')) return 'comic_book';
  if (s.includes('manga') || s.includes('黑白漫画') || s.includes('日漫')) return 'manga_bw';
  if (s.includes('pixar') || s.includes('3d') || s.includes('3D')) return 'pixar_3d';
  if (s.includes('watercolor') || s.includes('水彩')) return 'watercolor';
  if (s.includes('oil') || s.includes('油画')) return 'oil_painting';
  if (s.includes('cyber') || s.includes('赛博')) return 'cyberpunk';
  if (s.includes('fantasy') || s.includes('奇幻') || s.includes('魔幻')) return 'fantasy';
  if (s.includes('chibi') || s.includes('q版') || s.includes('可爱')) return 'chibi';
  if (s.includes('ghibli') || s.includes('吉卜力') || s.includes('宫崎骏')) return 'ghibli';
  if (s.includes('webtoon') || s.includes('manhwa') || s.includes('韩漫') || s.includes('条漫')) return 'webtoon';
  if (s.includes('vintage') || s.includes('复古')) return 'vintage';
  if (s.includes('disney') || s.includes('迪士尼')) return 'disney';
  if (s.includes('noir') || s.includes('黑色')) return 'noir';
  if (s.includes('cartoon') || s.includes('卡通')) return 'cartoon_2d';
  if (s.includes('lowpoly') || s.includes('low-poly') || s.includes('低多边形')) return 'low_poly';
  if (s.includes('ink') || s.includes('水墨') || s.includes('国画')) return 'ink_wash';
  return 'anime';
}

// 镜头角度规范化（从用户输入或剧情片段中推断）
export function getCameraAngleDescription(cameraHint: string | undefined): string {
  const key = inferCameraAngle(cameraHint || 'medium shot');
  return CAMERA_ANGLES[key];
}

// ============================================================
// UI 工具：获取镜头/情绪/风格的中文标签（用于下拉菜单）
// ============================================================

export const CAMERA_ANGLE_LABELS: Record<keyof typeof CAMERA_ANGLES, string> = {
  extreme_close_up: '大特写 (ECU)',
  close_up: '特写',
  medium_close_up: '近中景',
  medium_shot: '中景 (标准对话景别)',
  medium_long_shot: '中远景',
  long_shot: '全景',
  extreme_long_shot: '远景',
  over_shoulder: '过肩镜头 (OTS)',
  two_shot: '双人镜头',
  pov_shot: '第一人称视角 (POV)',
  low_angle: '低角度仰拍',
  high_angle: '高角度俯拍',
  birds_eye: '俯视鸟瞰',
  dutch_angle: '荷兰角 (倾斜镜头)',
  top_down: '正上方俯视',
  tracking_shot: '跟拍/移动镜头',
  wide_establishing: '广角定场镜',
};

export const EMOTION_LABELS: Record<keyof typeof EMOTION_TONES, string> = {
  romantic: '浪漫温馨',
  tense: '紧张压抑',
  mysterious: '神秘悬疑',
  epic: '史诗宏大',
  peaceful: '平静安宁',
  comedic: '轻松搞笑',
  melancholy: '忧郁深沉',
  dramatic: '戏剧性冲突',
  cheerful: '欢快愉悦',
  horror: '恐怖惊悚',
  action: '动作激烈',
  intimate: '亲密私密',
  contemplative: '沉思内省',
  hopeful: '充满希望',
  melancholic: '伤感低落',
  nostalgic: '怀旧复古',
  cold: '冷酷疏离',
  festive: '欢庆节日',
  magical: '魔幻奇幻',
};

export const ART_STYLE_LABELS: Record<keyof typeof ART_STYLES, string> = {
  anime: '日系动漫',
  realistic: '写实照片',
  cinematic_photo: '电影级摄影',
  comic_book: '美式漫画',
  manga_bw: '日式黑白漫画',
  pixar_3d: '皮克斯 3D',
  watercolor: '水彩画',
  oil_painting: '油画',
  cyberpunk: '赛博朋克',
  fantasy: '奇幻插画',
  chibi: 'Q版 / Chibi',
  ghibli: '吉卜力风格',
  webtoon: '韩漫条漫',
  vintage: '复古插画',
  disney: '迪士尼风格',
  noir: '黑色电影',
  cartoon_2d: '2D 卡通',
  low_poly: '低多边形',
  ink_wash: '中国水墨画',
};

// 反向查找：从存储的字符串（可能是 key 或中文描述）恢复成标准 key
export function normalizeCameraKey(raw: string | undefined | null): keyof typeof CAMERA_ANGLES {
  if (!raw) return 'medium_shot';
  // 如果是标准 key，直接返回
  if (raw in CAMERA_ANGLES) return raw as keyof typeof CAMERA_ANGLES;
  // 中文标签查找
  for (const [key, label] of Object.entries(CAMERA_ANGLE_LABELS)) {
    if (label === raw) return key as keyof typeof CAMERA_ANGLES;
  }
  // 回退到智能推断
  return inferCameraAngle(raw);
}

export function normalizeEmotionKey(raw: string | undefined | null): keyof typeof EMOTION_TONES {
  if (!raw) return 'peaceful';
  if (raw in EMOTION_TONES) return raw as keyof typeof EMOTION_TONES;
  for (const [key, label] of Object.entries(EMOTION_LABELS)) {
    if (label === raw) return key as keyof typeof EMOTION_TONES;
  }
  return inferEmotion(raw);
}

export function normalizeStyleKey(raw: string | undefined | null): keyof typeof ART_STYLES {
  if (!raw) return 'anime';
  if (raw in ART_STYLES) return raw as keyof typeof ART_STYLES;
  for (const [key, label] of Object.entries(ART_STYLE_LABELS)) {
    if (label === raw) return key as keyof typeof ART_STYLES;
  }
  return inferArtStyle(raw);
}

// ============================================================
// 剧本生成提示词（用于 LLM multi-pass 剧本生成）
// ============================================================
export const SCRIPT_PROMPTS = {
  outline_to_full: `你是一位专业的漫画/动画编剧。根据以下故事大纲创作一个完整的高质量漫剧剧本。

## 创作原则
1. **视觉优先**：每个场景都必须包含丰富的视觉描述（场景环境、天气、光线、时间）
2. **角色一致**：严格遵循角色设定（外貌、服装、性格），每个场景都必须体现角色的外貌特征
3. **镜头语言**：每个场景需明确指定：镜头角度、画面构图、情绪氛围
4. **三幕结构**：第一幕（铺垫）、第二幕（冲突升级）、第三幕（高潮+结尾）
5. **对白自然**：对白符合角色性格，简洁有力，避免冗长
6. **节奏紧凑**：平均每 10-20 秒一个场景，保持观众注意力

## 【核心约束】以下规则必须严格遵守，违反任意一条则剧本不合格：

### 1. 必须有"至暗时刻"（强制）
- 第二幕（Act 2）必须包含至少一场**真正的失败或危机**
- 失败必须是主角亲手造成的（技能不足/判断失误/资源匮乏），或被反派主动打压
- 不能是"大风把东西吹走"这种机械降神式的意外
- 失败场景的情绪必须是 tense / melancholy / dramatic，不能是轻松的

### 2. 反派必须主动制造障碍（强制）
- 如果有反派角色，反派不能只是旁观或说一句风凉话
- 反派必须在第二幕中**采取主动行动**（造谣/破坏/威胁/设局）来阻止主角
- 反派的行动必须有**具体行为描述**，不能只写"皱着眉头"这类被动反应

### 3. 转机必须有因果链（强制）
- 第三幕的任何转机（贵人相助/灵感爆发/绝地翻盘）必须有**前面埋下的伏笔**
- 救星出场前必须至少有一场戏暗示其存在（远远观察/派人打听等）
- 不能出现"突然出现一个陌生人帮忙"这种机械降神

### 4. 叙事弧线要完整（强制）
- 主角在剧本开头和结尾必须有**明显的变化/成长**
- 不能从头到尾性格完全一样就成功了
- 失败是成长的必要条件，不能绕过

### 5. 场次分配规则（强制）
- 总场次数 8-16 场
- Act 1（铺垫）至少 2 场
- Act 2（冲突+危机）至少 3 场，且最后一场必须是失败/危机
- Act 3（高潮+结局）至少 2 场
- 失败/挫折场景必须在 Act 2 中，且情绪标签不能是 comedic / cheerful / peaceful

### 6. 创业/商业类题材额外要求
- 主角的商业行为（卖什么、怎么卖、卖给谁）必须有清晰描述
- 遇到困难时的解决方案必须是**主角自己想出来的**，不是凭空出现
- 道具/材料来源要有交代（没钱怎么弄到的材料？）

## 输出格式要求（极其重要，务必严格遵守）
1. 输出**纯 JSON**，不要 markdown 代码块标记（不要 \`\`\`json 或 \`\`\`）
2. JSON 必须是合法的、可直接 JSON.parse() 的文本
3. 所有字符串字段使用双引号，最后一个字段后面不能有逗号
4. 不要有任何注释、说明文字、前后缀

## JSON 结构定义
{
  "title": "剧本标题（10字以内）",
  "logline": "一句话剧情梗概（不超过30字）",
  "genre": "题材类型",
  "world_style": "世界观英文关键词（2-5词）",
  "acts": [
    {
      "act_num": 1,
      "name": "第一幕：铺垫",
      "scenes": [
        {
          "scene_number": 1,
          "title": "场景标题",
          "location": "地点描述",
          "time_of_day": "morning或afternoon或evening或night",
          "weather": "天气英文关键词",
          "description": "详细视觉画面描述：环境+角色动作+表情+关键视觉元素，中文2-3句话，至少50字",
          "camera_angle": "medium_shot 或 close_up 或 long_shot 或 low_angle 或 over_shoulder 或 extreme_long_shot 或 two_shot 或 pov_shot 或 tracking_shot 或 high_angle",
          "emotion": "dramatic 或 peaceful 或 comedic 或 tense 或 mysterious 或 epic 或 melancholy 或 cheerful 或 hopeful 或 romantic 或 action 或 magical",
          "dialogue": "角色对白，格式：角色名：台词内容，如无对白则填空字符串",
          "visual_keywords": "英文视觉关键词，逗号分隔，5-10个词，用于图像生成",
          "characters_in_scene": ["角色名1", "角色名2"]
        }
      ]
    }
  ]
}

请输出 ONLY 合法 JSON，不要任何其他文字。`,
} as const;

// ============================================================
// 光影方案库（Lighting Schemes）—— 智能分镜核心
// 用户明确需求："光影效果等参数"
// ============================================================
export const LIGHTING_SCHEMES = {
  golden_hour: 'golden hour lighting, warm orange low-angle sunlight, long soft shadows, romantic warm glow',
  blue_hour: 'blue hour lighting, deep blue twilight sky, cool serene atmosphere, soft ambient light',
  backlit: 'dramatic backlit scene, strong rim light around subject, lens flare, silhouette potential',
  side_lighting: 'directional side lighting, strong chiaroscuro, half-lit half-shadowed, sculptural depth',
  top_light: 'overhead top lighting, theatrical stage feel, dramatic downward shadows, spotlight effect',
  hard_shadow: 'hard directional light, sharp crisp shadows, high contrast, intense dramatic mood',
  soft_box: 'soft diffused softbox lighting, even gentle illumination, flattering portrait light, minimal shadows',
  neon: 'neon lighting, vibrant magenta and cyan glow, rain-soaked reflections, cyberpunk atmosphere',
  moonlight: 'moonlight illumination, cool blue-silver tones, soft nocturnal glow, mysterious night mood',
  candlelight: 'warm flickering candlelight, golden amber glow, intimate cozy atmosphere, dancing shadows',
  rim_light: 'rim lighting, bright edge highlight separating subject from background, depth separation',
  volumetric: 'volumetric god rays, visible light shafts through atmosphere, tyndall effect, ethereal beams',
  split_lighting: 'split lighting, one half lit one half dark, inner conflict, duality, psychological tension',
  practical_light: 'practical light source, lamp or screen glow, realistic motivated lighting, diegetic illumination',
  high_key: 'high-key lighting, bright low-contrast, evenly lit, cheerful optimistic mood',
  low_key: 'low-key lighting, dark high-contrast, deep shadows, moody suspenseful noir atmosphere',
} as const;

export const LIGHTING_LABELS: Record<keyof typeof LIGHTING_SCHEMES, string> = {
  golden_hour: '黄金时刻',
  blue_hour: '蓝调时刻',
  backlit: '逆光轮廓',
  side_lighting: '侧光立体',
  top_light: '顶光舞台',
  hard_shadow: '硬阴影高对比',
  soft_box: '柔光均匀',
  neon: '霓虹赛博',
  moonlight: '月光冷蓝',
  candlelight: '烛光暖黄',
  rim_light: '边缘勾边',
  volumetric: '体积光束',
  split_lighting: '分割光冲突',
  practical_light: '实景光源',
  high_key: '高调明亮',
  low_key: '低调压抑',
};

// ============================================================
// 构图规则库（Composition Rules）
// ============================================================
export const COMPOSITION_RULES = {
  rule_of_thirds: 'rule of thirds composition, subject on intersection points, balanced dynamic framing',
  golden_ratio: 'golden ratio spiral composition, fibonacci curve flow, natural harmonic balance',
  leading_lines: 'leading lines composition, converging lines draw eye to subject, depth perspective',
  symmetry: 'symmetrical composition, mirrored balance, formal stable centered framing',
  framing: 'frame within frame composition, architectural or natural frame around subject, layered depth',
  diagonal: 'dynamic diagonal composition, tilted energy, sense of motion and tension',
  center: 'centered composition, subject dead center, authority and focus, monumental feel',
  negative_space: 'negative space composition, large empty area, minimalist emphasis on subject',
  foreground_layering: 'foreground layering composition, depth via overlapping elements, 3d spatial feel',
  triangle: 'triangular composition, three points of interest, stable yet dynamic pyramidal arrangement',
  dutch_tilt: 'dutch tilt composition, canted angle, unease and disorientation',
  close_up_fill: 'close-up fill the frame composition, subject dominates, intimate immersive detail',
} as const;

export const COMPOSITION_LABELS: Record<keyof typeof COMPOSITION_RULES, string> = {
  rule_of_thirds: '三分法',
  golden_ratio: '黄金螺旋',
  leading_lines: '引导线',
  symmetry: '对称构图',
  framing: '框架构图',
  diagonal: '对角线',
  center: '中心构图',
  negative_space: '负空间',
  foreground_layering: '前景层次',
  triangle: '三角构图',
  dutch_tilt: '倾斜构图',
  close_up_fill: '特写填充',
};

// ============================================================
// 色板库（Color Palettes）
// ============================================================
export const COLOR_PALETTES = {
  warm_amber: 'warm amber color palette, orange gold and brown tones, cozy autumnal warmth',
  cool_blue: 'cool blue color palette, icy cyan and navy tones, calm melancholic cold atmosphere',
  complementary: 'complementary color palette, blue-orange contrast, vibrant dynamic tension',
  monochrome: 'monochromatic color palette, single hue variations, unified elegant simplicity',
  cinematic_teal_orange: 'cinematic teal and orange palette, hollywood color grading, skin tones pop against teal shadows',
  pastel: 'soft pastel color palette, muted pink lavender and mint, dreamy gentle aesthetic',
  high_contrast_bw: 'high contrast black and white, stark monochrome, dramatic noir lighting',
  earth_tones: 'earth tones palette, terracotta olive and ochre, natural organic grounded feel',
  vivid_neon: 'vivid neon color palette, electric magenta cyan and yellow, energetic cyberpunk saturation',
  muted_vintage: 'muted vintage palette, faded sepia and dusty rose, nostalgic retro film look',
} as const;

// ============================================================
// 角色姿势/动作库（Character Pose & Action Library）
// ============================================================
export const CHARACTER_POSES = {
  standing_confident: 'standing confidently, straight posture, shoulders back, head held high',
  standing_timid: 'standing timidly, hunched shoulders, looking down, arms close to body',
  sitting_thoughtful: 'sitting thoughtfully, chin resting on hand, distant gaze, contemplative pose',
  sitting_relaxed: 'sitting relaxed, leaning back, casual posture, comfortable pose',
  walking_determined: 'walking with determination, purposeful stride, forward momentum, confident gait',
  walking_casual: 'casual walking, relaxed pace, hands in pockets, everyday stroll',
  running_action: 'running, dynamic action pose, mid-stride, motion blur, urgent movement',
  leaning: 'leaning against wall, casual cool pose, one shoulder against surface, relaxed arms',
  crouching_wary: 'crouching low, wary posture, ready to spring, cautious defensive stance',
  kneeling_vulnerable: 'kneeling down, vulnerable position, head lowered, submissive posture',
  arms_crossed: 'arms crossed, defensive or confident pose, closed body language, defiant stance',
  hands_on_hips: 'hands on hips, confident assertive pose, open body language, power stance',
  pointing_forward: 'pointing forward, directing attention, leading gesture, commanding pose',
  surprised_recoil: 'surprised recoil, leaning back, hands raised, shocked defensive reaction',
  triumphant_victory: 'triumphant victory pose, arms raised, looking up, celebrating success',
  crying_vulnerable: 'crying, wiping tears, vulnerable emotional moment, distressed pose',
  whispering_secret: 'whispering secret, hand cupped to mouth, conspiratorial lean, intimate gesture',
  reading_focused: 'reading or studying, focused attention, leaning over book, concentrated expression',
  carrying_burden: 'carrying heavy load, strained posture, struggling with weight, physical exertion',
  greeting_warm: 'greeting warmly, arm raised in wave, friendly open gesture, welcoming smile',
} as const;

export const CHARACTER_POSE_LABELS: Record<keyof typeof CHARACTER_POSES, string> = {
  standing_confident: '自信站立',
  standing_timid: '怯懦站立',
  sitting_thoughtful: '沉思坐姿',
  sitting_relaxed: '放松坐姿',
  walking_determined: '坚定行走',
  walking_casual: '悠闲走路',
  running_action: '奔跑动作',
  leaning: '倚靠',
  crouching_wary: '蹲伏警惕',
  kneeling_vulnerable: '跪地脆弱',
  arms_crossed: '抱胸',
  hands_on_hips: '叉腰',
  pointing_forward: '指向前方',
  surprised_recoil: '惊讶后退',
  triumphant_victory: '胜利姿态',
  crying_vulnerable: '哭泣脆弱',
  whispering_secret: '耳语秘密',
  reading_focused: '阅读专注',
  carrying_burden: '负重',
  greeting_warm: '温暖挥手',
};

export function inferCharacterPose(rawHint: string): keyof typeof CHARACTER_POSES {
  const h = (rawHint || '').toLowerCase();
  if (h.includes('自信') || h.includes('confident') || h.includes('站立')) return 'standing_confident';
  if (h.includes('怯') || h.includes('timid') || h.includes('羞涩')) return 'standing_timid';
  if (h.includes('沉思') || h.includes('thoughtful') || h.includes('思考')) return 'sitting_thoughtful';
  if (h.includes('放松') || h.includes('relaxed') || h.includes('悠闲')) return 'sitting_relaxed';
  if (h.includes('走') || h.includes('walk')) return 'walking_determined';
  if (h.includes('跑') || h.includes('run')) return 'running_action';
  if (h.includes('靠') || h.includes('lean')) return 'leaning';
  if (h.includes('蹲') || h.includes('crouch')) return 'crouching_wary';
  if (h.includes('跪') || h.includes('kneel')) return 'kneeling_vulnerable';
  if (h.includes('抱胸') || h.includes('arms crossed')) return 'arms_crossed';
  if (h.includes('叉腰') || h.includes('hands on hips')) return 'hands_on_hips';
  if (h.includes('指') || h.includes('point')) return 'pointing_forward';
  if (h.includes('惊讶') || h.includes('surprised')) return 'surprised_recoil';
  if (h.includes('胜利') || h.includes('triumph') || h.includes('victory')) return 'triumphant_victory';
  if (h.includes('哭') || h.includes('cry') || h.includes('泪')) return 'crying_vulnerable';
  if (h.includes('耳语') || h.includes('whisper') || h.includes('悄悄')) return 'whispering_secret';
  if (h.includes('读') || h.includes('read') || h.includes('看书')) return 'reading_focused';
  if (h.includes('负重') || h.includes('carry') || h.includes('搬')) return 'carrying_burden';
  if (h.includes('挥手') || h.includes('招手') || h.includes('wave') || h.includes('greet')) return 'greeting_warm';
  return 'standing_confident';
}

export function normalizePoseKey(raw: string | undefined | null): keyof typeof CHARACTER_POSES {
  if (!raw) return 'standing_confident';
  if (raw in CHARACTER_POSES) return raw as keyof typeof CHARACTER_POSES;
  for (const [key, label] of Object.entries(CHARACTER_POSE_LABELS)) {
    if (label === raw) return key as keyof typeof CHARACTER_POSES;
  }
  return inferCharacterPose(raw);
}

export const COLOR_PALETTE_LABELS: Record<keyof typeof COLOR_PALETTES, string> = {
  warm_amber: '暖橙调',
  cool_blue: '冷蓝调',
  complementary: '互补色',
  monochrome: '单色调',
  cinematic_teal_orange: '电影青橙',
  pastel: '柔和粉彩',
  high_contrast_bw: '高对比黑白',
  earth_tones: '大地色',
  vivid_neon: '鲜艳霓虹',
  muted_vintage: '复古低饱和',
};

// 镜头运动标签（补充现有 CAMERA_MOVEMENT 的中文标签）
export const CAMERA_MOVEMENT_LABELS: Record<keyof typeof CAMERA_MOVEMENT, string> = {
  static: '静止',
  slow_pan_left: '缓慢左摇',
  slow_pan_right: '缓慢右摇',
  slow_push_in: '缓慢推进',
  slow_pull_out: '缓慢拉远',
  handheld: '手持晃动',
  steady_tracking: '稳定跟拍',
  crane_up: '摇臂上升',
  arc_around: '环绕弧线',
  subtle_breathing: '微动呼吸',
};

// ============================================================
// 智能推断函数：从中文/英文提示映射到标准 key
// ============================================================
export function inferLighting(rawHint: string): keyof typeof LIGHTING_SCHEMES {
  const h = (rawHint || '').toLowerCase();
  if (h.includes('黄金') || h.includes('golden') || h.includes('夕阳')) return 'golden_hour';
  if (h.includes('蓝调') || h.includes('blue hour') || h.includes('黄昏')) return 'blue_hour';
  if (h.includes('逆光') || h.includes('backlit') || h.includes('轮廓光')) return 'backlit';
  if (h.includes('侧光') || h.includes('side')) return 'side_lighting';
  if (h.includes('顶光') || h.includes('top light')) return 'top_light';
  if (h.includes('硬阴影') || h.includes('hard shadow')) return 'hard_shadow';
  if (h.includes('柔光') || h.includes('soft')) return 'soft_box';
  if (h.includes('霓虹') || h.includes('neon')) return 'neon';
  if (h.includes('月光') || h.includes('moon')) return 'moonlight';
  if (h.includes('烛光') || h.includes('candle')) return 'candlelight';
  if (h.includes('边缘光') || h.includes('rim light')) return 'rim_light';
  if (h.includes('体积光') || h.includes('光束') || h.includes('volumetric') || h.includes('god ray')) return 'volumetric';
  if (h.includes('分割') || h.includes('split')) return 'split_lighting';
  if (h.includes('实景') || h.includes('practical')) return 'practical_light';
  if (h.includes('高调') || h.includes('high-key')) return 'high_key';
  if (h.includes('低调') || h.includes('low-key')) return 'low_key';
  return 'soft_box';
}

export function inferComposition(rawHint: string): keyof typeof COMPOSITION_RULES {
  const h = (rawHint || '').toLowerCase();
  if (h.includes('三分') || h.includes('thirds')) return 'rule_of_thirds';
  if (h.includes('黄金螺旋') || h.includes('golden ratio') || h.includes('斐波那契')) return 'golden_ratio';
  if (h.includes('引导线') || h.includes('leading')) return 'leading_lines';
  if (h.includes('对称') || h.includes('symmetr')) return 'symmetry';
  if (h.includes('框架') || h.includes('framing')) return 'framing';
  if (h.includes('对角') || h.includes('diagonal')) return 'diagonal';
  if (h.includes('中心') || h.includes('center')) return 'center';
  if (h.includes('负空间') || h.includes('negative')) return 'negative_space';
  if (h.includes('前景') || h.includes('foreground')) return 'foreground_layering';
  if (h.includes('三角') || h.includes('triangle')) return 'triangle';
  if (h.includes('倾斜') || h.includes('dutch')) return 'dutch_tilt';
  if (h.includes('特写填充') || h.includes('fill')) return 'close_up_fill';
  return 'rule_of_thirds';
}

export function inferColorPalette(rawHint: string): keyof typeof COLOR_PALETTES {
  const h = (rawHint || '').toLowerCase();
  if (h.includes('暖橙') || h.includes('amber')) return 'warm_amber';
  if (h.includes('冷蓝') || h.includes('cool blue')) return 'cool_blue';
  if (h.includes('互补') || h.includes('complementary')) return 'complementary';
  if (h.includes('单色') || h.includes('monochrome')) return 'monochrome';
  if (h.includes('青橙') || h.includes('teal') || h.includes('电影')) return 'cinematic_teal_orange';
  if (h.includes('粉彩') || h.includes('pastel')) return 'pastel';
  if (h.includes('黑白') || h.includes('black and white')) return 'high_contrast_bw';
  if (h.includes('大地') || h.includes('earth')) return 'earth_tones';
  if (h.includes('霓虹') || h.includes('neon') || h.includes('vivid')) return 'vivid_neon';
  if (h.includes('复古') || h.includes('vintage') || h.includes('muted')) return 'muted_vintage';
  return 'cinematic_teal_orange';
}

export function inferCameraMovement(rawHint: string): keyof typeof CAMERA_MOVEMENT {
  const h = (rawHint || '').toLowerCase();
  if (h.includes('静止') || h.includes('static') || h.includes('固定')) return 'static';
  if (h.includes('左摇') || h.includes('pan left')) return 'slow_pan_left';
  if (h.includes('右摇') || h.includes('pan right')) return 'slow_pan_right';
  if (h.includes('推进') || h.includes('push in') || h.includes('zoom in')) return 'slow_push_in';
  if (h.includes('拉远') || h.includes('pull out') || h.includes('zoom out')) return 'slow_pull_out';
  if (h.includes('手持') || h.includes('handheld')) return 'handheld';
  if (h.includes('跟拍') || h.includes('tracking') || h.includes('steadicam')) return 'steady_tracking';
  if (h.includes('摇臂') || h.includes('crane') || h.includes('上升')) return 'crane_up';
  if (h.includes('环绕') || h.includes('arc')) return 'arc_around';
  if (h.includes('微动') || h.includes('breathing')) return 'subtle_breathing';
  return 'static';
}

// normalize 函数（从存储值恢复标准 key）
export function normalizeLightingKey(raw: string | undefined | null): keyof typeof LIGHTING_SCHEMES {
  if (!raw) return 'soft_box';
  if (raw in LIGHTING_SCHEMES) return raw as keyof typeof LIGHTING_SCHEMES;
  for (const [key, label] of Object.entries(LIGHTING_LABELS)) {
    if (label === raw) return key as keyof typeof LIGHTING_SCHEMES;
  }
  return inferLighting(raw);
}

export function normalizeCompositionKey(raw: string | undefined | null): keyof typeof COMPOSITION_RULES {
  if (!raw) return 'rule_of_thirds';
  if (raw in COMPOSITION_RULES) return raw as keyof typeof COMPOSITION_RULES;
  for (const [key, label] of Object.entries(COMPOSITION_LABELS)) {
    if (label === raw) return key as keyof typeof COMPOSITION_RULES;
  }
  return inferComposition(raw);
}

export function normalizeColorPaletteKey(raw: string | undefined | null): keyof typeof COLOR_PALETTES {
  if (!raw) return 'cinematic_teal_orange';
  if (raw in COLOR_PALETTES) return raw as keyof typeof COLOR_PALETTES;
  for (const [key, label] of Object.entries(COLOR_PALETTE_LABELS)) {
    if (label === raw) return key as keyof typeof COLOR_PALETTES;
  }
  return inferColorPalette(raw);
}

export function normalizeCameraMovementKey(raw: string | undefined | null): keyof typeof CAMERA_MOVEMENT {
  if (!raw) return 'static';
  if (raw in CAMERA_MOVEMENT) return raw as keyof typeof CAMERA_MOVEMENT;
  for (const [key, label] of Object.entries(CAMERA_MOVEMENT_LABELS)) {
    if (label === raw) return key as keyof typeof CAMERA_MOVEMENT;
  }
  return inferCameraMovement(raw);
}
