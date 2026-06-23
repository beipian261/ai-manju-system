// 鉴权核心（Edge Runtime 兼容）：使用 Web Crypto API 替代 Node.js crypto
// 同时用于 middleware（Edge）和 API routes（Node.js）

import * as bcrypt from 'bcryptjs';

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

// 将字符串转换为 Uint8Array
function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// 将 ArrayBuffer 转换为 hex 字符串
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// HMAC-SHA256 签名（Web Crypto API，Edge Runtime 兼容）
async function sign(payload: string): Promise<string> {
  const secret = getRequiredSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bufToHex(signature);
}

// 常量时间比较（防止时序攻击）
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isAuthEnabled(): boolean {
  return !!(process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || process.env.AUTH_PASSWORD_HASH);
}

export async function makeSessionToken(userId = USER_ID): Promise<string> {
  const exp = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `${userId}.${exp}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  if (!getSecret()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [userId, expStr, sig] = parts;
  if (userId !== USER_ID) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await sign(`${userId}.${expStr}`);
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
