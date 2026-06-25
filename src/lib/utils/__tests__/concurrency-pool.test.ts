import { describe, it, expect } from 'vitest';
import { runWithConcurrencyPool } from '../concurrency-pool';

describe('runWithConcurrencyPool', () => {
  it('空数组返回空结果', async () => {
    const result = await runWithConcurrencyPool([], 3, async () => 'ok');
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('单任务正常执行', async () => {
    const result = await runWithConcurrencyPool([1], 1, async (item) => item * 2);
    expect(result.results).toEqual([2]);
    expect(result.errors).toEqual([null]);
  });

  it('所有任务成功完成，结果顺序与输入一致', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await runWithConcurrencyPool(items, 2, async (item) => item * 10);

    expect(result.results).toEqual([10, 20, 30, 40, 50]);
    expect(result.errors.every((e) => e === null)).toBe(true);
  });

  it('并发数不超过限制', async () => {
    let active = 0;
    let maxActive = 0;
    const concurrency = 3;

    const processor = async (item: number): Promise<number> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return item;
    };

    await runWithConcurrencyPool([1, 2, 3, 4, 5, 6, 7, 8], concurrency, processor);

    expect(maxActive).toBeLessThanOrEqual(concurrency);
    expect(maxActive).toBeGreaterThan(0);
  });

  it('部分任务失败时返回对应错误，不影响其他任务', async () => {
    const items = [1, 2, 3, 4, 5];
    const failAt = new Set([2, 4]);

    const result = await runWithConcurrencyPool(items, 2, async (item) => {
      if (failAt.has(item)) {
        throw new Error(`failed at ${item}`);
      }
      return item * 10;
    });

    expect(result.results[0]).toBe(10);
    expect(result.results[1]).toBeNull();
    expect(result.results[2]).toBe(30);
    expect(result.results[3]).toBeNull();
    expect(result.results[4]).toBe(50);

    expect(result.errors[0]).toBeNull();
    expect(result.errors[1]).toBeInstanceOf(Error);
    expect(result.errors[1]?.message).toContain('failed at 2');
    expect(result.errors[2]).toBeNull();
    expect(result.errors[3]).toBeInstanceOf(Error);
    expect(result.errors[4]).toBeNull();
  });

  it('所有任务失败时返回所有错误', async () => {
    const result = await runWithConcurrencyPool([1, 2, 3], 2, async (item) => {
      throw new Error(`error-${item}`);
    });

    expect(result.results.every((r) => r === null)).toBe(true);
    expect(result.errors.every((e) => e instanceof Error)).toBe(true);
    expect(result.errors[0]?.message).toBe('error-1');
    expect(result.errors[1]?.message).toBe('error-2');
    expect(result.errors[2]?.message).toBe('error-3');
  });

  it('onProgress 回调每个任务完成时触发', async () => {
    const items = [1, 2, 3, 4, 5];
    const progressCalls: Array<{ completed: number; total: number }> = [];

    await runWithConcurrencyPool(
      items,
      2,
      async (item) => item * 2,
      (completed, total) => {
        progressCalls.push({ completed, total });
      }
    );

    expect(progressCalls.length).toBe(5);
    expect(progressCalls[0].total).toBe(5);
    expect(progressCalls[progressCalls.length - 1].completed).toBe(5);
  });

  it('onProgress 回调包含正确的结果和错误', async () => {
    const items = [1, 2];
    let lastCall: unknown = null;

    await runWithConcurrencyPool(
      items,
      1,
      async (item) => {
        if (item === 2) throw new Error('fail');
        return item * 10;
      },
      (completed, total, result, error) => {
        lastCall = { completed, total, result, error };
      }
    );

    expect(lastCall).toEqual({
      completed: 2,
      total: 2,
      result: null,
      error: expect.any(Error),
    });
  });

  it('并发数大于任务数时也正常工作', async () => {
    const result = await runWithConcurrencyPool([1, 2], 10, async (item) => item * 3);
    expect(result.results).toEqual([3, 6]);
    expect(result.errors).toEqual([null, null]);
  });

  it('并发数为 0 时至少启动 1 个 worker', async () => {
    const result = await runWithConcurrencyPool([1, 2, 3], 0, async (item) => item);
    expect(result.results).toEqual([1, 2, 3]);
  });

  it('并发数为负数时至少启动 1 个 worker', async () => {
    const result = await runWithConcurrencyPool([1, 2], -5, async (item) => item);
    expect(result.results).toEqual([1, 2]);
  });

  it('processor 接收正确的 index 参数', async () => {
    const indices: number[] = [];
    await runWithConcurrencyPool(['a', 'b', 'c'], 2, async (item, index) => {
      indices.push(index);
      return item;
    });

    expect(indices.sort()).toEqual([0, 1, 2]);
  });

  it('非 Error 类型的抛出被包装为 Error', async () => {
    const result = await runWithConcurrencyPool([1], 1, async () => {
      throw 'string error';
    });

    expect(result.errors[0]).toBeInstanceOf(Error);
    expect(result.errors[0]?.message).toBe('string error');
  });

  describe('taskTimeoutMs', () => {
    it('超时的任务返回错误', async () => {
      const result = await runWithConcurrencyPool(
        [1, 2],
        2,
        async (item) => {
          if (item === 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return 'slow';
          }
          return 'fast';
        },
        undefined,
        50
      );

      expect(result.results[0]).toBeNull();
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[0]?.message).toContain('超时');

      expect(result.results[1]).toBe('fast');
      expect(result.errors[1]).toBeNull();
    });

    it('taskTimeoutMs 为 0 时不设超时', async () => {
      const result = await runWithConcurrencyPool(
        [1],
        1,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'done';
        },
        undefined,
        0
      );

      expect(result.results[0]).toBe('done');
      expect(result.errors[0]).toBeNull();
    });

    it('taskTimeoutMs 为负数时不设超时', async () => {
      const result = await runWithConcurrencyPool(
        [1],
        1,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'done';
        },
        undefined,
        -100
      );

      expect(result.results[0]).toBe('done');
    });
  });
});
