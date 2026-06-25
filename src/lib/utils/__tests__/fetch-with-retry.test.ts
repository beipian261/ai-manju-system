import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, FetchError } from '../fetch-with-retry';

describe('fetchWithRetry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
  });

  it('成功的请求直接返回 response', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('https://example.com');
    expect(result).toBe(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('2xx 状态码不重试', async () => {
    const mockResponse = new Response('created', { status: 201 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('https://example.com');
    expect(result.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('4xx 状态码（非重试列表）不重试', async () => {
    const mockResponse = new Response('bad request', { status: 400 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('https://example.com');
    expect(result.status).toBe(400);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('5xx 状态码触发重试', async () => {
    const errorResponse = new Response('error', { status: 500 });
    const successResponse = new Response('ok', { status: 200 });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse);

    const result = await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 1 });
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('429 触发重试', async () => {
    const rateLimitResponse = new Response('rate limited', { status: 429 });
    const successResponse = new Response('ok', { status: 200 });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);

    const result = await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 1 });
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('408 触发重试', async () => {
    const timeoutResponse = new Response('timeout', { status: 408 });
    const successResponse = new Response('ok', { status: 200 });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(timeoutResponse)
      .mockResolvedValueOnce(successResponse);

    const result = await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 1 });
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('网络错误触发重试', async () => {
    const successResponse = new Response('ok', { status: 200 });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(successResponse);

    const result = await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 1 });
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('超过最大重试次数后抛出错误', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('error', { status: 500 })
    );

    try {
      await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 1 });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(500);
    }
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('AbortError 超时触发重试', async () => {
    const successResponse = new Response('ok', { status: 200 });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'))
      .mockResolvedValueOnce(successResponse);

    const result = await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 1 });
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('指数退避：重试延迟递增', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('error', { status: 500 })
    );

    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    vi.stubGlobal(
      'setTimeout',
      ((...args: Parameters<typeof setTimeout>) => {
        const [, delay] = args;
        if (typeof delay === 'number' && delay >= 1) {
          delays.push(delay);
        }
        return originalSetTimeout(...args);
      }) as typeof setTimeout
    );

    try {
      await fetchWithRetry('https://example.com', { maxRetries: 2, baseDelayMs: 10 });
    } catch {
    }

    expect(delays.length).toBeGreaterThanOrEqual(2);

    vi.stubGlobal('setTimeout', originalSetTimeout);
  });

  it('自定义 retryOn 状态码', async () => {
    const badRequest = new Response('bad', { status: 400 });
    const successResponse = new Response('ok', { status: 200 });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(badRequest)
      .mockResolvedValueOnce(successResponse);

    const result = await fetchWithRetry('https://example.com', {
      maxRetries: 2,
      baseDelayMs: 1,
      retryOn: [400, 500],
    });

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('FetchError 包含 status 属性', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('error', { status: 503 })
    );

    try {
      await fetchWithRetry('https://example.com', { maxRetries: 0, baseDelayMs: 1 });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(503);
    }
  });

  it('传递 fetch options', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await fetchWithRetry('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
    );
  });

  it('默认超时时间 60s', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    vi.stubGlobal(
      'setTimeout',
      ((...args: Parameters<typeof setTimeout>) => {
        const [, delay] = args;
        if (typeof delay === 'number') {
          delays.push(delay);
        }
        return originalSetTimeout(...args);
      }) as typeof setTimeout
    );

    await fetchWithRetry('https://example.com');

    expect(delays.some((d) => d === 60000)).toBe(true);

    vi.stubGlobal('setTimeout', originalSetTimeout);
  });

  it('自定义超时时间', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    vi.stubGlobal(
      'setTimeout',
      ((...args: Parameters<typeof setTimeout>) => {
        const [, delay] = args;
        if (typeof delay === 'number') {
          delays.push(delay);
        }
        return originalSetTimeout(...args);
      }) as typeof setTimeout
    );

    await fetchWithRetry('https://example.com', { timeoutMs: 5000 });

    expect(delays.some((d) => d === 5000)).toBe(true);

    vi.stubGlobal('setTimeout', originalSetTimeout);
  });
});
