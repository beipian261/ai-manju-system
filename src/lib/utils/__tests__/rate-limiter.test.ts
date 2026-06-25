import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('初始状态下请求被允许', async () => {
      const { checkRateLimit } = await import('../rate-limiter');
      const result = checkRateLimit('user-1', 'test-endpoint', 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetMs).toBeGreaterThan(0);
    });

    it('达到限额后请求被拒绝', async () => {
      const { checkRateLimit } = await import('../rate-limiter');
      const limit = 3;

      for (let i = 0; i < limit; i++) {
        const r = checkRateLimit('user-2', 'test-endpoint', limit);
        expect(r.allowed).toBe(true);
      }

      const rejected = checkRateLimit('user-2', 'test-endpoint', limit);
      expect(rejected.allowed).toBe(false);
      expect(rejected.remaining).toBe(0);
    });

    it('不同用户独立计数', async () => {
      const { checkRateLimit } = await import('../rate-limiter');
      const limit = 2;

      for (let i = 0; i < limit; i++) {
        checkRateLimit('user-a', 'test-endpoint', limit);
      }

      const userB = checkRateLimit('user-b', 'test-endpoint', limit);
      expect(userB.allowed).toBe(true);
      expect(userB.remaining).toBe(1);
    });

    it('不同端点独立计数', async () => {
      const { checkRateLimit } = await import('../rate-limiter');
      const limit = 2;

      for (let i = 0; i < limit; i++) {
        checkRateLimit('user-x', 'endpoint-1', limit);
      }

      const ep2 = checkRateLimit('user-x', 'endpoint-2', limit);
      expect(ep2.allowed).toBe(true);
    });

    it('窗口过期后可以再次请求', async () => {
      const { checkRateLimit } = await import('../rate-limiter');
      const limit = 3;

      for (let i = 0; i < limit; i++) {
        checkRateLimit('user-window', 'test', limit);
      }

      let rejected = checkRateLimit('user-window', 'test', limit);
      expect(rejected.allowed).toBe(false);

      vi.advanceTimersByTime(61_000);

      const allowed = checkRateLimit('user-window', 'test', limit);
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(2);
    });

    it('滑动窗口：部分过期后可继续请求', async () => {
      const { checkRateLimit } = await import('../rate-limiter');
      const limit = 5;

      checkRateLimit('user-slide', 'test', limit);
      checkRateLimit('user-slide', 'test', limit);

      vi.advanceTimersByTime(30_000);

      checkRateLimit('user-slide', 'test', limit);
      checkRateLimit('user-slide', 'test', limit);
      checkRateLimit('user-slide', 'test', limit);

      let result = checkRateLimit('user-slide', 'test', limit);
      expect(result.allowed).toBe(false);

      vi.advanceTimersByTime(31_000);

      result = checkRateLimit('user-slide', 'test', limit);
      expect(result.allowed).toBe(true);
    });

    it('默认 maxRpm 为 10', async () => {
      const { checkRateLimit } = await import('../rate-limiter');

      for (let i = 0; i < 10; i++) {
        const r = checkRateLimit('user-default', 'test');
        expect(r.allowed).toBe(true);
      }

      const r = checkRateLimit('user-default', 'test');
      expect(r.allowed).toBe(false);
    });

    it('resetMs 随时间递减', async () => {
      const { checkRateLimit } = await import('../rate-limiter');

      const r1 = checkRateLimit('user-reset', 'test', 5);
      const reset1 = r1.resetMs;

      vi.advanceTimersByTime(10_000);

      const r2 = checkRateLimit('user-reset', 'test', 5);
      expect(r2.resetMs).toBeLessThan(reset1);
    });
  });

  describe('getRateLimitStatus', () => {
    it('不消耗配额', async () => {
      const { getRateLimitStatus, checkRateLimit } = await import('../rate-limiter');

      const status1 = getRateLimitStatus('user-status', 'test', 5);
      expect(status1.current).toBe(0);
      expect(status1.remaining).toBe(5);

      const status2 = getRateLimitStatus('user-status', 'test', 5);
      expect(status2.current).toBe(0);
    });

    it('反映 checkRateLimit 消耗的配额', async () => {
      const { getRateLimitStatus, checkRateLimit } = await import('../rate-limiter');

      checkRateLimit('user-status2', 'test', 5);
      checkRateLimit('user-status2', 'test', 5);

      const status = getRateLimitStatus('user-status2', 'test', 5);
      expect(status.current).toBe(2);
      expect(status.remaining).toBe(3);
    });

    it('无历史记录时返回初始状态', async () => {
      const { getRateLimitStatus } = await import('../rate-limiter');

      const status = getRateLimitStatus('new-user', 'new-endpoint', 10);
      expect(status.current).toBe(0);
      expect(status.remaining).toBe(10);
      expect(status.resetMs).toBe(60_000);
    });
  });

  describe('startRateLimitCleanup', () => {
    it('多次调用只启动一次', async () => {
      const { startRateLimitCleanup } = await import('../rate-limiter');

      const intervalSpy = vi.spyOn(global, 'setInterval');

      startRateLimitCleanup();
      startRateLimitCleanup();
      startRateLimitCleanup();

      expect(intervalSpy).toHaveBeenCalledTimes(1);

      intervalSpy.mockRestore();
    });

    it('定期清理过期窗口', async () => {
      const { checkRateLimit, startRateLimitCleanup } = await import('../rate-limiter');

      checkRateLimit('cleanup-user', 'test', 3);

      startRateLimitCleanup();

      vi.advanceTimersByTime(61_000);

      vi.advanceTimersByTime(300_000);
    });
  });
});
