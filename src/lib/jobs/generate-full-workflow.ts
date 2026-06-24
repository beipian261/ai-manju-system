// ============================================================
// Job handler：全流程自动化（剧本 → 角色 → 分镜 → 可选生图）
// ============================================================

import prisma from '../prisma-client';
import { registerJobHandler, enqueueJob, waitForJobCompletion } from '../job-queue';
import { extractAndCreateCharacters } from '../extract-characters-from-script';
import { generateStoryboardImage } from '../image-gen';
import { emitProgress } from '../progress-bus';
import { runWithConcurrencyPool } from '../concurrency-pool';
import { logger } from '../logger';

interface WorkflowSteps {
  script?: { jobId?: string };
  storyboards?: { auto?: boolean };
  images?: { auto?: boolean };
  voices?: { auto?: boolean };
  videos?: { auto?: boolean };
}

registerJobHandler('full_workflow', async (job) => {
  const projectId = job.payload.projectId as string;
  const steps = (job.payload.steps || {}) as WorkflowSteps;

  if (!projectId) {
    throw new Error('full_workflow 缺少 projectId');
  }

  const scriptJobId = steps.script?.jobId;
  if (!scriptJobId) {
    throw new Error('full_workflow 缺少 script.jobId');
  }

  await job.setProgress(5, '等待剧本生成完成');
  emitProgress({
    type: 'system',
    id: job.id,
    status: 'progress',
    progress: 5,
    message: '等待剧本生成…',
    projectId,
  });

  const scriptJobResult = await waitForJobCompletion(scriptJobId, {
    onPoll: (j) => {
      if (j.status === 'running') {
        void job.setProgress(10, '剧本生成中…');
      }
    },
  });

  let scriptId: string | undefined;
  try {
    const parsed = JSON.parse(scriptJobResult.result || '{}') as { scriptId?: string };
    scriptId = parsed.scriptId;
  } catch {
    // ignore
  }

  if (!scriptId) {
    const latestScript = await prisma.script.findFirst({
      where: { projectId, status: 'completed' },
      orderBy: { updatedAt: 'desc' },
    });
    scriptId = latestScript?.id;
  }

  if (!scriptId) {
    throw new Error('剧本 Job 已完成但未找到 scriptId');
  }

  await job.setProgress(35, '从剧本提取角色');
  emitProgress({
    type: 'system',
    id: job.id,
    status: 'progress',
    progress: 35,
    message: '提取角色中…',
    projectId,
  });

  const charResult = await extractAndCreateCharacters(scriptId, projectId);
  logger.info(
    `[full_workflow:${job.id}] characters created=${charResult.created}, skipped=${charResult.skipped}`
  );

  if (steps.storyboards?.auto !== false) {
    await job.setProgress(45, '生成分镜');
    const storyboardJob = await enqueueJob('storyboard', { scriptId, projectId }, projectId);
    await waitForJobCompletion(storyboardJob.id, {
      onPoll: (j) => {
        if (j.status === 'running') {
          void job.setProgress(45 + Math.floor(j.progress * 0.35), '分镜生成中…');
        }
      },
    });
  }

  if (steps.images?.auto) {
    await job.setProgress(82, '批量生成图片');
    const storyboards = await prisma.storyboard.findMany({
      where: { scriptId, imageUrls: null },
      orderBy: { sceneNum: 'asc' },
      take: 20,
    });

    if (storyboards.length > 0) {
      await runWithConcurrencyPool(
        storyboards,
        2,
        async (sb) => {
          if (!sb.imagePrompt && !sb.description) return null;
          await generateStoryboardImage({
            storyboardId: sb.id,
            prompt: sb.imagePrompt || sb.description,
          });
          return sb.id;
        },
        undefined,
        120_000
      );
    }
  }

  // 配音/视频：当前为规划步骤，后续可接入 TTS / 视频 API
  if (steps.voices?.auto) {
    logger.info(`[full_workflow:${job.id}] voice auto-generation skipped (not yet implemented in worker)`);
  }
  if (steps.videos?.auto) {
    logger.info(`[full_workflow:${job.id}] video auto-generation skipped (not yet implemented in worker)`);
  }

  await job.setProgress(100, '全流程完成');
  emitProgress({
    type: 'system',
    id: job.id,
    status: 'completed',
    progress: 100,
    message: '自动化工作流完成',
    projectId,
  });

  return { projectId, scriptId, charactersCreated: charResult.created };
});
