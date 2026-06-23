import { NextRequest } from 'next/server';
import { chatCompletionStream } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { checkApiAuth } from '@/lib/auth';
import { getClientIdentifier, checkRateLimit } from '@/lib/rate-limiter';

// 客户端传入的原始消息结构（校验前）
interface RawMessage {
  role?: unknown;
  content?: unknown;
}

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const rl = checkRateLimit(getClientIdentifier(req), 'agnes_stream', 10);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体必须为 JSON' }), { status: 400 });
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

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
    return new Response(JSON.stringify({ error: 'messages 必填且不能为空' }), { status: 400 });
  }

  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(0, Math.min(2, body.temperature))
      : 0.7;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullContent = '';
        await chatCompletionStream(
          { model: TEXT_MODEL, messages, temperature },
          (token: string, done: boolean) => {
            if (done) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`)
              );
              controller.close();
              return;
            }
            fullContent += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
            );
          }
        );
        // If chatCompletionStream finishes without calling onChunk(done)
        if (!fullContent) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`)
          );
          controller.close();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream failed';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg.slice(0, 500) })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
