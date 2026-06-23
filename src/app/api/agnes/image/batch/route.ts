import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { generateStoryboardImage } from '@/lib/image-gen';
import { emitProgress } from '@/lib/progress-bus';
import { runWithConcurrencyPool } from '@/lib/concurrency-pool';
import { getClientIdentifier, checkRateLimit } from '@/lib/rate-limiter';

const BATCH_CONCURRENCY = 3; // 最多同时生成 3 张图片，避免 API 限流

interface BatchItem {
  storyboardId: string;
  prompt: string;
  index: number;
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  // Rate limit: 5 req/min for batch (more expensive)
  const rl = checkRateLimit(getClientIdentifier(req), 'agnes_batch', 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '批量生成频率过高，请稍后再试', retryAfterMs: rl.resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

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
    return NextResponse.json({ error: '单次最多批量生成 20 张图片' }, { status: 400 });
  }

  const storyboards = await prisma.storyboard.findMany({
    where: { id: { in: storyboardIds } },
    include: { script: { select: { projectId: true } } },
  });

  if (storyboards.length === 0) {
    return NextResponse.json({ error: '未找到指定的分镜' }, { status: 404 });
  }

  // 获取项目 ID（所有分镜应该属于同一个项目）
  const projectId = storyboards[0]?.script?.projectId || '';
  
  // 分类：已有图片的跳过，缺失的加入生成队列
  const toGenerate: BatchItem[] = [];
  const skipped: Array<{ storyboardId: string; reason: string }> = [];

  for (const sb of storyboards) {
    if (sb.imageUrls) {
      skipped.push({ storyboardId: sb.id, reason: '已有图片' });
    } else {
      toGenerate.push({
        storyboardId: sb.id,
        prompt: sb.imagePrompt || sb.description || '',
        index: toGenerate.length,
      });
    }
  }

  if (toGenerate.length === 0) {
    return NextResponse.json({
      success: true,
      queued: 0,
      skipped: skipped.length,
      results: skipped.map((s) => ({ storyboardId: s.storyboardId, status: 'skipped', reason: s.reason })),
      message: `全部 ${skipped.length} 个分镜已有图片，无需生成`,
    });
  }

  const batchId = 'batch_' + Date.now();

  // 发射初始进度
  emitProgress({
    type: 'image',
    id: batchId,
    projectId,
    status: 'started',
    progress: 0,
    message: `开始批量生成 ${toGenerate.length} 张图片（并发数：${BATCH_CONCURRENCY}）`,
  });

  // ========== 异步后台处理：不阻塞 HTTP 响应 ==========
  // fire-and-forget：立即返回，后台通过 SSE 推送进度
  ;(async () => {
    let done = 0;
    let errored = 0;
    let completedCount = 0;
    let failedCount = 0;

    try {
      // 单任务超时：60s（image-gen 内部已有 45s 硬限，此处留足余量）
      const TASK_TIMEOUT_MS = 60_000;
      const { results: poolResults, errors: poolErrors } = await runWithConcurrencyPool(
        toGenerate,
        BATCH_CONCURRENCY,
        async (item: BatchItem) => {
          const result = await generateStoryboardImage({
            storyboardId: item.storyboardId,
            prompt: item.prompt,
          });
          return { storyboardId: item.storyboardId, status: 'completed' as const, ...result };
        },
        (_completed, _total, _result, error) => {
          done = _completed;
          if (error) errored++;
          const pct = Math.round((done / toGenerate.length) * 100);
          emitProgress({
            type: 'image',
            id: batchId,
            projectId,
            status: 'progress',
            progress: pct,
            message: `批量生成中：${done}/${toGenerate.length}（失败 ${errored}）`,
          });
        },
        TASK_TIMEOUT_MS
      );

      // 统计最终结果
      for (let i = 0; i < toGenerate.length; i++) {
        if (poolErrors[i]) {
          failedCount++;
        } else {
          completedCount++;
        }
      }

      emitProgress({
        type: 'image',
        id: batchId,
        projectId,
        status: 'completed',
        progress: 100,
        message: `批量图片生成完成（成功 ${completedCount}，失败 ${failedCount}）`,
      });

      console.log(`[batch] ${batchId} finished: ${completedCount} success, ${failedCount} failed`);
    } catch (e) {
      console.error(`[batch] ${batchId} fatal error:`, e);
      emitProgress({
        type: 'image',
        id: batchId,
        projectId,
        status: 'failed',
        progress: done,
        message: `批量生成出错: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  })();

  // 立即返回，不等后台处理完成
  return NextResponse.json({
    success: true,
    batchId,
    queued: toGenerate.length,
    skipped: skipped.length,
    message: `已提交 ${toGenerate.length} 张图片生成任务，请通过进度面板查看实时状态`,
    results: skipped.map((s) => ({ storyboardId: s.storyboardId, status: 'skipped', reason: s.reason })),
  });
}

// GET: 查询批量任务状态（通过 SSE 已推送，此端点供轮询 fallback）
export async function GET() {
  return NextResponse.json({
    message: '批量生成进度通过 SSE 实时推送，无需轮询',
    sseEndpoint: '/api/progress',
  });
}
