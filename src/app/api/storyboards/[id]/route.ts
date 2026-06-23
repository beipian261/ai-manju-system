import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { isSafeExternalUrl } from '@/lib/url-guard';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const storyboard = await prisma.storyboard.findUnique({
    where: { id: params.id },
  });
  if (!storyboard) {
    return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
  }
  return NextResponse.json(storyboard);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  // 显式字段白名单 + 类型检查 + 长度限制
  const data: Record<string, string | number | null> = {};

  if (typeof body.sceneNum === 'number') {
    data.sceneNum = Math.max(0, Math.floor(body.sceneNum));
  }
  if (typeof body.description === 'string') {
    data.description = body.description.slice(0, 2000);
  }
  if (typeof body.cameraAngle === 'string') {
    data.cameraAngle = body.cameraAngle.slice(0, 200);
  }
  if (typeof body.dialogue === 'string') {
    data.dialogue = body.dialogue.slice(0, 2000);
  } else if (body.dialogue === null) {
    data.dialogue = null;
  }
  if (typeof body.emotion === 'string') {
    data.emotion = body.emotion.slice(0, 100);
  } else if (body.emotion === null) {
    data.emotion = null;
  }
  if (typeof body.imagePrompt === 'string') {
    data.imagePrompt = body.imagePrompt.slice(0, 4000);
  } else if (body.imagePrompt === null) {
    data.imagePrompt = null;
  }

  // 智能分镜引擎新增字段
  if (typeof body.location === 'string') {
    data.location = body.location.slice(0, 300);
  } else if (body.location === null) {
    data.location = null;
  }
  if (typeof body.timeOfDay === 'string') {
    data.timeOfDay = body.timeOfDay.slice(0, 50);
  } else if (body.timeOfDay === null) {
    data.timeOfDay = null;
  }
  if (typeof body.visualKeywords === 'string') {
    data.visualKeywords = body.visualKeywords.slice(0, 500);
  } else if (body.visualKeywords === null) {
    data.visualKeywords = null;
  }
  if (typeof body.title === 'string') {
    data.title = body.title.slice(0, 200);
  } else if (body.title === null) {
    data.title = null;
  }
  if (typeof body.lighting === 'string') {
    data.lighting = body.lighting.slice(0, 50);
  } else if (body.lighting === null) {
    data.lighting = null;
  }
  if (typeof body.composition === 'string') {
    data.composition = body.composition.slice(0, 50);
  } else if (body.composition === null) {
    data.composition = null;
  }
  if (typeof body.cameraMovement === 'string') {
    data.cameraMovement = body.cameraMovement.slice(0, 50);
  } else if (body.cameraMovement === null) {
    data.cameraMovement = null;
  }
  if (typeof body.colorPalette === 'string') {
    data.colorPalette = body.colorPalette.slice(0, 50);
  } else if (body.colorPalette === null) {
    data.colorPalette = null;
  }
  if (typeof body.atmosphere === 'string') {
    data.atmosphere = body.atmosphere.slice(0, 500);
  } else if (body.atmosphere === null) {
    data.atmosphere = null;
  }
  if (typeof body.promptMode === 'string' && ['rule', 'smart'].includes(body.promptMode)) {
    data.promptMode = body.promptMode;
  }
  if (typeof body.charactersInScene === 'string') {
    data.charactersInScene = body.charactersInScene.slice(0, 1000);
  } else if (body.charactersInScene === null) {
    data.charactersInScene = null;
  }

  // imageUrls：允许 HTTPS / data URI / 空
  if (body.imageUrls !== undefined) {
    const raw = typeof body.imageUrls === 'string' ? body.imageUrls.trim() : '';
    if (raw.length === 0) {
      data.imageUrls = null;
    } else if (raw.startsWith('data:image/') || isSafeExternalUrl(raw)) {
      data.imageUrls = raw.slice(0, 50_000);
    } else {
      return NextResponse.json(
        { error: 'imageUrls 必须为合法 HTTPS 图片地址或 data URI' },
        { status: 400 }
      );
    }
  }

  if (typeof body.duration === 'number') {
    data.duration = Math.max(0, body.duration);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  try {
    const storyboard = await prisma.storyboard.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(storyboard);
  } catch (e) {
    return NextResponse.json({ error: 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    await prisma.storyboard.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
  }
}
