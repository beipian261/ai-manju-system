import prisma from './prisma-client';
import crypto from 'crypto';
import { generateImage as agnesGenerateImage } from './agnes-client';
import { getSetting } from './settings';
import { updateProjectStatus } from './project-status';
import {
  extractCharacterImages,
  buildCharacterSheet,
  enrichImagePrompt,
  buildNegativePrompt,
  CharacterSheet,
} from './character-prompt';
import {
  normalizeCameraKey,
  normalizeEmotionKey,
  normalizeStyleKey,
} from './prompt-library';
import { evaluateImage } from './image-eval';
import { isSafeExternalUrl } from './url-guard';

// ============================================================
// 图片生成缓存：基于 prompt 哈希极速命中已生成的图片
// ============================================================

// SHA-256 哈希（碰撞概率在实际场景中为零）
function buildCacheKey(prompt: string, artStyle: string, size: string): string {
  return crypto.createHash('sha256')
    .update(`${prompt}|${artStyle}|${size}`)
    .digest('hex')
    .slice(0, 32); // 128-bit 输出，足以避免碰撞
}

async function getCachedImageUrl(cacheKey: string): Promise<string | null> {
  try {
    const cached = await prisma.imageCache.findUnique({ where: { promptHash: cacheKey } });
    if (cached && cached.imageUrl && isSafeExternalUrl(cached.imageUrl)) {
      console.log(`[cache HIT] key=${cacheKey.slice(0, 8)}...`);
      return cached.imageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveToCache(cacheKey: string, prompt: string, imageUrl: string, artStyle: string, score: number, model: string) {
  try {
    await prisma.imageCache.upsert({
      where: { promptHash: cacheKey },
      create: {
        promptHash: cacheKey,
        prompt: prompt.slice(0, 5000),
        imageUrl,
        artStyle,
        score,
        model,
      },
      update: {
        imageUrl,
        score,
        prompt: prompt.slice(0, 5000),
      },
    });
    console.log(`[cache SAVE] key=${cacheKey.slice(0, 8)}...`);
  } catch (e) {
    console.warn('[cache] save failed:', e);
  }
}

const ALLOWED_SIZES = ['512x512', '768x768', '1024x1024', '1024x1792', '1792x1024'];
const DEFAULT_THRESHOLD = 65; // 画面质量门槛（更严格了）
const DEFAULT_MAX_RETRIES = 1; // 默认最多重试 1 次（原来是 4），大幅减少等待时间

// 只保留合法的 HTTPS 参考图 URL
function sanitizeRefUrls(urls: string[]): string[] {
  return urls.filter((u) => {
    if (!u || typeof u !== 'string') return false;
    if (u.startsWith('data:image/')) return true;
    return isSafeExternalUrl(u);
  });
}

export interface GenerateImageOptions {
  storyboardId: string;
  prompt: string;
  size?: string;
  n?: number;
  characterRefs?: string[];
  // 增强型参数（来自 storyboard POST 的结构化输入）
  sceneDescription?: string;
  cameraAngle?: string;
  emotion?: string;
  visualKeywords?: string;
  artStyle?: string;
}

export interface GenerateImageResult {
  imageUrl: string;
  score: number | null;
  attempts: number;
  usedCharacterRefs: number;
  usedCache?: boolean; // 是否命中缓存
  dnaLockedChars?: number; // DNA 锁定角色数
}

// ============================================================
// 主函数：生成分镜图片
// 升级点：
//   1) 使用 Character Sheet 标准化角色描述
//   2) IP-Adapter 风格锁（通过 character_ref 注入参考图）
//   3) 完整 professional quality tag 拼接
//   4) Negative prompt（去噪）
//   5) Multi-pass evaluation + auto-retry
// ============================================================
export async function generateStoryboardImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const {
    storyboardId,
    prompt,
    size: inputSize,
    n: inputN,
    characterRefs: inputRefs,
    sceneDescription,
    cameraAngle,
    emotion,
    visualKeywords,
    artStyle,
  } = options;

  const size = inputSize && ALLOWED_SIZES.includes(inputSize) ? inputSize : '1024x1024';
  const n = typeof inputN === 'number' && inputN > 0 && inputN <= 4 ? inputN : 1;

  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
    include: { script: true },
  });
  if (!storyboard) {
    throw new Error('Storyboard not found');
  }

  // ========== 角色一致性控制 ==========
  // 1. 参考图 URL（用于 IP-Adapter / character reference injection）
  let characterRefUrls: string[] = Array.isArray(inputRefs)
    ? inputRefs.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 10)
    : [];

  // 2. Character Sheet（用于 prompt 文本注入）
  let characterSheets: CharacterSheet[] = [];
  let dnaLockedCount = 0;
  try {
    const projectCharacters = await prisma.character.findMany({
      where: { projectId: storyboard.script.projectId },
      include: { assets: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
    });

    characterSheets = projectCharacters.map((c) =>
      buildCharacterSheet({
        name: c.name,
        age: c.age,
        gender: c.gender,
        personality: c.personality,
        clothing: c.clothing,
        appearance: c.appearance,
        hair: c.hair,
        eyes: c.eyes,
        build: c.build,
        referenceImg: c.referenceImg,
        dnaSummary: c.dnaSummary,
      })
    );

    // ========== 角色 DNA 注入 ==========
    // DNA 锁定的角色：强制注入所有参考图 + DNA 摘要
    // 未锁定的角色：使用传统 referenceImg
    const dnaRefUrls: string[] = [];
    for (const c of projectCharacters) {
      if (c.dnaLocked && c.assets.length > 0) {
        // DNA 锁定：注入所有参考图
        for (const asset of c.assets) {
          if (asset.url) dnaRefUrls.push(asset.url);
        }
        dnaLockedCount++;

        // 如果有 DNA 摘要，追加到角色描述
        if (c.dnaSummary) {
          const sheetIdx = characterSheets.findIndex((s) => s.name === c.name);
          if (sheetIdx >= 0) {
            characterSheets[sheetIdx] = {
              ...characterSheets[sheetIdx],
              englishDescription: `${characterSheets[sheetIdx].englishDescription}. [DNA LOCKED] ${c.dnaSummary}`,
            };
          }
        }
      }
    }

    if (dnaRefUrls.length > 0) {
      // DNA 参考图优先
      characterRefUrls = sanitizeRefUrls([...dnaRefUrls, ...characterRefUrls]);
    } else if (characterRefUrls.length === 0) {
      characterRefUrls = sanitizeRefUrls(extractCharacterImages(projectCharacters));
    } else {
      characterRefUrls = sanitizeRefUrls(characterRefUrls);
    }
  } catch {
    // 角色信息获取失败时跳过，不阻断整体流程
  }

  // ========== settings ==========
  let threshold = DEFAULT_THRESHOLD;
  let maxRetries = DEFAULT_MAX_RETRIES;
  try {
    const thresholdRaw = await getSetting('IMAGE_EVAL_THRESHOLD');
    threshold = Math.max(0, Math.min(100, parseInt(thresholdRaw, 10) || DEFAULT_THRESHOLD));
    const retriesRaw = await getSetting('IMAGE_MAX_RETRIES');
    maxRetries = Math.max(0, Math.min(10, parseInt(retriesRaw, 10) || DEFAULT_MAX_RETRIES));
  } catch {
    // 使用默认值
  }
  const enableEval = threshold > 0;

  // ========== 项目级风格 & 模型配置 ==========
  const IMAGE_MODEL = await getSetting('AGNES_IMAGE_MODEL');
  // 1) 优先使用用户指定的 artStyle
  // 2) 其次从数据库 project.style 读取
  // 3) 最后回退 'anime'
  let projectStyle = 'anime';
  try {
    const project = await prisma.project.findUnique({
      where: { id: storyboard.script.projectId },
      select: { style: true },
    });
    if (project?.style) projectStyle = project.style;
  } catch {
    // 使用默认值
  }
  const styleKey = normalizeStyleKey(artStyle || projectStyle);
  const cameraKey = normalizeCameraKey(cameraAngle || storyboard.cameraAngle || 'medium_shot');
  const emotionKey = normalizeEmotionKey(emotion || storyboard.emotion || 'peaceful');

  // ========== 构建高质量提示词 ==========
  // 优先使用数据库的 storyboard.description，否则使用传入的 prompt
  const sceneDesc = (storyboard.description && storyboard.description.length > 0)
    ? storyboard.description
    : (sceneDescription || prompt || '');

  const professionalPrompt = enrichImagePrompt({
    sceneDescription: sceneDesc,
    characterSheets,
    styleKey: styleKey as keyof typeof import('./prompt-library').ART_STYLES,
    cameraAngleHint: cameraKey,
    emotionHint: emotionKey,
    visualKeywords: visualKeywords || '',
    // 从剧本分镜直接传入：如果 storyboard 中有这些字段，直接传给图片生成
    lightingHint: storyboard.lighting || undefined,
    compositionHint: storyboard.composition || undefined,
    colorPaletteHint: storyboard.colorPalette || undefined,
    cameraMovementHint: storyboard.cameraMovement || undefined,
  });

  const negative = buildNegativePrompt({ style: styleKey, isComic: styleKey === 'comic_book' || styleKey === 'webtoon' || styleKey === 'manga_bw' });

  // character_ref（给 image model 注入参考图）
  const characterRefParam = characterRefUrls.join(',');

  const attemptLog: Array<{ score?: number; imageUrl: string; attempt: number }> = [];
  let finalImageUrl = '';
  let lastScore = 0;
  let lastSuggestions = '';
  let usedCache = false;

  // ========== 缓存查询（免费 API：无成本，直接查）==========
  const cacheKey = buildCacheKey(professionalPrompt, styleKey as string, size);
  // 硬超时包装：单次图片生成最多 45 秒，超时直接失败（原来 90s）
  const IMAGE_HARD_TIMEOUT_MS = 45_000;
  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} 超时 (${ms / 1000}s)`)), ms)
      ),
    ]);
  }

  const cachedUrl = await getCachedImageUrl(cacheKey);
  if (cachedUrl) {
    finalImageUrl = cachedUrl;
    usedCache = true;
    lastScore = 100; // 缓存命中，假定质量良好
  } else {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 多轮改进：在提示词末尾加入上一轮的改进建议
      let currentPrompt = professionalPrompt;
      if (attempt > 0 && lastSuggestions) {
        currentPrompt = `${professionalPrompt}. Improvements: ${lastSuggestions}`;
      }

      // 硬超时保护：防止单次 API 调用无限等待
      const response = await withTimeout(
        agnesGenerateImage({
          model: IMAGE_MODEL,
          prompt: currentPrompt,
          size,
          n,
          quality: 'hd',
          character_ref: characterRefParam || undefined,
          negative_prompt: negative,
        }),
        IMAGE_HARD_TIMEOUT_MS,
        `Image generation (attempt ${attempt + 1})`
      ).catch((err) => {
        if (attempt === maxRetries) throw err;
        console.warn(`[image-gen] attempt ${attempt + 1} failed: ${err.message}, retrying...`);
        return null;
      });

      if (!response) continue;

      const imageUrl = response.data?.[0]?.url || response.data?.[0]?.b64_json || '';
      if (!imageUrl) {
        if (attempt === maxRetries) {
          throw new Error('Image generation returned no URL');
        }
        continue;
      }

      if (enableEval) {
        // 质量评估也加超时
        const evalData = await withTimeout(
          evaluateImage({
            imageUrl,
            sceneDescription: sceneDesc,
            characterNames: characterSheets.map((c) => c.name),
            expectedStyle: styleKey,
          }),
          60_000,
          'Image evaluation'
        ).catch(() => null);

        if (evalData) {
          lastScore = evalData.score;
          lastSuggestions = evalData.suggestions;
        }
        attemptLog.push({ score: lastScore, imageUrl, attempt });

        // 达标就返回，否则继续
        if (lastScore >= threshold) {
          finalImageUrl = imageUrl;
          break;
        }
        if (attempt < maxRetries) continue;
        finalImageUrl = imageUrl;
      } else {
        finalImageUrl = imageUrl;
        attemptLog.push({ imageUrl, attempt });
        break;
      }
    }
  }

  if (!finalImageUrl) {
    throw new Error('Image generation failed');
  }

  // ========== 缓存保存（生成成功后写入，下次直接命中）==========
  if (!usedCache && finalImageUrl) {
    await saveToCache(cacheKey, professionalPrompt, finalImageUrl, styleKey as string, lastScore, IMAGE_MODEL);
  }

  // imageUrls 存储字段长度保护
  const imageValue =
    typeof finalImageUrl === 'string' ? finalImageUrl.slice(0, 50_000) : '';

  // 保存图片 URL + 质量评分
  await prisma.storyboard.update({
    where: { id: storyboardId },
    data: {
      imageUrls: imageValue,
      qualityScore: lastScore || null,
    },
  });
  await updateProjectStatus(storyboard.script.projectId, 'producing');

  return {
    imageUrl: finalImageUrl,
    score: lastScore || (attemptLog[attemptLog.length - 1]?.score ?? null),
    attempts: attemptLog.length,
    usedCharacterRefs: characterRefUrls.length,
    usedCache,
    dnaLockedChars: dnaLockedCount,
  };
}
