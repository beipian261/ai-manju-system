import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { emitProgress } from '@/lib/bus/progress-bus';
import { updateProjectStatus } from '@/lib/utils/project-status';
import { enqueueJob } from '@/lib/queue/job-queue';
import { listStoryboardsByScript } from '@/features/storyboards/storyboard.service';
import '@/lib/queue/jobs';
import { successResponse, errorResponse, handleApiError, parseJsonBody } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get('scriptId');
    const projectId = searchParams.get('projectId');

    if (scriptId) {
      const storyboards = await listStoryboardsByScript(scriptId);
      return successResponse(storyboards);
    }

    const where: Record<string, unknown> = {};
    if (projectId) where.script = { projectId };

    const storyboards = await prisma.storyboard.findMany({ where, orderBy: { sceneNum: 'asc' } });
    return successResponse(storyboards);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: { ids?: string[]; scriptId?: string; projectId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body
  }

  try {
    const { ids, scriptId, projectId } = body;

    if (ids && ids.length > 0) {
      const result = await prisma.storyboard.deleteMany({ where: { id: { in: ids } } });
      return successResponse({ deleted: result.count });
    }
    if (scriptId) {
      const result = await prisma.storyboard.deleteMany({ where: { scriptId } });
      return successResponse({ deleted: result.count });
    }
    if (projectId) {
      const result = await prisma.storyboard.deleteMany({ where: { script: { projectId } } });
      return successResponse({ deleted: result.count });
    }
    return errorResponse('请提供 ids、scriptId 或 projectId', 400);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{ scriptId?: string; projectId?: string; sceneOrder?: unknown[] }>(req);
    const scriptId = body.scriptId?.trim();
    const projectId = body.projectId?.trim();

    if (!scriptId || !projectId) {
      return errorResponse('scriptId 和 projectId 必填', 400);
    }

    const script = await prisma.script.findUnique({
      where: { id: scriptId },
      include: { project: true, storyboards: true },
    });
    if (!script) {
      return errorResponse('剧本不存在', 404);
    }

    if (script.storyboards && script.storyboards.length > 0) {
      emitProgress({ type: 'storyboard', id: scriptId, status: 'completed', progress: 100, message: `分镜已存在（${script.storyboards.length} 个）` });
      return successResponse({ queued: true, existing: script.storyboards.length, scriptId, projectId });
    }

    await updateProjectStatus(projectId, 'storyboarding');
    emitProgress({ type: 'storyboard', id: scriptId, status: 'started', progress: 0, message: '开始生成分镜' });

    const job = await enqueueJob('storyboard', { scriptId, projectId, sceneOrder: body.sceneOrder }, projectId);
    return successResponse({ queued: true, scriptId, projectId, jobId: job.id }, undefined, 202);
  } catch (e) {
    return handleApiError(e);
  }
}
