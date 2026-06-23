import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { emitProgress } from '@/lib/progress-bus';
import { updateProjectStatus } from '@/lib/project-status';
import { enqueueJob } from '@/lib/job-queue';
// 触发 job handler 注册（必须在 enqueueJob 前 import）
import '@/lib/jobs';

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const scriptId = searchParams.get('scriptId');

    const where: Record<string, unknown> = {};
    if (projectId) where.script = { projectId };
    if (scriptId) where.scriptId = scriptId;

    const storyboards = await prisma.storyboard.findMany({
      where,
      orderBy: { sceneNum: 'asc' },
    });
    return NextResponse.json(storyboards);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load storyboards' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  const scriptId = typeof body.scriptId === 'string' ? body.scriptId : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';

  if (ids.length > 0) {
    const result = await prisma.storyboard.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: result.count });
  }
  if (scriptId) {
    const result = await prisma.storyboard.deleteMany({ where: { scriptId } });
    return NextResponse.json({ deleted: result.count });
  }
  if (projectId) {
    const result = await prisma.storyboard.deleteMany({ where: { script: { projectId } } });
    return NextResponse.json({ deleted: result.count });
  }
  return NextResponse.json({ error: '请提供 ids、scriptId 或 projectId' }, { status: 400 });
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

  const scriptId = typeof body.scriptId === 'string' ? body.scriptId.trim() : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const sceneOrder: string[] | null = Array.isArray(body.sceneOrder) ? body.sceneOrder as string[] : null;

  if (!scriptId || !projectId) {
    return NextResponse.json({ error: 'scriptId 和 projectId 必填' }, { status: 400 });
  }

  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { project: true, storyboards: true },
  });
  if (!script) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }

  // 并发保护：若已存在分镜，直接跳过
  if (script.storyboards && script.storyboards.length > 0) {
    emitProgress({
      type: 'storyboard',
      id: scriptId,
      status: 'completed',
      progress: 100,
      message: `分镜已存在（${script.storyboards.length} 个）`,
    });
    return NextResponse.json({ queued: true, existing: script.storyboards.length, scriptId, projectId });
  }

  await updateProjectStatus(projectId, 'storyboarding');
  emitProgress({
    type: 'storyboard',
    id: scriptId,
    status: 'started',
    progress: 0,
    message: '开始生成分镜',
  });

  // 通过 Job 队列调度（worker 进程内消费，不再 fire-and-forget）
  const job = await enqueueJob(
    'storyboard',
    { scriptId, projectId, sceneOrder },
    projectId
  );

  return NextResponse.json({ queued: true, scriptId, projectId, jobId: job.id }, { status: 202 });
}

// 注：分镜生成逻辑（generateStoryboardsInBackground）已迁移到 src/lib/jobs/generate-storyboards.ts
// 由 job-queue worker 调度执行。

