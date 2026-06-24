import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { generateStoryboardVideo } from '@/lib/video-gen';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const rateLimit = checkRateLimit(getClientIdentifier(req), 'agnes_video', 10);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后重试', retryAfterMs: Math.ceil(rateLimit.resetMs / 1000) },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const storyboardId = typeof body.storyboardId === 'string' && body.storyboardId.length > 0
    ? body.storyboardId
    : null;
  const durationRaw = typeof body.duration === 'number' ? body.duration : undefined;

  if (!storyboardId) {
    return NextResponse.json({ error: 'storyboardId 必填' }, { status: 400 });
  }

  try {
    const result = await generateStoryboardVideo({
      storyboardId,
      duration: durationRaw,
    });
    return NextResponse.json({
      success: true,
      storyboardId,
      videoTaskId: result.videoTaskId,
      videoStatus: result.videoStatus,
      duration: result.duration,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, storyboardId }, { status: 500 });
  }
}
