import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { emitProgress } from '@/lib/progress-bus';
import { generateStoryboardImage } from '@/lib/image-gen';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const storyboardId = typeof body.storyboardId === 'string' ? body.storyboardId.trim() : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!storyboardId) {
    return NextResponse.json({ error: 'storyboardId 必填' }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: 'prompt 必填' }, { status: 400 });
  }
  if (prompt.length > 4000) {
    return NextResponse.json({ error: 'prompt 不能超过 4000 字符' }, { status: 400 });
  }

  const size = typeof body.size === 'string' ? body.size : undefined;
  const n = typeof body.n === 'number' ? body.n : undefined;
  const characterRefs = Array.isArray(body.characterRefs)
    ? body.characterRefs.filter((x): x is string => typeof x === 'string')
    : undefined;

  emitProgress({
    type: 'image',
    id: storyboardId,
    status: 'started',
    progress: 0,
    message: '开始生成图片',
  });

  try {
    const result = await generateStoryboardImage({
      storyboardId,
      prompt,
      size,
      n,
      characterRefs,
    });

    emitProgress({
      type: 'image',
      id: storyboardId,
      status: 'completed',
      progress: 100,
      message: '图片已生成',
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      score: result.score,
      attempts: result.attempts,
      usedCharacterRefs: result.usedCharacterRefs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Image generation failed';
    console.error('Image generation failed:', error);
    emitProgress({ type: 'image', id: storyboardId, status: 'failed', message: msg });
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
