import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

// GET: 获取剧本的所有历史版本
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { id: scriptId } = await params;

  try {
    const versions = await prisma.scriptVersion.findMany({
      where: { scriptId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        outline: true,
        content: true,
        source: true,
        createdAt: true,
      },
    });

    return NextResponse.json(versions);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load versions';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: 保存当前剧本为新版本（在再生/编辑前调用）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { id: scriptId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const source = (typeof body.source === 'string' && ['ai_generated', 'manual_edit', 'restore'].includes(body.source))
    ? body.source
    : 'ai_generated';

  try {
    // 获取当前剧本数据
    const script = await prisma.script.findUnique({
      where: { id: scriptId },
      select: { id: true, outline: true, content: true },
    });

    if (!script) {
      return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
    }

    // 跳过空内容
    if (!script.content || script.content.trim().length === 0) {
      return NextResponse.json({ skipped: true, reason: 'empty_content' });
    }

    // 计算下一个版本号
    const lastVersion = await prisma.scriptVersion.findFirst({
      where: { scriptId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, content: true },
    });

    // 跳过与上一版本内容相同的重复保存
    if (lastVersion && lastVersion.content === script.content) {
      return NextResponse.json({ skipped: true, reason: 'duplicate_content' });
    }

    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await prisma.scriptVersion.create({
      data: {
        scriptId,
        versionNumber: nextVersion,
        outline: script.outline,
        content: script.content,
        source,
      },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save version';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
