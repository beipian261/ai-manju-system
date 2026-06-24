import {
  ART_STYLES,
  CAMERA_ANGLES,
  EMOTION_TONES,
  QUALITY_TAGS,
  CHARACTER_POSES,
  LIGHTING_SCHEMES,
  COMPOSITION_RULES,
  COLOR_PALETTES,
  CAMERA_MOVEMENT,
  inferArtStyle,
  inferCameraAngle,
  inferEmotion,
  inferCharacterPose,
  inferLighting,
  inferComposition,
  inferColorPalette,
  inferCameraMovement,
} from './prompt-library';

const MAX_PROMPT_LENGTH = 2500;

// ============================================================
// Character Sheet（角色卡）- 标准化角色描述结构
// 参考业界：AI Comic Factory / IP-Adapter Reference Image 技术
// ============================================================
export interface CharacterSheet {
  name: string;
  age: string;
  gender: string;
  // 核心外貌特征（一致性的关键 - 每次都必须包含）
  face: string;       // 脸型/面部特征
  hair: string;       // 发色/发型/发质
  eyes: string;       // 眼睛颜色/形状/神态
  skin: string;       // 肤色/皮肤质感
  body: string;       // 体型/身高/身材
  // 标志性特征（必须在每个画面中保持一致）
  signature_look: string;  // 招牌外观（如：戴黑框眼镜、有刘海遮住左眼）
  // 服装（保持一致）
  outfit_main: string;     // 主服装
  outfit_accessories: string;  // 配饰
  // 性格和表情
  personality: string;
  expressions: string;  // 表情动作
  // 参考图（用于 IP-Adapter / Character Reference Injection）
  referenceImages: string[];
  // 整体英文描述（给图像模型用）
  englishDescription: string;
}

// ============================================================
// 将一个角色（含详细信息）转换为标准 Character Sheet
// 输出英文，因为图像模型对英文提示词效果更好
// ============================================================
export function buildCharacterSheet(character: {
  name: string;
  age?: string | null;
  gender?: string | null;
  personality?: string | null;
  clothing?: string | null;
  appearance?: string | null;
  hair?: string | null;
  eyes?: string | null;
  build?: string | null;
  expressions?: string | null;
  signaturePose?: string | null;
  referenceImg?: string | null;
  dnaSummary?: string | null;  // AI 提取的 DNA 摘要（优先使用）
}): CharacterSheet {
  // 性别和年龄
  const gender = character.gender || 'female';
  const age = character.age || 'young adult';
  
  // 将中文年龄描述转换为英文
  const ageToEnglish = (ageStr: string): string => {
    const ageNum = parseInt(ageStr);
    if (!isNaN(ageNum)) {
      if (ageNum < 18) return `around ${ageNum} years old, youthful`;
      if (ageNum < 25) return `${ageNum} years old, young adult`;
      if (ageNum < 35) return `${ageNum} years old, mature adult`;
      if (ageNum < 50) return `${ageNum} years old, middle-aged`;
      return `${ageNum} years old, senior`;
    }
    // 处理中文描述
    if (ageStr.includes('少年') || ageStr.includes('少女')) return 'teenager, youthful, fresh-faced';
    if (ageStr.includes('青年')) return 'young adult, early twenties';
    if (ageStr.includes('中年')) return 'middle-aged, mature';
    if (ageStr.includes('老年')) return 'elderly, aged';
    return 'adult';
  };

  const ageDesc = ageToEnglish(age);

  // 面部特征
  const face = character.appearance 
    ? character.appearance 
    : `beautiful ${gender === 'male' ? 'handsome' : 'elegant'} face, smooth skin, symmetrical features, confident expression`;

  // 发型发色 - 翻译中文到英文
  const translateHair = (hairStr: string | null | undefined): string => {
    if (!hairStr) return 'shoulder-length stylish hair, natural look';
    const str = hairStr.toLowerCase();
    let result = hairStr; // 保留原始描述
    
    // 颜色
    if (str.includes('黑') || str.includes('乌黑')) result += ', black hair';
    else if (str.includes('白') || str.includes('银')) result += ', silver white hair';
    else if (str.includes('金') || str.includes('黄')) result += ', golden blonde hair';
    else if (str.includes('红') || str.includes('棕') || str.includes('褐')) result += ', brown hair';
    else if (str.includes('蓝')) result += ', blue hair';
    else if (str.includes('绿')) result += ', green hair';
    else if (str.includes('粉')) result += ', pink hair';
    
    // 长度
    if (str.includes('短发') || str.includes('寸头')) result += ', short hair';
    else if (str.includes('长发') || str.includes('长')) result += ', long flowing hair';
    else if (str.includes('中发') || str.includes('中等')) result += ', medium length hair';
    else if (str.includes('马尾')) result += ', ponytail hairstyle';
    else if (str.includes('辫子')) result += ', braided hair';
    else if (str.includes('卷') || str.includes('波浪')) result += ', wavy hair';
    
    return result;
  };
  const hair = translateHair(character.hair);

  // 眼睛
  const translateEyes = (eyesStr: string | null | undefined): string => {
    if (!eyesStr) return 'expressive detailed eyes, clear bright gaze';
    const str = eyesStr.toLowerCase();
    let result = eyesStr;
    
    // 颜色
    if (str.includes('黑')) result += ', dark eyes';
    else if (str.includes('蓝')) result += ', blue eyes';
    else if (str.includes('绿')) result += ', green eyes';
    else if (str.includes('紫')) result += ', purple eyes';
    else if (str.includes('红')) result += ', red eyes';
    else if (str.includes('金') || str.includes('琥珀')) result += ', amber/golden eyes';
    else if (str.includes('棕') || str.includes('褐')) result += ', brown eyes';
    
    // 形状
    if (str.includes('大') || str.includes('圆')) result += ', large round eyes';
    else if (str.includes('狭长') || str.includes('凤眼')) result += ', sharp almond-shaped eyes';
    else if (str.includes('杏眼')) result += ', beautiful almond eyes';
    
    if (!str.includes('detailed') && !str.includes('express')) {
      result += ', detailed eye texture, expressive';
    }
    
    return result;
  };
  const eyes = translateEyes(character.eyes);

  const skin = 'smooth realistic skin texture, healthy glow';
  
  // 体型
  const translateBuild = (buildStr: string | null | undefined): string => {
    if (!buildStr) return 'natural athletic build, good posture';
    const str = buildStr.toLowerCase();
    let result = buildStr;
    
    if (str.includes('高') || str.includes('修长')) result += ', tall slender figure';
    else if (str.includes('矮') || str.includes('娇小')) result += ', petite small frame';
    else if (str.includes('壮') || str.includes('肌肉')) result += ', muscular athletic build';
    else if (str.includes('胖') || str.includes('丰')) result += ', curvy full figure';
    
    return result;
  };
  const body = translateBuild(character.build);

  // 服装
  const translateClothing = (clothesStr: string | null | undefined): string => {
    if (!clothesStr) return 'stylish casual outfit, well-coordinated colors';
    const str = clothesStr.toLowerCase();
    let result = clothesStr;
    
    // 风格
    if (str.includes('西') || str.includes('正装')) result += ', formal business attire';
    else if (str.includes('古') || str.includes('传统')) result += ', traditional costume';
    else if (str.includes('运动')) result += ', athletic sportswear';
    else if (str.includes('校服')) result += ', school uniform';
    else if (str.includes('和服')) result += ', elegant kimono';
    else if (str.includes('汉服')) result += ', traditional hanfu';
    else if (str.includes('休闲')) result += ', casual comfortable outfit';
    else if (str.includes('制服')) result += ', uniform';
    
    // 颜色
    if (str.includes('黑') && !str.includes('白')) result += ', black outfit';
    else if (str.includes('白')) result += ', white clothing';
    else if (str.includes('红')) result += ', red accents';
    else if (str.includes('蓝')) result += ', blue tones';
    
    return result;
  };
  const outfit_main = translateClothing(character.clothing);
  const outfit_accessories = character.clothing && character.clothing.length > 30
    ? character.clothing.slice(30, 120)
    : 'tasteful accessories, attention to detail';

  // 表情动作
  const expressions = character.expressions 
    ? `expressions: ${character.expressions}` 
    : 'expressions: calm and composed, subtle smile, confident posture';
  
  // 标志动作
  const signaturePose = character.signaturePose 
    ? `signature pose: ${character.signaturePose}` 
    : '';

  const personality = character.personality 
    ? `personality: ${character.personality}` 
    : 'personality: confident, charismatic, memorable presence';

  const referenceImages: string[] = [];
  if (character.referenceImg && typeof character.referenceImg === 'string') {
    referenceImages.push(character.referenceImg);
  }

  // 构建完整的英文描述，优先使用 DNA 摘要
  const englishDescription = character.dnaSummary
    ? `[DNA] ${character.dnaSummary}`
    : [
        character.name,
        gender,
        ageDesc,
        face,
        hair,
        eyes,
        body,
        `wearing ${outfit_main}`,
        outfit_accessories,
        expressions,
        signaturePose,
        personality,
      ]
        .filter(Boolean)
        .join('. ');

  return {
    name: character.name,
    age: ageDesc,
    gender,
    face,
    hair,
    eyes,
    skin,
    body,
    signature_look: signaturePose,
    outfit_main,
    outfit_accessories,
    personality,
    expressions,
    englishDescription,
    referenceImages,
  };
}

// ============================================================
// 构建用于 IP-Adapter Reference Image 的角色描述（图像模型专用）
// 强制包含：角色外貌 + 服装 + 质量关键词
// ============================================================
export function buildCharacterReferencePrompt(
  sheet: CharacterSheet,
  styleKey: keyof typeof ART_STYLES = 'anime'
): string {
  const style = ART_STYLES[styleKey];
  const parts: string[] = [];

  parts.push(`[CHARACTER CONSISTENCY - CRITICAL: THESE FEATURES MUST MATCH EXACTLY IN EVERY IMAGE]`);
  parts.push(`character name: ${sheet.name}`);
  parts.push(`demographics: ${sheet.gender}, age ${sheet.age}`);
  parts.push(`face features: ${sheet.face}`);
  parts.push(`hair: ${sheet.hair}`);
  parts.push(`eyes: ${sheet.eyes}`);
  parts.push(`skin: ${sheet.skin}`);
  parts.push(`body: ${sheet.body}`);
  if (sheet.signature_look && sheet.signature_look.length > 10) {
    parts.push(`signature recognizable details: ${sheet.signature_look}`);
  }
  parts.push(`outfit: ${sheet.outfit_main}`);
  if (sheet.outfit_accessories) {
    parts.push(`accessories: ${sheet.outfit_accessories}`);
  }

  // 风格与质量
  parts.push(`art style: ${style}`);
  parts.push(QUALITY_TAGS.base);
  parts.push(QUALITY_TAGS.face);
  parts.push(QUALITY_TAGS.composition);
  parts.push(QUALITY_TAGS.lighting);
  parts.push(QUALITY_TAGS.color);

  const result = parts.join('. ');
  if (result.length > MAX_PROMPT_LENGTH) {
    return result.slice(0, MAX_PROMPT_LENGTH);
  }
  return result;
}

// ============================================================
// 构建角色参考图像（用于角色首次展示/Character Sheet 展示
// 这些图像会被用作后续场景的参考（IP-Adapter Reference）
// ============================================================
export interface CharacterRefItem {
  prompt: string;
  image?: string | null;
  characterSheet?: CharacterSheet;
}

// ============================================================
// 构建完整分镜图片提示词（综合：角色 + 场景 + 镜头 + 情绪 + 风格）
// 参考业界：AI Comic Factory 的组合式提示词构建
// ============================================================
export interface EnrichImagePromptInput {
  sceneDescription: string;       // 场景画面描述（中文或英文）
  characterSheets: CharacterSheet[];  // 参与这个场景的角色（0-多个）
  styleKey: keyof typeof ART_STYLES;  // 艺术风格
  cameraAngleHint?: string;       // 用户指定的镜头提示
  emotionHint?: string;           // 情绪氛围提示
  dialogueSubtitle?: string;      // 字幕（可选，用于合成）
  visualKeywords?: string;        // 额外视觉关键词（英文）
  // ===== 新字段：从剧本分镜直接传入 =====
  lightingHint?: string;          // 光影方案 key
  compositionHint?: string;       // 构图规则 key
  colorPaletteHint?: string;      // 色板 key
  cameraMovementHint?: string;    // 镜头运动 key
}

export function enrichImagePrompt(input: EnrichImagePromptInput): string {
  const {
    sceneDescription,
    characterSheets,
    styleKey,
    cameraAngleHint,
    emotionHint,
    visualKeywords,
    lightingHint,
    compositionHint,
    colorPaletteHint,
    cameraMovementHint,
  } = input;

  const parts: string[] = [];

  // ===== 1) 镜头指令（放在最前 = 最高优先级，控制构图框架）=====
  const camKey = inferCameraAngle(cameraAngleHint || 'medium shot');
  parts.push(`[FRAMING] ${CAMERA_ANGLES[camKey as keyof typeof CAMERA_ANGLES]}`);

  // ===== 2) 场景核心描述 =====
  const safeScene = (sceneDescription || '').slice(0, 500);
  if (safeScene) {
    parts.push(`[SCENE] ${safeScene}`);
  }

  // ===== 3) 角色一致性 + 姿势注入 =====
  if (characterSheets.length > 0) {
    parts.push(`[CONSISTENCY] CRITICAL: All characters must have EXACT same face, hair, eyes, outfit across all images.`);
    
    characterSheets.forEach((sheet, i) => {
      const charLines: string[] = [];
      charLines.push(`[CHARACTER ${i + 1}: ${sheet.name}]`);
      
      // 如果有 DNA 摘要，直接使用精简 DNA（更精确、占 token 更少）
      if (sheet.englishDescription.startsWith('[DNA]')) {
        charLines.push(`dna=${sheet.englishDescription.replace('[DNA] ', '')}`);
      } else {
        charLines.push(`face=${sheet.face}, hair=${sheet.hair}, eyes=${sheet.eyes}`);
        charLines.push(`outfit=${sheet.outfit_main}`);
      }
      
      if (sheet.signature_look && sheet.signature_look.length > 5) {
        charLines.push(`signature=${sheet.signature_look}`);
      }
      // 姿势推断：从场景描述中推断角色姿势
      const detectedPose = inferCharacterPose(safeScene);
      if (detectedPose !== 'standing_confident') {
        charLines.push(`pose=${CHARACTER_POSES[detectedPose]}`);
      }
      parts.push(charLines.join('. '));
    });
  }

  // ===== 4) 视觉关键词（氛围、道具、天气等）=====
  if (visualKeywords) {
    parts.push(`[ATMOSPHERE] ${visualKeywords.slice(0, 200)}`);
  }

  // ===== 5) 光影方案（从剧本分镜传入）=====
  if (lightingHint) {
    const lightKey = inferLighting(lightingHint);
    parts.push(`[LIGHTING] ${LIGHTING_SCHEMES[lightKey as keyof typeof LIGHTING_SCHEMES]}`);
  }

  // ===== 6) 构图规则（从剧本分镜传入）=====
  if (compositionHint) {
    const compKey = inferComposition(compositionHint);
    parts.push(`[COMPOSITION] ${COMPOSITION_RULES[compKey as keyof typeof COMPOSITION_RULES]}`);
  }

  // ===== 7) 色板（从剧本分镜传入）=====
  if (colorPaletteHint) {
    const colorKey = inferColorPalette(colorPaletteHint);
    parts.push(`[COLOR] ${COLOR_PALETTES[colorKey as keyof typeof COLOR_PALETTES]}`);
  }

  // ===== 8) 情绪氛围 =====
  if (emotionHint) {
    const emoKey = inferEmotion(emotionHint);
    parts.push(`[MOOD] ${EMOTION_TONES[emoKey as keyof typeof EMOTION_TONES]}`);
  }

  // ===== 9) 艺术风格 =====
  const artKey = inferArtStyle(styleKey as string);
  parts.push(`[STYLE] ${ART_STYLES[artKey as keyof typeof ART_STYLES]}`);

  // ===== 10) 质量标签 =====
  parts.push(QUALITY_TAGS.base);
  parts.push(QUALITY_TAGS.face);
  parts.push(QUALITY_TAGS.composition);
  parts.push(QUALITY_TAGS.lighting);
  parts.push(QUALITY_TAGS.color);
  
  // 漫画风格额外加漫画标签
  if (artKey === 'comic_book' || artKey === 'webtoon' || artKey === 'manga_bw') {
    parts.push(QUALITY_TAGS.comic_art);
    parts.push(QUALITY_TAGS.comic_action);
  }

  let result = parts.join('. ');
  if (result.length > MAX_PROMPT_LENGTH) {
    result = result.slice(0, MAX_PROMPT_LENGTH);
  }
  return result;
}

// ============================================================
// 兼容旧 API：buildCharacterPrompt
// 旧签名：(character) => string
// 作用：生成单行英文角色描述，主要用于提示词拼装
// ============================================================
export function buildCharacterPrompt(character: {
  name: string;
  age?: string | null;
  gender?: string | null;
  personality?: string | null;
  clothing?: string | null;
  appearance?: string | null;
  hair?: string | null;
  eyes?: string | null;
  build?: string | null;
  referenceImg?: string | null;
}): string {
  const sheet = buildCharacterSheet(character);
  return sheet.englishDescription;
}

// ============================================================
// 提取角色参考图
// ============================================================
export function extractCharacterImages(
  characters: Array<{ referenceImg?: string | null }>
): string[] {
  return characters
    .map((c) => c.referenceImg)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
}

// ============================================================
// 剧本生成中使用的角色一致性指令（给 LLM 用）
// 确保每个场景都保持角色的特征描述
// ============================================================
export function buildCharacterConsistencyInstructions(
  characters: Array<{
    name: string;
    age?: string | null;
    gender?: string | null;
    appearance?: string | null;
    hair?: string | null;
    eyes?: string | null;
    clothing?: string | null;
  }>
): string {
  if (characters.length === 0) return '';

  const lines = characters.map((c) => {
    const parts = [c.name];
    if (c.gender) parts.push(c.gender);
    if (c.age) parts.push(`${c.age}岁`);
    if (c.appearance) parts.push(`外貌：${c.appearance}`);
    if (c.hair) parts.push(`发型：${c.hair}`);
    if (c.eyes) parts.push(`眼睛：${c.eyes}`);
    if (c.clothing) parts.push(`服装：${c.clothing}`);
    return `- ${parts.join('，')}`;
  });

  return `【角色设定（必须在整个剧本中严格保持一致）】\n${lines.join('\n')}`;
}

// ============================================================
// 负向提示词（Negative Prompt）
// 分层策略：基础层 + 角色层 + 风格层，根据生成类型动态组合
// ============================================================
export function buildNegativePrompt(options?: { 
  style?: string;
  isComic?: boolean; 
}): string {
  const opts = options || {};
  const parts: string[] = [];
  
  // 必选：基础画质层
  parts.push(QUALITY_TAGS.negative_base);
  
  // 必选：角色畸形层
  parts.push(QUALITY_TAGS.negative_character);
  
  // 动漫风格：添加 3D/写实污染
  if (!opts.style || opts.style === 'anime' || opts.style === 'manga_bw') {
    parts.push(QUALITY_TAGS.negative_style);
  }
  
  // 漫画模式：添加漫画专属负向
  if (opts.isComic) {
    parts.push(QUALITY_TAGS.negative_comic);
  }
  
  return parts.join(', ');
}

// ============================================================
// 获取 Character Sheet 的展示用 prompt（用于生成角色定妆照）
// ============================================================
export function buildCharacterPortraitPrompt(
  sheet: CharacterSheet,
  styleKey: keyof typeof ART_STYLES = 'anime'
): string {
  const parts: string[] = [];
  
  // 构图和视角
  parts.push('character portrait, centered composition');
  parts.push('clean minimal background, soft gradient backdrop');
  parts.push('medium shot, upper body visible');
  
  // 角色描述（核心）
  parts.push(sheet.englishDescription);
  
  // 艺术风格
  parts.push(`art style: ${ART_STYLES[styleKey]}`);
  
  // 高质量细节标签
  parts.push('masterpiece, best quality, ultra detailed, 8k, HDR');
  parts.push('beautiful detailed eyes with reflections');
  parts.push('detailed facial features, perfect face symmetry');
  parts.push('expressive face, subtle emotions, professional pose');
  parts.push('detailed hair strands, natural hair flow');
  
  // 光影和氛围
  parts.push('soft cinematic lighting, rim light highlights');
  parts.push('volumetric lighting, natural shadows');
  parts.push('professional studio lighting setup');
  
  // 色彩和质感
  parts.push('vibrant yet natural colors');
  parts.push('beautiful color harmony');
  parts.push('rich texture detail, realistic skin texture');
  
  // 构图
  parts.push('professional photography composition');
  parts.push('rule of thirds, perfect framing');

  let result = parts.join('. ');
  if (result.length > MAX_PROMPT_LENGTH) {
    result = result.slice(0, MAX_PROMPT_LENGTH);
  }
  return result;
}
