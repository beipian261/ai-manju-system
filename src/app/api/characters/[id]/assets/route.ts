// 角色 DNA 资产管理 API
// 支持上传多张参考图（正面/侧面/全身/表情/服装），生图时自动注入
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { isSafeExternalUrl } from '@/lib/url-guard';

const ALLOWED_TYPES = ['front', 'side', 'fullbody', 'expression', 'outfit', 'custom'];
const MAX_URL_LEN = 2000;
const MAX_LABEL_LEN = 100;

// GET: 获取角色所有参考图
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const characterId = params.id;
  if (!characterId) {
    return NextResponse.json({ error: '角色 ID 必填' }, { status: 400 });
  }

  const assets = await prisma.characterAsset.findMany({
    where: { characterId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ assets });
}

// POST: 添加参考图
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const characterId = params.id;
  if (!characterId) {
    return NextResponse.json({ error: '角色 ID 必填' }, { status: 400 });
  }

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true },
  });
  if (!character) {
    return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return NextResponse.json({ error: 'url 必填' }, { status: 400 });
  }

  // URL 安全校验
  let safeUrl = '';
  if (url.startsWith('data:image/')) {
    safeUrl = url.slice(0, MAX_URL_LEN);
  } else if (isSafeExternalUrl(url)) {
    safeUrl = url.slice(0, MAX_URL_LEN);
  } else {
    return NextResponse.json(
      { error: 'url 必须为公开的 HTTPS 图片地址或合法 data URI' },
      { status: 400 }
    );
  }

  const type = typeof body.type === 'string' && ALLOWED_TYPES.includes(body.type)
    ? body.type
    : 'custom';
  const label = typeof body.label === 'string' ? body.label.slice(0, MAX_LABEL_LEN) : null;
  const isPrimary = body.isPrimary === true;

  // 如果设为主参考图，先取消其他主参考图
  if (isPrimary) {
    await prisma.characterAsset.updateMany({
      where: { characterId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  // 限制每个角色最多 12 张参考图
  const count = await prisma.characterAsset.count({ where: { characterId } });
  if (count >= 12) {
    return NextResponse.json(
      { error: '每个角色最多 12 张参考图，请先删除旧的' },
      { status: 400 }
    );
  }

  const asset = await prisma.characterAsset.create({
    data: {
      characterId,
      type,
      url: safeUrl,
      label,
      isPrimary,
    },
  });

  // 如果是第一张参考图或标记为主参考图，同步更新 character.referenceImg
  if (isPrimary || count === 0) {
    await prisma.character.update({
      where: { id: characterId },
      data: { referenceImg: safeUrl },
    });
  }

  return NextResponse.json({ asset }, { status: 201 });
}

// DELETE: 删除参考图
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const characterId = params.id;
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get('assetId');

  if (!assetId) {
    return NextResponse.json({ error: 'assetId 必填' }, { status: 400 });
  }

  const asset = await prisma.characterAsset.findUnique({
    where: { id: assetId },
    select: { id: true, characterId: true, isPrimary: true, url: true },
  });

  if (!asset || asset.characterId !== characterId) {
    return NextResponse.json({ error: '参考图不存在' }, { status: 404 });
  }

  await prisma.characterAsset.delete({ where: { id: assetId } });

  // 如果删除的是主参考图，自动选一张替代
  if (asset.isPrimary) {
    const nextAsset = await prisma.characterAsset.findFirst({
      where: { characterId },
      orderBy: { createdAt: 'asc' },
    });
    if (nextAsset) {
      await prisma.characterAsset.update({
        where: { id: nextAsset.id },
        data: { isPrimary: true },
      });
      await prisma.character.update({
        where: { id: characterId },
        data: { referenceImg: nextAsset.url },
      });
    } else {
      // 没有参考图了
      await prisma.character.update({
        where: { id: characterId },
        data: { referenceImg: null },
      });
    }
  }

  return NextResponse.json({ success: true });
}
