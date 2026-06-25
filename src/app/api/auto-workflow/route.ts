// 全流程自动化 API
// 用户输入大纲 → AI 自动完成全部创作步骤
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { enqueueJob } from '@/lib/queue/job-queue';
import '@/lib/queue/jobs';
import { updateProjectStatus } from '@/lib/utils/project-status';
import { emitProgress } from '@/lib/bus/progress-bus';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const outline = typeof body.outline === 'string' ? body.outline.trim() : '';
  const autoGenerateImages = body.autoGenerateImages === true;
  const autoGenerateVoices = body.autoGenerateVoices === true;
  const autoGenerateVideos = body.autoGenerateVideos === true;
  const style = typeof body.style === 'string' ? body.style : 'anime';
  const genre = typeof body.genre === 'string' ? body.genre : 'drama';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 检查项目是否存在
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // 更新项目风格和类型
  await prisma.project.update({
    where: { id: projectId },
    data: { style, genre },
  });

  // 如果提供了大纲，先生成剧本
  if (outline && outline.length > 20) {
    const pendingScript = await prisma.script.create({
      data: { outline, content: '', status: 'generating', projectId },
    });

    await updateProjectStatus(projectId, 'scripting');
    emitProgress({
      type: 'script',
      id: pendingScript.id,
      status: 'started',
      progress: 0,
      message: '自动化工作流：开始生成剧本',
      projectId,
    });

    const scriptJob = await enqueueJob(
      'script',
      {
        scriptId: pendingScript.id,
        projectId,
        outline,
        style,
      },
      projectId
    );

    // 剧本完成后自动触发分镜生成（通过 job chain）
    // 分镜完成后自动触发图片/配音/视频生成
    const workflowJob = await enqueueJob('full_workflow', {
      projectId,
      steps: {
        script: { jobId: scriptJob.id },
        storyboards: { auto: true },
        images: { auto: autoGenerateImages },
        voices: { auto: autoGenerateVoices },
        videos: { auto: autoGenerateVideos },
      },
    }, projectId);

    return NextResponse.json({
      queued: true,
      projectId,
      workflow: {
        steps: [
          { step: '剧本生成', status: 'queued', jobId: scriptJob.id },
          { step: '角色提取', status: 'pending', auto: true },
          { step: '分镜拆解', status: 'pending', auto: true },
          { step: '图片生成', status: 'pending', auto: autoGenerateImages },
          { step: '配音生成', status: 'pending', auto: autoGenerateVoices },
          { step: '视频合成', status: 'pending', auto: autoGenerateVideos },
        ],
      },
      estimatedTime: '约 5-15 分钟完成',
      workflowJobId: workflowJob.id,
    }, { status: 202 });
  }

  // 如果没有大纲，从现有剧本开始自动化
  const existingScripts = await prisma.script.findMany({
    where: { projectId, status: 'completed' },
    take: 1,
  });

  if (existingScripts.length > 0) {
    const script = existingScripts[0];
    
    // 直接从分镜开始自动化
    const storyboardJob = await enqueueJob('storyboard', {
      scriptId: script.id,
      projectId,
    }, projectId);

    return NextResponse.json({
      queued: true,
      projectId,
      workflow: {
        steps: [
          { step: '剧本生成', status: 'completed', scriptId: script.id },
          { step: '角色提取', status: 'pending', auto: true },
          { step: '分镜拆解', status: 'queued', jobId: storyboardJob.id },
          { step: '图片生成', status: 'pending', auto: autoGenerateImages },
          { step: '配音生成', status: 'pending', auto: autoGenerateVoices },
          { step: '视频合成', status: 'pending', auto: autoGenerateVideos },
        ],
      },
      estimatedTime: '约 3-10 分钟完成',
    }, { status: 202 });
  }

  return NextResponse.json({
    error: '请提供故事大纲或先手动生成剧本',
    hint: '调用此 API 时传入 outline 参数，或先在「剧本」Tab 生成剧本',
  }, { status: 400 });
}

// GET: 获取自动化进度
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 查询项目状态
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, status: true, style: true, genre: true },
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // 统计各步骤完成情况
  const scripts = await prisma.script.count({ where: { projectId, status: 'completed' } });
  const characters = await prisma.character.count({ where: { projectId } });
  const storyboards = await prisma.storyboard.count({ where: { script: { projectId } } });
  const images = await prisma.storyboard.count({ where: { script: { projectId }, imageUrls: { not: null } } });
  const videos = await prisma.storyboard.count({ where: { script: { projectId }, videoUrl: { not: null } } });

  const progress = {
    script: { done: scripts > 0, count: scripts },
    characters: { done: characters > 0, count: characters },
    storyboards: { done: storyboards > 0, count: storyboards },
    images: { done: images > 0, count: images, total: storyboards },
    videos: { done: videos > 0, count: videos },
  };

  const completedSteps = Object.values(progress).filter(p => p.done).length;
  const totalSteps = 5;
  const percent = Math.round((completedSteps / totalSteps) * 100);

  return NextResponse.json({
    project,
    progress,
    percent,
    status: percent === 100 ? 'completed' : 'in_progress',
    nextStep: !progress.script.done ? '生成剧本' 
      : !progress.characters.done ? '创建角色'
      : !progress.storyboards.done ? '生成分镜'
      : !progress.images.done ? '生成图片'
      : !progress.videos.done ? '生成视频'
      : '已完成',
  });
}