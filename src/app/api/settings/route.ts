import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { isAllowedApiBase } from '@/lib/url-guard';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { logger } from '@/lib/logger';

const ALLOWED_KEYS = [
  'AGNES_API_BASE',
  'AGNES_API_KEY',
  'AGNES_TEXT_MODEL',
  'AGNES_IMAGE_MODEL',
  'AGNES_VIDEO_MODEL',
  'IMAGE_EVAL_THRESHOLD',
  'IMAGE_MAX_RETRIES',
];

// GET：返回脱敏后的设置（不含明文 API Key）
export async function GET() {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      if (s.key === 'AGNES_API_KEY') continue;
      result[s.key] = s.value;
    }
    // 默认值回填（便于前端显示）
    if (!result.AGNES_API_BASE) result.AGNES_API_BASE = 'https://apihub.agnes-ai.com/v1';
    if (!result.AGNES_TEXT_MODEL) result.AGNES_TEXT_MODEL = 'agnes-2.0-flash';
    if (!result.AGNES_IMAGE_MODEL) result.AGNES_IMAGE_MODEL = 'agnes-image-2.1-flash';
    if (!result.AGNES_VIDEO_MODEL) result.AGNES_VIDEO_MODEL = 'agnes-video-v2.0';
    if (!result.IMAGE_EVAL_THRESHOLD) result.IMAGE_EVAL_THRESHOLD = '60';
    if (!result.IMAGE_MAX_RETRIES) result.IMAGE_MAX_RETRIES = '3';
    const hasApiKey = settings.some((s) => s.key === 'AGNES_API_KEY' && s.value && s.value.length > 0);
    return NextResponse.json({
      ...result,
      hasApiKey,
      apiKeyMasked: hasApiKey ? 'sk-****' : '',
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT：保存设置（空字符串视为"不更新"，避免误清空密钥）
export async function PUT(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  // SSRF 校验：AGNES_API_BASE 必须是合法的公开地址
  if (typeof body.AGNES_API_BASE === 'string' && body.AGNES_API_BASE.length > 0) {
    const check = await isAllowedApiBase(body.AGNES_API_BASE);
    if (!check.ok) {
      return NextResponse.json(
        { error: 'API 地址不安全：' + (check.reason || '未知') },
        { status: 400 }
      );
    }
  }

  // 字段白名单：只允许 ALLOWED_KEYS 中的键
  const entries: Array<[string, string]> = [];
  for (const key of ALLOWED_KEYS) {
    if (body[key] === undefined) continue;
    const val = String(body[key]);
    if (val.length === 0) continue;
    if (val.length > 500) {
      return NextResponse.json({ error: `${key} 过长` }, { status: 400 });
    }
    entries.push([key as string, val]);
  }

  if (entries.length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

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
    return NextResponse.json({ success: true, updated: entries.length });
  } catch (e) {
    logger.error('Save settings error:', e);
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}

// POST：连通性测试
// 入参：{ AGNES_API_BASE?, AGNES_API_KEY? }（可选，不持久化；留空则用数据库中的值）
export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let apiBase = typeof body.AGNES_API_BASE === 'string' ? body.AGNES_API_BASE.trim() : '';
  let apiKey = typeof body.AGNES_API_KEY === 'string' ? body.AGNES_API_KEY.trim() : '';

  // 若调用方未传参数，则查询数据库中的已有配置
  if (!apiBase || !apiKey) {
    try {
      const settings = await prisma.setting.findMany({
        where: { key: { in: ['AGNES_API_BASE', 'AGNES_API_KEY'] } },
      });
      const asMap = new Map(settings.map((s) => [s.key, s.value]));
      if (!apiBase) apiBase = asMap.get('AGNES_API_BASE') || '';
      if (!apiKey) apiKey = asMap.get('AGNES_API_KEY') || '';
    } catch {
      // 使用空字符串，下方会报错
    }
  }

  if (!apiBase || !apiKey) {
    return NextResponse.json(
      { success: false, error: '请先配置 API Base 和 API Key' },
      { status: 400 }
    );
  }

  const check = await isAllowedApiBase(apiBase);
  if (!check.ok) {
    return NextResponse.json(
      { success: false, error: 'API 地址不安全：' + (check.reason || '未知') },
      { status: 400 }
    );
  }

  try {
    // 向 /models 或 /chat/completions 端点发一个最小请求
    const res = await fetchWithRetry(`${apiBase.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs: 15_000,
      maxRetries: 1,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `API 返回 ${res.status}: ${msg.slice(0, 300)}` },
        { status: 502 }
      );
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ success: true, message: '连通性测试通过', data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: '请求失败：' + msg.slice(0, 300) },
      { status: 502 }
    );
  }
}
