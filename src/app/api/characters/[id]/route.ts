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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const character = await prisma.character.findUnique({
    where: { id: params.id },
  });
  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }
  return NextResponse.json(character);
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
  const data: Record<string, string | null> = {};

  const name = trimStr(body.name);
  if (name !== null) {
    if (!name.trim()) {
      return NextResponse.json({ error: '角色名不能为空' }, { status: 400 });
    }
    data.name = name;
  }
  const age = trimStr(body.age, 20);
  if (age !== null) data.age = age;
  const gender = trimStr(body.gender, 20);
  if (gender !== null) data.gender = gender;
  const personality = trimStr(body.personality, 500);
  if (personality !== null) data.personality = personality;
  const clothing = trimStr(body.clothing, 500);
  if (clothing !== null) data.clothing = clothing;
  const appearance = trimStr(body.appearance, 500);
  if (appearance !== null) data.appearance = appearance;
  const hair = trimStr(body.hair, 200);
  if (hair !== null) data.hair = hair;
  const eyes = trimStr(body.eyes, 200);
  if (eyes !== null) data.eyes = eyes;
  const build = trimStr(body.build, 200);
  if (build !== null) data.build = build;

  // 智能角色生成器新增字段
  const expressions = trimStr(body.expressions, 400);
  if (expressions !== null) data.expressions = expressions;
  const signaturePose = trimStr(body.signaturePose, 200);
  if (signaturePose !== null) data.signaturePose = signaturePose;
  const colorScheme = trimStr(body.colorScheme, 100);
  if (colorScheme !== null) data.colorScheme = colorScheme;

  // referenceImg：允许合法 HTTPS / data URI / null
  if (body.referenceImg !== undefined) {
    const refRaw = typeof body.referenceImg === 'string' ? body.referenceImg.trim() : '';
    if (refRaw.length === 0) {
      data.referenceImg = null;
    } else if (refRaw.startsWith('data:image/')) {
      data.referenceImg = refRaw.slice(0, 2000);
    } else if (isSafeExternalUrl(refRaw)) {
      data.referenceImg = refRaw.slice(0, 2000);
    } else {
      return NextResponse.json(
        { error: 'referenceImg 必须为公开的 HTTPS 图片地址或合法 data URI' },
        { status: 400 }
      );
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  try {
    const character = await prisma.character.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(character);
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
    await prisma.character.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
  }
}
