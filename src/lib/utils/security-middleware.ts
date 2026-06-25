// 速率限制 + CSRF 防护中间件包装器
// 用于所有 /api/agnes/* 端点，保护 AI API 配额

import type { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limiter';
import { createHash, randomBytes } from 'crypto';

// CSRF Token 生成（HMAC-SHA256）
export function generateCsrfToken(sessionToken: string): string {
  const secret = process.env.AUTH_SECRET || 'csrf-default-secret-change-me';
  const hmac = createHash('sha256').update(`${sessionToken}:${secret}`).digest('hex');
  return hmac;
}

export function validateCsrfToken(
  sessionToken: string,
  csrfToken: string
): boolean {
  const expected = generateCsrfToken(sessionToken);
  // 定时安全的比较
  try {
    return createHash('sha256')
      .update(expected)
      .digest('hex') === createHash('sha256').update(csrfToken).digest('hex');
  } catch {
    return false;
  }
}

// 速率限制包装器：用于 API 路由中检查令牌 + 限流
export function applyRateLimit(
  req: NextRequest,
  endpoint: string = 'default',
  maxRpm: number = 10
): { status: number; body: Record<string, unknown> } | null {
  const identifier = getClientIdentifier(req);
  const { allowed, remaining, resetMs } = checkRateLimit(identifier, endpoint, maxRpm);

  if (!allowed) {
    return {
      status: 429,
      body: {
        error: '请求过于频繁，请稍后重试',
        retryAfterMs: Math.ceil(resetMs / 1000),
        remaining,
      },
    };
  }

  // 在响应头中设置限流信息（由调用方设置）
  return null;
}

// CSRF 验证包装器：对非 GET/HEAD/OPTIONS 请求验证 CSRF token
export function validateCsrf(
  req: NextRequest
): { status: number; body: Record<string, unknown> } | null {
  const method = req.method.toUpperCase();
  // GET、HEAD、OPTIONS 不需要 CSRF
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  const sessionToken = req.cookies.get('session_token')?.value;
  if (!sessionToken) {
    // 无 session，交给 auth middleware 处理
    return null;
  }

  const csrfToken = req.headers.get('x-csrf-token');
  if (!csrfToken) {
    return {
      status: 403,
      body: { error: '缺少 CSRF Token' },
    };
  }

  if (!validateCsrfToken(sessionToken, csrfToken)) {
    return {
      status: 403,
      body: { error: 'CSRF Token 无效' },
    };
  }

  return null;
}
