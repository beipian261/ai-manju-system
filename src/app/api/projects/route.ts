import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

const ALLOWED_GENRES = ['fantasy', 'sci-fi', 'romance', 'action', 'comedy', 'horror', 'mystery', 'unknown', 'historical', 'thriller', 'wuxia'];
const ALLOWED_STYLES = ['anime', 'western', 'chinese', 'realistic', 'watercolor', 'pixel', 'chibi'];

export async function GET() {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const projects = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json(projects);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
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

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: '标题必填' }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: '标题不能超过 100 字符' }, { status: 400 });
  }

  const genre = typeof body.genre === 'string' && ALLOWED_GENRES.includes(body.genre) ? body.genre : 'unknown';
  const style = typeof body.style === 'string' && ALLOWED_STYLES.includes(body.style) ? body.style : 'anime';
  const description = typeof body.description === 'string' ? body.description.slice(0, 1000) : null;
  const outline = typeof body.outline === 'string' ? body.outline.slice(0, 5000) : null;

  const project = await prisma.project.create({
    data: { title, description, genre, style },
  });

  // If outline provided (from template), auto-create a Script record
  if (outline) {
    await prisma.script.create({
      data: {
        outline,
        content: '',
        status: 'generating',
        projectId: project.id,
      },
    });
  }

  return NextResponse.json(project, { status: 201 });
}
