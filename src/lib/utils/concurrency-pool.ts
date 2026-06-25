/**
 * 并发池工具 - 限制同时执行的任务数
 *
 * v3: 滑动窗口模式 + 单任务超时保护
 *   - 一个任务完成立即启动下一个，不被慢任务阻塞
 *   - 可选 taskTimeoutMs：对每个 processor 调用单独设置超时，防止挂死导致整个池卡住
 *
 * @param items         要处理的任务数据数组
 * @param concurrency   最多同时执行的任务数（>= 1）
 * @param processor     每个任务的处理函数（返回 Promise）
 * @param onProgress    每完成一个任务时的回调 (completed, total, result, error)
 * @param taskTimeoutMs 单任务超时（毫秒，0 表示不限制），默认 0
 */
export async function runWithConcurrencyPool<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number, result: R | null, error: Error | null) => void,
  taskTimeoutMs = 0
): Promise<{ results: (R | null)[]; errors: (Error | null)[] }> {
  if (items.length === 0) return { results: [], errors: [] };

  const results: (R | null)[] = new Array(items.length).fill(null);
  const errors: (Error | null)[] = new Array(items.length).fill(null);
  let completedCount = 0;
  let nextIndex = 0;

  /**
   * 为 promise 包裹超时拒绝；taskTimeoutMs <= 0 时直接透传原 promise。
   */
  function withTaskTimeout(promise: Promise<R>, index: number): Promise<R> {
    if (taskTimeoutMs <= 0) return promise;
    return Promise.race([
      promise,
      new Promise<R>((_, reject) =>
        setTimeout(
          () => reject(new Error(`任务 #${index} 超时（>${taskTimeoutMs}ms）`)),
          taskTimeoutMs
        )
      ),
    ]);
  }

  // 滑动窗口：始终保持最多 concurrency 个任务在运行
  async function runNext(): Promise<void> {
    const myIndex = nextIndex++;
    if (myIndex >= items.length) return;

    try {
      const result = await withTaskTimeout(processor(items[myIndex], myIndex), myIndex);
      results[myIndex] = result;
      errors[myIndex] = null;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      results[myIndex] = null;
      errors[myIndex] = err;
    }

    completedCount++;
    if (onProgress) {
      const isError = errors[myIndex] !== null;
      onProgress(completedCount, items.length, results[myIndex], isError ? errors[myIndex] : null);
    }

    // 滑动窗口：完成一个立即启动下一个
    if (nextIndex < items.length) {
      await runNext();
    }
  }

  // 启动初始 concurrency 个 worker，每个 worker 负责一条滑动链
  const initialWorkers = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: initialWorkers }, () => runNext()));

  return { results, errors };
}
