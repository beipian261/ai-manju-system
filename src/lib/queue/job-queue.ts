// ============================================================
// 异步任务队列：基于 SQLite 的进程内 worker
// ============================================================
// 解决 fire-and-forget 后台任务在 HTTP 响应结束后丢失的问题。
// 设计：
//   - 任务记录持久化到 Job 表，状态机 pending → running → completed/failed
//   - 进程内 worker 轮询 DB（每 POLL_INTERVAL_MS），串行消费（并发度 1，单机可靠）
//   - 首次入队时自动启动 worker；定时器 unref() 避免阻塞进程退出
//   - 心跳机制：running 期间定期 touch updatedAt，供 cleanup 区分"真在跑"和"worker 挂了"
//   - 崩溃恢复：worker 启动时扫描遗留 running Job，标记 failed + emitProgress
// 限制（已确认部署形态）：
//   - 仅单机单进程；多实例需替换为 Redis Pub/Sub + 分布式锁
// ============================================================

import prisma from '@/lib/db/prisma';
import { emitProgress } from '@/lib/bus/progress-bus';
import { logger } from '@/lib/utils/logger';

// 任务类型 → handler 映射
type JobHandler = (job: {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  projectId: string | null;
  setProgress: (pct: number, message?: string) => Promise<void>;
}) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

// 注册 handler（在模块加载阶段由 jobs/*.ts 调用）
export function registerJobHandler(type: string, handler: JobHandler): void {
  if (handlers.has(type)) {
    logger.warn(`[job-queue] handler for type "${type}" already registered, overwriting`);
  }
  handlers.set(type, handler);
}

// ============================================================
// 入队：创建 Job 记录并触发 worker（首次）
// ============================================================
export async function enqueueJob(
  type: string,
  payload: Record<string, unknown>,
  projectId?: string | null
): Promise<{ id: string; type: string; status: string }> {
  const job = await prisma.job.create({
    data: {
      type,
      status: 'pending',
      payload: JSON.stringify(payload),
      progress: 0,
      projectId: projectId || null,
    },
    select: { id: true, type: true, status: true },
  });

  // 确保 worker 已启动（幂等）
  ensureWorkerStarted();

  return job;
}

// ============================================================
// Worker：全局单例
// ============================================================
const POLL_INTERVAL_MS = 2_000; // 轮询间隔
const HEARTBEAT_INTERVAL_MS = 30_000; // 心跳：running 期间 touch updatedAt
const JOB_TIMEOUT_MIN = 15; // running 超过此时间且无心跳更新 → 视为崩溃

const globalForWorker = globalThis as unknown as {
  __jobWorker?: {
    started: boolean;
    pollTimer?: ReturnType<typeof setInterval>;
    processing: boolean;
    heartbeatTimer?: ReturnType<typeof setInterval>;
    _runningCount: number;
  };
};

const workerState = (globalForWorker.__jobWorker ??= { started: false, processing: false, _runningCount: 0 });

// 取消标记集合：Job ID → 已取消
const cancelledJobs = new Set<string>();

export function ensureWorkerStarted(): void {
  if (workerState.started) return;
  workerState.started = true;

  // 1. 崩溃恢复：扫描上次进程遗留的 running Job，标记为 failed
  recoverStaleRunningJobs().catch((e) =>
    logger.error('[job-queue] recover stale jobs failed:', e)
  );

  // 2. 启动轮询
  workerState.pollTimer = setInterval(() => {
    tick().catch((e) => logger.error('[job-queue] tick error:', e));
  }, POLL_INTERVAL_MS);
  // unref：不阻止 Node 优雅退出
  workerState.pollTimer.unref?.();

  // 3. 心跳：running 任务期间定期 touch updatedAt
  workerState.heartbeatTimer = setInterval(() => {
    touchRunningJobsHeartbeat().catch((e) =>
      logger.error('[job-queue] heartbeat error:', e)
    );
  }, HEARTBEAT_INTERVAL_MS);
  workerState.heartbeatTimer.unref?.();

  logger.info('[job-queue] worker started (poll every 2s)');
}

// 最大并发数：同时执行的 Job 上限（调大可提升吞吐，但需确保 API 侧能承受）
const MAX_CONCURRENT_JOBS = 3;

// ============================================================
// 单次 tick：取出 pending 任务并并发执行（最多 MAX_CONCURRENT_JOBS）
// ============================================================
async function tick(): Promise<void> {
  if (handlers.size === 0) return; // 无 handler 注册时不消费

  // 并发槽已满则跳过
  if (workerState._runningCount >= MAX_CONCURRENT_JOBS) return;

  // 一次 tick 尝试填满空闲槽位
  const slotsAvailable = MAX_CONCURRENT_JOBS - workerState._runningCount;
  for (let i = 0; i < slotsAvailable; i++) {
    let job: { id: string; type: string; payload: string; projectId: string | null } | null = null;

    try {
      const pending = await prisma.job.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, payload: true, projectId: true },
      });
      if (!pending) break; // 没有更多待处理任务

      // 原子抢占：只有仍是 pending 才能转为 running
      const claimed = await prisma.job.updateMany({
        where: { id: pending.id, status: 'pending' },
        data: { status: 'running', startedAt: new Date(), updatedAt: new Date() },
      });
      if (claimed.count === 0) continue; // 被别人抢了，继续尝试下一个
      job = pending;
    } catch (e) {
      logger.error('[job-queue] fetch pending job error:', e);
      break;
    }

    // 并发计数 +1，任务完成后 -1
    workerState._runningCount += 1;

    executeJob(job).finally(() => {
      workerState._runningCount = Math.max(0, workerState._runningCount - 1);
    });
  }
}

async function executeJob(job: {
  id: string;
  type: string;
  payload: string;
  projectId: string | null;
}): Promise<void> {
  const handler = handlers.get(job.type);
  if (!handler) {
    // 无 handler：直接标记 failed，避免永久 pending
    await failJob(job.id, `No handler registered for job type "${job.type}"`);
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(job.payload);
  } catch {
    await failJob(job.id, 'Invalid job payload JSON');
    return;
  }

  // 进度上报函数：同时更新 Job.progress 和 updatedAt（兼做心跳）
  // 内部检查取消标记，若已取消则抛出错误终止执行
  const setProgress = async (pct: number, message?: string) => {
    if (cancelledJobs.has(job.id)) {
      throw new Error('Job cancelled');
    }
    try {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          progress: Math.max(0, Math.min(100, Math.round(pct))),
          updatedAt: new Date(),
        },
      });
    } catch {
      // 进度更新失败不影响任务执行
    }
  };

  try {
    // 检查是否已被取消
    if (cancelledJobs.has(job.id)) {
      await failJob(job.id, 'Cancelled by user');
      cancelledJobs.delete(job.id);
      emitProgress({
        type: (job.type as 'script' | 'storyboard' | 'image') || 'system',
        id: job.id,
        status: 'cancelled',
        message: '任务已取消',
        projectId: job.projectId || undefined,
      });
      return;
    }

    const result = await handler({ id: job.id, type: job.type, payload, projectId: job.projectId, setProgress });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        result: result ? JSON.stringify(result).slice(0, 10000) : null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Job cancelled' && cancelledJobs.has(job.id)) {
      // 用户主动取消，标记 cancelled 状态
      cancelledJobs.delete(job.id);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: 'Cancelled by user',
          finishedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      emitProgress({
        type: (job.type as 'script' | 'storyboard' | 'image') || 'system',
        id: job.id,
        status: 'cancelled',
        message: '任务已取消',
        projectId: job.projectId || undefined,
      });
      return;
    }
    await failJob(job.id, msg.slice(0, 2000));
  }
}

async function failJob(jobId: string, errorMessage: string): Promise<void> {
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: errorMessage,
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    logger.error('[job-queue] failJob error:', e);
  }
}

// ============================================================
// 心跳：更新所有 running Job 的 updatedAt
// 让 cleanup 能区分"任务真在跑"和"worker 已崩溃"
// ============================================================
async function touchRunningJobsHeartbeat(): Promise<void> {
  try {
    await prisma.job.updateMany({
      where: { status: 'running' },
      data: { updatedAt: new Date() },
    });
  } catch {
    // 心跳失败不影响主流程
  }
}

// ============================================================
// 崩溃恢复：进程启动时，把遗留的 running Job 标记为 failed
// （上次进程在任务执行中崩溃，来不及写 finishedAt）
// ============================================================
async function recoverStaleRunningJobs(): Promise<void> {
  try {
    const stale = await prisma.job.findMany({
      where: { status: 'running' },
      select: { id: true, type: true, projectId: true },
    });
    if (stale.length === 0) return;

    logger.warn(`[job-queue] recovering ${stale.length} stale running jobs from previous crash`);

    for (const job of stale) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: 'Worker crashed before completion (recovered on restart)',
          finishedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      // 通知前端该任务失败（修复 cleanup 不发 progress 的问题）
      emitProgress({
        type: (job.type as 'script' | 'storyboard' | 'image') || 'system',
        id: job.id,
        status: 'failed',
        message: '任务因服务重启而中断，请重试',
        projectId: job.projectId || undefined,
      });
    }
  } catch (e) {
    logger.error('[job-queue] recoverStaleRunningJobs error:', e);
  }
}

// ============================================================
// 清理超时 running Job（供 cleanup-scheduler 调用）
// 心跳每 30s 更新 updatedAt，若 updatedAt 超过 JOB_TIMEOUT_MIN 仍为 running
// 说明 worker 已崩溃或卡死
// ============================================================
export async function cleanupStaleJobs(timeoutMin = JOB_TIMEOUT_MIN): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMin * 60_000);
  try {
    const stale = await prisma.job.findMany({
      where: { status: 'running', updatedAt: { lt: cutoff } },
      select: { id: true, type: true, projectId: true },
    });
    if (stale.length === 0) return 0;

    for (const job of stale) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: `Job timed out (no heartbeat for ${timeoutMin} min)`,
          finishedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      emitProgress({
        type: (job.type as 'script' | 'storyboard' | 'image') || 'system',
        id: job.id,
        status: 'failed',
        message: '任务超时，请重试',
        projectId: job.projectId || undefined,
      });
    }
    return stale.length;
  } catch (e) {
    logger.error('[job-queue] cleanupStaleJobs error:', e);
    return 0;
  }
}

// ============================================================
// 集中注册所有 handler（在 ensureWorkerStarted 前调用）
// 由 src/lib/jobs/index.ts 统一导入触发
// ============================================================
export function isWorkerStarted(): boolean {
  return workerState.started;
}

// ============================================================
// Job 取消机制
// ============================================================

/**
 * 取消一个正在运行或等待中的 Job
 * - pending → 直接标记 cancelled
 * - running → 加入取消标记集合，executeJob 在下一次检查时终止
 */
export async function cancelJob(jobId: string): Promise<{ success: boolean; reason?: string }> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, type: true, projectId: true },
    });

    if (!job) {
      return { success: false, reason: 'Job not found' };
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return { success: false, reason: `Job already ${job.status}` };
    }

    if (job.status === 'pending') {
      // 直接标记为 cancelled
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'failed', error: 'Cancelled by user', finishedAt: new Date(), updatedAt: new Date() },
      });
      emitProgress({
        type: (job.type as 'script' | 'storyboard' | 'image') || 'system',
        id: jobId,
        status: 'cancelled',
        message: '任务已取消',
        projectId: job.projectId || undefined,
      });
      return { success: true };
    }

    if (job.status === 'running') {
      // 加入取消集合，executeJob 会在下次检查时终止
      cancelledJobs.add(jobId);
      return { success: true };
    }

    return { success: false, reason: `Unknown job status: ${job.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, reason: msg };
  }
}

/**
 * 查询 Job 是否已被取消（供 handler 在执行过程中检查）
 */
export function isJobCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

const DEFAULT_WAIT_POLL_MS = 2_000;
const DEFAULT_WAIT_TIMEOUT_MS = 20 * 60_000;

/**
 * 轮询等待 Job 完成（供 full_workflow 等链式任务使用）
 */
export async function waitForJobCompletion(
  jobId: string,
  options?: {
    pollMs?: number;
    timeoutMs?: number;
    onPoll?: (job: { status: string; progress: number; error: string | null }) => void;
  }
): Promise<{ status: string; result: string | null; error: string | null }> {
  const pollMs = options?.pollMs ?? DEFAULT_WAIT_POLL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, result: true, error: true, progress: true },
    });
    if (!job) {
      throw new Error(`Job ${jobId} 不存在`);
    }

    options?.onPoll?.({
      status: job.status,
      progress: job.progress,
      error: job.error,
    });

    if (job.status === 'completed') {
      return { status: job.status, result: job.result, error: job.error };
    }
    if (job.status === 'failed') {
      throw new Error(job.error || `Job ${jobId} 执行失败`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`等待 Job ${jobId} 超时（${Math.round(timeoutMs / 60000)} 分钟）`);
}
