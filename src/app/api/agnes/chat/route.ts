import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { checkApiAuth } from '@/lib/auth';
import { getClientIdentifier, checkRateLimit } from '@/lib/rate-limiter';

// 客户端传入的原始消息结构（校验前）
interface RawMessage {
  role?: unknown;
  content?: unknown;
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  // Rate limit: 10 req/min per client
  const rl = checkRateLimit(getClientIdentifier(req), 'agnes_chat', 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试', retryAfterMs: rl.resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  // messages 基本校验
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = Array.isArray(
    body.messages
  )
    ? body.messages
        .filter((m): m is RawMessage => m != null && typeof m === 'object' && typeof (m as RawMessage).content === 'string')
        .map((m) => {
          const rawRole = String(m.role).toLowerCase();
          const role: 'system' | 'user' | 'assistant' =
            rawRole === 'system' ? 'system' : rawRole === 'user' ? 'user' : 'assistant';
          return { role, content: String(m.content).slice(0, 8000) };
        })
    : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: 'messages 必填且不能为空' }, { status: 400 });
  }

  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(0, Math.min(2, body.temperature))
      : 0.7;
  const max_tokens =
    typeof body.max_tokens === 'number'
      ? Math.max(1, Math.min(4096, Math.floor(body.max_tokens)))
      : 2000;

  try {
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages,
      temperature,
      max_tokens,
    });
    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chat completion failed';
    console.error('Chat failed:', error);
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
