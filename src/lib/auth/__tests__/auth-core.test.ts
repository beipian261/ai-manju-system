import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TEST_SECRET = 'test-secret-key-for-testing-only';

describe('auth-core', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe('isAuthEnabled', () => {
    it('返回 true 当 AUTH_SECRET 已配置', async () => {
      const { isAuthEnabled } = await import('../auth-core');
      expect(isAuthEnabled()).toBe(true);
    });

    it('返回 true 当 AUTH_PASSWORD 已配置', async () => {
      process.env.AUTH_SECRET = undefined;
      process.env.AUTH_PASSWORD = 'test-pass';
      const { isAuthEnabled } = await import('../auth-core');
      expect(isAuthEnabled()).toBe(true);
    });

    it('返回 true 当 AUTH_PASSWORD_HASH 已配置', async () => {
      process.env.AUTH_SECRET = undefined;
      process.env.AUTH_PASSWORD_HASH = '$2a$10$hash';
      const { isAuthEnabled } = await import('../auth-core');
      expect(isAuthEnabled()).toBe(true);
    });

    it('返回 false 当无任何鉴权配置', async () => {
      process.env.AUTH_SECRET = undefined;
      process.env.AUTH_PASSWORD = undefined;
      process.env.AUTH_PASSWORD_HASH = undefined;
      const { isAuthEnabled } = await import('../auth-core');
      expect(isAuthEnabled()).toBe(false);
    });
  });

  describe('safeEqual (常量时间比较)', () => {
    it('相同字符串返回 true', async () => {
      const { verifyPassword } = await import('../auth-core');
      process.env.AUTH_PASSWORD = 'testpassword123';
      const result = await verifyPassword('testpassword123');
      expect(result).toBe(true);
    });

    it('不同字符串返回 false', async () => {
      const { verifyPassword } = await import('../auth-core');
      process.env.AUTH_PASSWORD = 'testpassword123';
      const result = await verifyPassword('wrongpassword');
      expect(result).toBe(false);
    });

    it('长度不同直接返回 false', async () => {
      const { verifyPassword } = await import('../auth-core');
      process.env.AUTH_PASSWORD = 'short';
      const result = await verifyPassword('muchlongerpassword');
      expect(result).toBe(false);
    });

    it('空字符串与空字符串比较', async () => {
      const { verifyPassword } = await import('../auth-core');
      process.env.AUTH_PASSWORD = '';
      const result = await verifyPassword('');
      expect(result).toBe(false);
    });
  });

  describe('makeSessionToken & verifySessionToken', () => {
    it('生成的 token 可以被正确验证', async () => {
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');
      const token = await makeSessionToken();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const valid = await verifySessionToken(token);
      expect(valid).toBe(true);
    });

    it('篡改签名的 token 验证失败', async () => {
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');
      const token = await makeSessionToken();
      const parts = token.split('.');
      parts[2] = 'a'.repeat(parts[2].length);
      const tampered = parts.join('.');

      const valid = await verifySessionToken(tampered);
      expect(valid).toBe(false);
    });

    it('篡改 payload 的 token 验证失败', async () => {
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');
      const token = await makeSessionToken();
      const parts = token.split('.');
      parts[0] = 'hacker';
      const tampered = parts.join('.');

      const valid = await verifySessionToken(tampered);
      expect(valid).toBe(false);
    });

    it('过期的 token 验证失败', async () => {
      vi.useFakeTimers();
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');

      const token = await makeSessionToken();

      vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);

      const valid = await verifySessionToken(token);
      expect(valid).toBe(false);
    });

    it('未过期的 token 验证通过', async () => {
      vi.useFakeTimers();
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');

      const token = await makeSessionToken();

      vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);

      const valid = await verifySessionToken(token);
      expect(valid).toBe(true);
    });

    it('null / undefined token 返回 false', async () => {
      const { verifySessionToken } = await import('../auth-core');
      expect(await verifySessionToken(null)).toBe(false);
      expect(await verifySessionToken(undefined)).toBe(false);
      expect(await verifySessionToken('')).toBe(false);
    });

    it('格式错误的 token 返回 false', async () => {
      const { verifySessionToken } = await import('../auth-core');
      expect(await verifySessionToken('not.a.valid.token')).toBe(false);
      expect(await verifySessionToken('only.one')).toBe(false);
      expect(await verifySessionToken('two.parts')).toBe(false);
    });

    it('错误的 user id 返回 false', async () => {
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');
      const token = await makeSessionToken('wrong-user');

      const valid = await verifySessionToken(token);
      expect(valid).toBe(false);
    });

    it('无 secret 配置时验证总是失败', async () => {
      process.env.AUTH_SECRET = undefined;
      process.env.AUTH_PASSWORD = undefined;
      process.env.AUTH_PASSWORD_HASH = undefined;

      const { verifySessionToken } = await import('../auth-core');
      expect(await verifySessionToken('admin.12345.sig')).toBe(false);
    });

    it('exp 不是数字时返回 false', async () => {
      const { makeSessionToken, verifySessionToken } = await import('../auth-core');
      const token = await makeSessionToken();
      const parts = token.split('.');
      parts[1] = 'notanumber';
      const badToken = parts.join('.');

      const valid = await verifySessionToken(badToken);
      expect(valid).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('明文密码匹配时返回 true', async () => {
      process.env.AUTH_PASSWORD = 'mysecretpass';
      const { verifyPassword } = await import('../auth-core');
      expect(await verifyPassword('mysecretpass')).toBe(true);
    });

    it('明文密码不匹配时返回 false', async () => {
      process.env.AUTH_PASSWORD = 'mysecretpass';
      const { verifyPassword } = await import('../auth-core');
      expect(await verifyPassword('wrongpass')).toBe(false);
    });

    it('无密码配置时返回 false', async () => {
      process.env.AUTH_PASSWORD = undefined;
      process.env.AUTH_PASSWORD_HASH = undefined;
      const { verifyPassword } = await import('../auth-core');
      expect(await verifyPassword('anything')).toBe(false);
    });

    it('bcrypt hash 验证（已知 hash）', async () => {
      const bcrypt = await import('bcryptjs');
      const plain = 'test_bcrypt_password_123';
      const hash = await bcrypt.hash(plain, 10);
      process.env.AUTH_PASSWORD_HASH = hash;

      const { verifyPassword } = await import('../auth-core');
      expect(await verifyPassword(plain)).toBe(true);
      expect(await verifyPassword('wrong')).toBe(false);
    });
  });

  describe('getSessionCookieOptions', () => {
    it('返回正确的 cookie 配置', async () => {
      const { getSessionCookieOptions, getCookieName } = await import('../auth-core');
      const opts = getSessionCookieOptions();
      expect(opts.name).toBe(getCookieName());
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
      expect(opts.maxAge).toBe(60 * 60 * 24 * 7);
    });

    it('生产环境 secure 为 true', async () => {
      process.env.NODE_ENV = 'production';
      const { getSessionCookieOptions } = await import('../auth-core');
      expect(getSessionCookieOptions().secure).toBe(true);
    });

    it('非生产环境 secure 为 false', async () => {
      process.env.NODE_ENV = 'development';
      const { getSessionCookieOptions } = await import('../auth-core');
      expect(getSessionCookieOptions().secure).toBe(false);
    });
  });

  describe('getCookieName', () => {
    it('返回固定的 cookie 名称', async () => {
      const { getCookieName } = await import('../auth-core');
      expect(typeof getCookieName()).toBe('string');
      expect(getCookieName().length).toBeGreaterThan(0);
    });
  });
});
