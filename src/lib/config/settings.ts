import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

interface AppSettings {
  AGNES_API_BASE?: string;
  AGNES_API_KEY?: string;
  AGNES_TEXT_MODEL?: string;
  AGNES_IMAGE_MODEL?: string;
  AGNES_VIDEO_MODEL?: string;
  IMAGE_EVAL_THRESHOLD?: string;
  IMAGE_MAX_RETRIES?: string;
}

// 敏感 key：永远不会出现在面向客户端的 getPublicSettings 返回值中
const SECRET_KEYS = new Set(['AGNES_API_KEY']);

const DEFAULTS: Record<string, string> = {
  AGNES_API_BASE: 'https://apihub.agnes-ai.com/v1',
  AGNES_TEXT_MODEL: 'agnes-2.0-flash',
  AGNES_IMAGE_MODEL: 'agnes-image-2.1-flash',
  AGNES_VIDEO_MODEL: 'agnes-video-v2.0',
};

// 设置 key 白名单：saveSettings 只允许写入这些 key
const ALLOWED_SETTING_KEYS = new Set([
  'AGNES_API_BASE',
  'AGNES_API_KEY',
  'AGNES_TEXT_MODEL',
  'AGNES_IMAGE_MODEL',
  'AGNES_VIDEO_MODEL',
  'IMAGE_EVAL_THRESHOLD',
  'IMAGE_MAX_RETRIES',
]);

// ========== 内存缓存 ==========
// getSetting() 在批量图片生成时被高频调用（每次 API 请求 3-5 次），
// 避免每次都查数据库。TTL 30s，saveSettings() 时自动失效。
const SETTING_CACHE = new Map<string, { value: string; expiresAt: number }>();
const SETTING_CACHE_TTL = 30_000; // 30 秒

function getCachedSetting(key: string): string | undefined {
  const entry = SETTING_CACHE.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }
  SETTING_CACHE.delete(key);
  return undefined;
}

function setCachedSetting(key: string, value: string): void {
  SETTING_CACHE.set(key, { value, expiresAt: Date.now() + SETTING_CACHE_TTL });
}

function invalidateSettingCache(): void {
  SETTING_CACHE.clear();
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const settings = await prisma.setting.findMany();
    const result: AppSettings = {};
    for (const s of settings) {
      // 仅回填白名单内的 key，避免脏数据被强转
      if (ALLOWED_SETTING_KEYS.has(s.key)) {
        result[s.key as keyof AppSettings] = s.value;
      }
    }
    return result;
  } catch (e) {
    logger.error('Failed to read settings from database:', e);
    return {};
  }
}

// 生成掩码字符串：sk-xxxx1234 → sk-****1234
function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return value.slice(0, 3) + '****' + value.slice(-4);
}

// 面向客户端的设置：移除敏感明文，用掩码 + 布尔标志替代
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const all = await getSettings();
  const apiKey = all.AGNES_API_KEY || process.env.AGNES_API_KEY || '';
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(all)) {
    if (SECRET_KEYS.has(key)) continue;
    result[key] = value;
  }
  // 补默认值，前端无需再处理 undefined
  if (result.AGNES_API_BASE === undefined) result.AGNES_API_BASE = DEFAULTS.AGNES_API_BASE;
  if (result.AGNES_TEXT_MODEL === undefined) result.AGNES_TEXT_MODEL = DEFAULTS.AGNES_TEXT_MODEL;
  if (result.AGNES_IMAGE_MODEL === undefined) result.AGNES_IMAGE_MODEL = DEFAULTS.AGNES_IMAGE_MODEL;
  if (result.AGNES_VIDEO_MODEL === undefined) result.AGNES_VIDEO_MODEL = DEFAULTS.AGNES_VIDEO_MODEL;
  if (result.IMAGE_EVAL_THRESHOLD === undefined) result.IMAGE_EVAL_THRESHOLD = '60';
  if (result.IMAGE_MAX_RETRIES === undefined) result.IMAGE_MAX_RETRIES = '3';
  result.AGNES_API_KEY = '';
  result.hasApiKey = !!apiKey;
  result.apiKeyMasked = maskSecret(apiKey);
  return result;
}

export async function getSetting(key: string): Promise<string> {
  // 1. 检查内存缓存
  const cached = getCachedSetting(key);
  if (cached !== undefined) return cached;

  // 2. 查数据库
  try {
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (setting) {
      setCachedSetting(key, setting.value);
      return setting.value;
    }
  } catch (e) {
    logger.error('Failed to read setting from database:', e);
  }

  // 3. 回退到环境变量 / 默认值
  const fallback = process.env[key] || DEFAULTS[key] || '';
  setCachedSetting(key, fallback);
  return fallback;
}

export async function saveSettings(settings: Record<string, string | undefined>): Promise<void> {
  // 仅写入白名单内、且非空的 key（空字符串视为"不更新"，避免误清空密钥）
  const entries = Object.entries(settings).filter(
    ([key, value]) => ALLOWED_SETTING_KEYS.has(key) && typeof value === 'string' && value.length > 0
  ) as Array<[string, string]>;
  if (entries.length === 0) return;

  try {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );
    // 写入成功后失效缓存，下次读取会重新从数据库加载
    invalidateSettingCache();
  } catch (e) {
    logger.error('Failed to save settings to database:', e);
    throw e; // 让上层 API 决定如何响应，避免静默失败
  }
}
