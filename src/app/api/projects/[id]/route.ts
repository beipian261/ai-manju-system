import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

const ALLOWED_GENRES = ['fantasy', 'sci-fi', 'romance', 'action', 'comedy', 'horror', 'mystery', 'unknown'];
const ALLOWED_STYLES = [
  'anime', 'realistic', 'cinematic_photo', 'comic_book',
  'manga_bw', 'pixar_3d', 'watercolor', 'oil_painting',
  'cyberpunk', 'fantasy', 'chibi', 'ghibli', 'webtoon',
  'vintage', 'disney', 'noir', 'cartoon_2d', 'low_poly',
  'ink_wash', 'western', 'chinese'
];
const ALLOWED_STATUSES = ['draft', 'scripting', 'storyboarding', 'producing', 'completed'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const project = await prisma.project.findUnique({
    where: { id: id },
    include: { characters: true, scripts: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const data: Record<string, string | number | null> = {};
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    if (t.length > 100) return NextResponse.json({ error: '标题不能超过 100 字符' }, { status: 400 });
    data.title = t;
  }
  if (typeof body.description === 'string') data.description = body.description.slice(0, 1000);
  if (typeof body.genre === 'string') data.genre = body.genre.slice(0, 100);
  if (typeof body.style === 'string' && ALLOWED_STYLES.includes(body.style)) data.style = body.style;
  if (typeof body.status === 'string' && ALLOWED_STATUSES.includes(body.status)) data.status = body.status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  try {
    const project = await prisma.project.update({ where: { id: id }, data });
    return NextResponse.json(project);
  } catch (e) {
    return NextResponse.json({ error: 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    await prisma.project.delete({ where: { id: id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
  }
}
