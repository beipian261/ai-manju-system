// Rate Limiter — 滑动窗口内存限流
// 对 /api/agnes/* 端点保护 AI API 配额，防止刷量
//
// 设计要点：
// - 内存滑动窗口（单机部署适用，SQLite 不适合高频计数器）
// - 窗口大小 60s，每个窗口最多 N 次请求
// - 超限返回 429 Too Many Requests
// - 定期清理过期窗口（每 5 分钟）

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

// 默认：每分钟 10 次 AI 生成请求
const DEFAULT_RPM = 10;
// 窗口大小 60 秒
const WINDOW_MS = 60_000;
// 清理间隔
const CLEANUP_INTERVAL_MS = 300_000; // 5 分钟

function getWindowKey(identifier: string, endpoint: string): string {
  return `${identifier}:${endpoint}`;
}

function pruneWindow(entry: WindowEntry, now: number): void {
  const cutoff = now - WINDOW_MS;
  // 从头部移除过期时间戳（timestamps 是有序的）
  while (entry.timestamps.length > 0 && entry.timestamps[0] <= cutoff) {
    entry.timestamps.shift();
  }
}

/**
 * 检查请求是否被限流
 * @param identifier 用户标识（IP 或 session ID）
 * @param endpoint API 端点标识
 * @param maxRpm 每分钟最大请求数（默认 10）
 * @returns { allowed: boolean, remaining: number, resetMs: number }
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string = 'default',
  maxRpm: number = DEFAULT_RPM
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const key = getWindowKey(identifier, endpoint);

  let entry = windows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }

  // 清理过期时间戳
  pruneWindow(entry, now);

  // 判断是否超限
  const count = entry.timestamps.length;
  const allowed = count < maxRpm;

  if (allowed) {
    entry.timestamps.push(now);
  }

  const remaining = Math.max(0, maxRpm - (allowed ? count + 1 : count));
  // 最早的时间戳到窗口结束还有多少毫秒
  const oldestTimestamp = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
  const resetMs = Math.max(0, oldestTimestamp + WINDOW_MS - now);

  return { allowed, remaining, resetMs };
}

/**
 * 获取当前窗口状态（不消耗配额）
 */
export function getRateLimitStatus(
  identifier: string,
  endpoint: string = 'default',
  maxRpm: number = DEFAULT_RPM
): { current: number; remaining: number; resetMs: number } {
  const now = Date.now();
  const key = getWindowKey(identifier, endpoint);
  const entry = windows.get(key);

  if (!entry) {
    return { current: 0, remaining: maxRpm, resetMs: WINDOW_MS };
  }

  pruneWindow(entry, now);
  const current = entry.timestamps.length;
  const remaining = Math.max(0, maxRpm - current);
  const oldestTimestamp = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
  const resetMs = Math.max(0, oldestTimestamp + WINDOW_MS - now);

  return { current, remaining, resetMs };
}

// 定期清理：移除完全为空的窗口 entry
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      pruneWindow(entry, now);
      if (entry.timestamps.length === 0) {
        windows.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Node.js 环境下允许进程退出
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ========== 辅助：从 NextRequest 提取客户端标识 ==========

import type { NextRequest } from 'next/server';

export function getClientIdentifier(req: NextRequest): string {
  // 优先使用 session cookie 的哈希（如果有），否则回退到 IP
  const sessionToken = req.cookies.get('session_token')?.value;
  if (sessionToken) {
    return `session:${sessionToken.slice(0, 16)}`;
  }
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}
