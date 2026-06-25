import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/config/settings';
import { isAllowedApiBase } from '@/lib/utils/url-guard';

// 共享测试逻辑（settings/route.ts POST 与 settings/test/route.ts 复用）
export async function testConnectionImpl(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须为 JSON' }, { status: 400 });
  }

  // AGNES_API_KEY 为空时，尝试用已保存的 key 测试
  let apiKey = typeof body.AGNES_API_KEY === 'string' ? body.AGNES_API_KEY.trim() : '';
  if (!apiKey) {
    const saved = await getSettings();
    apiKey = saved.AGNES_API_KEY || process.env.AGNES_API_KEY || '';
  }
  if (!apiKey) {
    return NextResponse.json({ success: false, error: '请输入 API Key' }, { status: 400 });
  }

  const baseInput = typeof body.AGNES_API_BASE === 'string' ? body.AGNES_API_BASE : '';
  const base = baseInput || (await getSettings()).AGNES_API_BASE || 'https://apihub.agnes-ai.com/v1';
  const model = typeof body.AGNES_TEXT_MODEL === 'string' && body.AGNES_TEXT_MODEL
    ? body.AGNES_TEXT_MODEL
    : 'agnes-2.0-flash';

  // SSRF 校验
  const check = await isAllowedApiBase(base);
  if (!check.ok) {
    return NextResponse.json({ success: false, error: 'API 地址不安全：' + (check.reason || '未知') }, { status: 400 });
  }

  try {
    const res = await fetch(check.url + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });

    if (!res.ok) {
      let errMsg = '';
      try {
        const errJson = await res.json();
        errMsg = errJson?.error?.message || '';
      } catch {
        errMsg = await res.text().catch(() => '');
      }
      return NextResponse.json({
        success: false,
        error: errMsg || 'API 返回 ' + res.status,
      });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return NextResponse.json({ success: true, reply: reply.trim() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知错误';
    return NextResponse.json({ success: false, error: '连接失败: ' + msg });
  }
}
