import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { isAllowedApiBase } from '@/lib/url-guard';

// 独立的连通性测试端点（向后兼容）
export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body，此时使用数据库中配置的 API
  }

  let apiBase = typeof body.AGNES_API_BASE === 'string' ? body.AGNES_API_BASE.trim() : '';
  let apiKey = typeof body.AGNES_API_KEY === 'string' ? body.AGNES_API_KEY.trim() : '';

  if (!apiBase || !apiKey) {
    try {
      const settings = await prisma.setting.findMany({
        where: { key: { in: ['AGNES_API_BASE', 'AGNES_API_KEY'] } },
      });
      const map = new Map(settings.map((s) => [s.key, s.value]));
      if (!apiBase) apiBase = map.get('AGNES_API_BASE') || '';
      if (!apiKey) apiKey = map.get('AGNES_API_KEY') || '';
    } catch {
      // 继续，下方会报错
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
