// Next.js Instrumentation Hook — 服务器启动时执行一次
// 官方文档：https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// 将原来在 prisma-client.ts 模块加载时的隐式副作用（启动定时清理器）
// 移到此处，变成显式、可控的初始化逻辑。

import { logger } from './lib/logger';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCleanupScheduler } = await import('./lib/cleanup-scheduler');
    startCleanupScheduler();

    const { startRateLimitCleanup } = await import('./lib/rate-limiter');
    startRateLimitCleanup();

    // 启动 Job Worker，处理重启前遗留的 pending 任务
    const { ensureWorkerStarted } = await import('./lib/job-queue');
    await import('./lib/jobs');
    ensureWorkerStarted();

    logger.info('[instrumentation] Server-side initialization complete (cleanup + rate-limit + job-worker)');
  }
}
