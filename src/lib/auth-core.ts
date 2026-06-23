// 鉴权核心（Edge / Middleware 安全）：不依赖 next/headers
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const COOKIE_NAME = 'auth_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const USER_ID = 'admin';

function getSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD_HASH || process.env.AUTH_PASSWORD || null;
}

function getRequiredSecret(): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error('AUTH_SECRET / AUTH_PASSWORD / AUTH_PASSWORD_HASH 均未配置，无法签发或校验 session');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getRequiredSecret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function isAuthEnabled(): boolean {
  return !!(process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || process.env.AUTH_PASSWORD_HASH);
}

export function makeSessionToken(userId = USER_ID): string {
  const exp = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  if (!getSecret()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [userId, expStr, sig] = parts;
  if (userId !== USER_ID) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(`${userId}.${expStr}`);
  if (!safeEqual(sig, expected)) return false;
  return true;
}

export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export async function verifyPassword(plain: string): Promise<boolean> {
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (hash) {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }
  const plainExpected = process.env.AUTH_PASSWORD;
  if (!plainExpected) return false;
  return safeEqual(plain, plainExpected);
}
