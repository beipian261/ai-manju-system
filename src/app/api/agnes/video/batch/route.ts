import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { generateStoryboardVideo } from '@/lib/video-gen';
import { runWithConcurrencyPool } from '@/lib/concurrency-pool';
import { emitProgress } from '@/lib/progress-bus';

const VIDEO_CONCURRENCY = 2; // 视频生成更慢，并发数降低

interface BatchVideoItem {
  storyboardId: string;
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

  const rawIds = body.storyboardIds;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: 'storyboardIds 必填且不能为空' }, { status: 400 });
  }

  const storyboardIds = rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (storyboardIds.length === 0) {
    return NextResponse.json({ error: 'storyboardIds 无效' }, { status: 400 });
  }
  if (storyboardIds.length > 20) {
    return NextResponse.json({ error: '单次最多批量生成 20 个视频' }, { status: 400 });
  }

  const storyboards = await prisma.storyboard.findMany({
    where: { id: { in: storyboardIds } },
    include: { script: true },
  });

  if (storyboards.length === 0) {
    return NextResponse.json({ error: '未找到指定的分镜' }, { status: 404 });
  }

  // 分类：已有视频的跳过，无图片的跳过，已有任务在跑的跳过
  const toGenerate: BatchVideoItem[] = [];
  const skipped: Array<{ storyboardId: string; reason: string }> = [];

  for (const sb of storyboards) {
    if (sb.videoUrl) {
      skipped.push({ storyboardId: sb.id, reason: '已有视频' });
    } else if (!sb.imageUrls) {
      skipped.push({ storyboardId: sb.id, reason: '未生成图片' });
    } else if (sb.videoTaskId) {
      skipped.push({ storyboardId: sb.id, reason: '正在生成中' });
    } else {
      toGenerate.push({ storyboardId: sb.id });
    }
  }

  if (toGenerate.length === 0) {
    return NextResponse.json({
      success: true,
      queued: 0,
      skipped: skipped.length,
      results: skipped.map((s) => ({ storyboardId: s.storyboardId, status: 'skipped' as const, reason: s.reason })),
      message: `无需生成视频：${skipped.length} 个分镜已跳过`,
    });
  }

  // 初始进度
  emitProgress({
    type: 'video',
    id: 'video-batch:' + toGenerate.map((t) => t.storyboardId).join(','),
    status: 'started',
    progress: 0,
    message: `开始批量创建 ${toGenerate.length} 个视频任务（并发数：${VIDEO_CONCURRENCY}）`,
  });

  let done = 0;
  let errored = 0;

  const { errors: poolErrors } = await runWithConcurrencyPool(
    toGenerate,
    VIDEO_CONCURRENCY,
    async (item: BatchVideoItem) => {
      const result = await generateStoryboardVideo({ storyboardId: item.storyboardId });
      return { storyboardId: item.storyboardId, status: 'started' as const, videoTaskId: result.videoTaskId };
    },
    (_completed, _total, _result, error) => {
      done = _completed;
      if (error) errored++;
      const pct = Math.round((done / toGenerate.length) * 100);
      emitProgress({
        type: 'video',
        id: 'video-batch:progress',
        status: 'progress',
        progress: pct,
        message: `已创建视频任务：${done}/${toGenerate.length}（失败 ${errored}）`,
      });
    }
  );

  // 根据实际执行结果收集最终状态
  const results: Array<{
    storyboardId: string;
    status: 'started' | 'failed' | 'skipped';
    videoTaskId?: string;
    error?: string;
  }> = [...skipped.map((s) => ({ storyboardId: s.storyboardId, status: 'skipped' as const, reason: s.reason }))];

  let startedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < toGenerate.length; i++) {
    const item = toGenerate[i];
    if (poolErrors[i]) {
      failedCount++;
      results.push({
        storyboardId: item.storyboardId,
        status: 'failed',
        error: poolErrors[i]!.message.slice(0, 200),
      });
    } else {
      startedCount++;
      // videoTaskId 从 results 数组中获取（如果有）
      // generateStoryboardVideo 返回 { videoTaskId } 但批量模式下我们没有单独存储
      results.push({ storyboardId: item.storyboardId, status: 'started' });
    }
  }

  emitProgress({
    type: 'video',
    id: 'video-batch:' + toGenerate.map((t) => t.storyboardId).join(','),
    status: 'completed',
    progress: 100,
    message: `视频任务创建完成（成功 ${startedCount}，失败 ${failedCount}）`,
  });

  return NextResponse.json({
    success: true,
    queued: toGenerate.length,
    skipped: skipped.length,
    completed: startedCount,
    failed: failedCount,
    results: [
      ...skipped.map((s) => ({ storyboardId: s.storyboardId, status: 'skipped' as const, reason: s.reason })),
      ...results.filter((r) => r.status !== 'skipped'),
    ],
    message: `视频任务创建完成：${startedCount} 成功，${failedCount} 失败，${skipped.length} 跳过`,
  });
}
