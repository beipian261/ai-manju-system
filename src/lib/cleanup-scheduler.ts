import { cleanupStaleTasks } from './task-cleanup';
import { logger } from './logger';

// 进程内定时清理器：每 5 分钟清理一次超时任务
// 仅在第一次访问时启动（避免 serverless 冷启动问题）

const CLEANUP_INTERVAL_MS = 5 * 60_000;
const globalForCleanup = globalThis as unknown as { __cleanupStarted?: boolean };

export function startCleanupScheduler() {
  if (globalForCleanup.__cleanupStarted) return;
  globalForCleanup.__cleanupStarted = true;

  // 首次延迟 30s 启动，给应用初始化留时间
  setTimeout(() => {
    cleanupStaleTasks().catch((e) => logger.error('Scheduled cleanup error:', e));
    setInterval(() => {
      cleanupStaleTasks().catch((e) => logger.error('Scheduled cleanup error:', e));
    }, CLEANUP_INTERVAL_MS);
  }, 30_000);

  logger.info('[cleanup] Task cleanup scheduler started (interval 5m)');
}
