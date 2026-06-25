import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

// 恢复"长时间停留在 generating 状态"的任务，避免后台进程崩溃后任务永远卡住
// 默认：超过 10 分钟视为超时
const DEFAULT_TIMEOUT_MIN = 10;

export interface CleanupResult {
  scriptsReset: number;
  storyboardsReset: number;
}

export async function cleanupStaleTasks(timeoutMin = DEFAULT_TIMEOUT_MIN): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - timeoutMin * 60_000);
  const result: CleanupResult = { scriptsReset: 0, storyboardsReset: 0 };

  try {
    // 超时的 Script 标记为 failed
    const staleScripts = await prisma.script.findMany({
      where: { status: 'generating', updatedAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const s of staleScripts) {
      await prisma.script.update({ where: { id: s.id }, data: { status: 'failed' } });
      result.scriptsReset++;
    }

    // Storyboard 没有 status 字段，只有 imageUrls 存在与否标识完成
    // 这里不主动重置分镜，但保留接口方便后续扩展
  } catch (e) {
    logger.error('cleanupStaleTasks error:', e);
  }

  return result;
}
