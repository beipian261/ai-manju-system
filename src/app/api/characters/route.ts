import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { isSafeExternalUrl } from '@/lib/url-guard';

const MAX_FIELD_LEN = 200;

function trimStr(v: unknown, max = MAX_FIELD_LEN): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return null;
  return v.slice(0, max);
}

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const where = projectId ? { projectId } : {};
    const characters = await prisma.character.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(characters);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load characters' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const name = trimStr(body.name);
  if (!name) {
    return NextResponse.json({ error: '角色名必填' }, { status: 400 });
  }
  const projectId = trimStr(body.projectId, 64);
  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // referenceImg URL SSRF 校验：仅允许 HTTPS 公共地址或空
  const referenceImgRaw = typeof body.referenceImg === 'string' ? body.referenceImg.trim() : '';
  let referenceImg: string | null = null;
  if (referenceImgRaw.length > 0) {
    if (referenceImgRaw.startsWith('data:image/')) {
      referenceImg = referenceImgRaw.slice(0, 2000);
    } else if (isSafeExternalUrl(referenceImgRaw)) {
      referenceImg = referenceImgRaw.slice(0, 2000);
    } else {
      return NextResponse.json(
        { error: 'referenceImg 必须为公开的 HTTPS 图片地址或合法 data URI' },
        { status: 400 }
      );
    }
  }

  const character = await prisma.character.create({
    data: {
      name,
      age: trimStr(body.age, 20),
      gender: trimStr(body.gender, 20),
      personality: trimStr(body.personality, 500),
      clothing: trimStr(body.clothing, 500),
      appearance: trimStr(body.appearance, 500),
      hair: trimStr(body.hair, 200),
      eyes: trimStr(body.eyes, 200),
      build: trimStr(body.build, 200),
      referenceImg,
      projectId,
    },
  });
  return NextResponse.json(character, { status: 201 });
}
