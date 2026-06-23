import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { evaluateImage } from '@/lib/image-eval';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const sceneDescription = typeof body.sceneDescription === 'string' ? body.sceneDescription : '';
  const characterNames = Array.isArray(body.characterNames)
    ? (body.characterNames.filter((n) => typeof n === 'string') as string[])
    : [];
  const expectedStyle = typeof body.expectedStyle === 'string' ? body.expectedStyle : 'anime';

  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl 必填' }, { status: 400 });
  }
  if (imageUrl.length > 2000) {
    return NextResponse.json({ error: 'imageUrl 过长' }, { status: 400 });
  }

  try {
    const result = await evaluateImage({
      imageUrl,
      sceneDescription: sceneDescription.slice(0, 2000),
      characterNames: characterNames.map((n) => String(n).slice(0, 100)),
      expectedStyle: expectedStyle.slice(0, 100),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Image evaluation failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ score: 100, issues: [], suggestions: '', note: 'eval_error: ' + msg.slice(0, 200) });
  }
}
