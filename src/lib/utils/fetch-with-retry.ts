// 带超时与指数退避重试的 fetch 工具
// 默认：超时 60s，最多重试 3 次（指数退避：1s, 2s, 4s）

export interface FetchWithRetryOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  // 哪些状态码要重试（默认 5xx + 408 + 429）
  retryOn?: number[];
}

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1_000;
const DEFAULT_RETRY_ON = [408, 425, 429, 500, 502, 503, 504];

export class FetchError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY,
    retryOn = DEFAULT_RETRY_ON,
    ...init
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      // 不在重试列表中：直接返回
      if (!retryOn.includes(res.status)) {
        return res;
      }

      lastError = new FetchError(`HTTP ${res.status}`, res.status);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      // AbortError 也要重试（可能是临时网络/超时）
    }

    if (attempt < maxRetries) {
      // 指数退避 + 抖动（避免雷鸣群）
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed');
}
