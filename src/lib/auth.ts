// 鉴权工具：单用户密码登录（Server 端 API 路由使用）
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getCookieName,
  isAuthEnabled,
  makeSessionToken,
  verifyPassword,
  verifySessionToken,
  getSessionCookieOptions,
} from '@/lib/auth-core';

export {
  getCookieName,
  isAuthEnabled,
  makeSessionToken,
  verifyPassword,
  verifySessionToken,
  getSessionCookieOptions,
} from '@/lib/auth-core';

export async function checkAuthFromCookies(): Promise<boolean> {
  if (!isAuthEnabled()) return process.env.NODE_ENV !== 'production';
  const c = await cookies();
  const token = c.get(getCookieName())?.value;
  return verifySessionToken(token);
}

export interface AuthCheckResult {
  ok: boolean;
  response?: NextResponse;
}

export async function checkApiAuth(): Promise<AuthCheckResult> {
  if (!isAuthEnabled()) {
    if (process.env.NODE_ENV !== 'production') return { ok: true };
    return {
      ok: false,
      response: NextResponse.json(
        { error: '请先配置 AUTH_PASSWORD 以启用鉴权' },
        { status: 503 }
      ),
    };
  }
  const authed = await checkAuthFromCookies();
  if (!authed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true };
}
