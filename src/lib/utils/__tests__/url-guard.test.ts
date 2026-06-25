import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('url-guard - isSafeExternalUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('允许合法的 HTTPS URL', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://example.com/image.png')).toBe(true);
    expect(isSafeExternalUrl('https://cdn.example.com/path/to/image.jpg')).toBe(true);
  });

  it('拒绝 HTTP URL', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('http://example.com/image.png')).toBe(false);
  });

  it('拒绝空值和非字符串', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl(null as unknown as string)).toBe(false);
    expect(isSafeExternalUrl(undefined as unknown as string)).toBe(false);
  });

  it('拒绝格式非法的 URL', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('not-a-url')).toBe(false);
    expect(isSafeExternalUrl('///invalid')).toBe(false);
  });

  it('拒绝 localhost', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://localhost:3000/image.png')).toBe(false);
  });

  it('拒绝内网 IPv4 地址', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://192.168.1.1/admin')).toBe(false);
    expect(isSafeExternalUrl('https://10.0.0.1/internal')).toBe(false);
    expect(isSafeExternalUrl('https://172.16.0.1/api')).toBe(false);
    expect(isSafeExternalUrl('https://127.0.0.1/secret')).toBe(false);
    expect(isSafeExternalUrl('https://169.254.169.254/metadata')).toBe(false);
    expect(isSafeExternalUrl('https://0.0.0.0/test')).toBe(false);
  });

  it('拒绝 CGNAT 地址段', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://100.64.0.1/test')).toBe(false);
    expect(isSafeExternalUrl('https://100.127.255.254/test')).toBe(false);
  });

  it('拒绝裸 IP（即便是公网 IP）', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://8.8.8.8/image.png')).toBe(false);
    expect(isSafeExternalUrl('https://1.1.1.1/test')).toBe(false);
  });

  it('拒绝云元数据主机名', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://metadata.google.internal/v1/')).toBe(false);
    expect(isSafeExternalUrl('https://metadata.internal/')).toBe(false);
    expect(isSafeExternalUrl('https://service.internal/')).toBe(false);
    expect(isSafeExternalUrl('https://printer.local/')).toBe(false);
  });

  it('拒绝 .internal 和 .local 后缀域名', async () => {
    const { isSafeExternalUrl } = await import('../url-guard');
    expect(isSafeExternalUrl('https://anything.internal/api')).toBe(false);
    expect(isSafeExternalUrl('https://myapp.local/')).toBe(false);
  });
});

describe('url-guard - isAllowedApiBase', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('dns', () => ({
      default: {
        lookup: (hostname: string, _options: unknown, callback: (err: Error | null, addresses: Array<{ address: string }>) => void) => {
          if (hostname === 'api.agnes-ai.com') {
            callback(null, [{ address: '203.0.113.1' }]);
          } else if (hostname === 'malicious.agnes-ai.com') {
            callback(null, [{ address: '10.0.0.1' }]);
          } else if (hostname === 'unresolvable.agnes-ai.com') {
            callback(new Error('ENOTFOUND'), []);
          } else if (hostname === 'mixed.agnes-ai.com') {
            callback(null, [
              { address: '203.0.113.1' },
              { address: '192.168.1.1' },
            ]);
          } else {
            callback(null, [{ address: '203.0.113.50' }]);
          }
        },
      },
    }));
    process.env = { ...originalEnv, NODE_ENV: 'production' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('允许合法的 agnes-ai.com 域名', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://api.agnes-ai.com/v1');
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://api.agnes-ai.com/v1');
  });

  it('允许 agnes-ai.cn 域名', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://api.agnes-ai.cn/v1');
    expect(result.ok).toBe(true);
  });

  it('允许子域名', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://us-west.api.agnes-ai.com/v1');
    expect(result.ok).toBe(true);
  });

  it('拒绝空地址', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('空');
  });

  it('拒绝格式非法的 URL', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('not-a-url');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('格式');
  });

  it('生产环境拒绝 HTTP', async () => {
    process.env.NODE_ENV = 'production';
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('http://api.agnes-ai.com/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('https');
  });

  it('开发环境下 localhost HTTP 通过协议检查（但会在后续域名白名单检查失败）', async () => {
    process.env.NODE_ENV = 'development';
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('http://localhost:8080/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('允许列表');
  });

  it('开发环境下 127.0.0.1 HTTP 因内网 IP 被拒', async () => {
    process.env.NODE_ENV = 'development';
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('http://127.0.0.1:8080/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('内网');
  });

  it('开发环境拒绝非白名单域名的 HTTP', async () => {
    process.env.NODE_ENV = 'development';
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('http://api.evil.com/v1');
    expect(result.ok).toBe(false);
  });

  it('开发环境下白名单域名 HTTP 也被拒（非 localhost）', async () => {
    process.env.NODE_ENV = 'development';
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('http://api.agnes-ai.com/v1');
    expect(result.ok).toBe(false);
  });

  it('拒绝不在白名单内的域名', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://api.evil.com/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('允许列表');
  });

  it('拒绝裸 IP 地址', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://8.8.8.8/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('域名');
  });

  it('拒绝内网 IP', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://192.168.1.1/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('内网');
  });

  it('DNS 解析到内网 IP 时拒绝（DNS rebinding 防护）', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://malicious.agnes-ai.com/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('内网地址');
  });

  it('DNS 解析包含内网 IP 时拒绝（混合解析）', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://mixed.agnes-ai.com/v1');
    expect(result.ok).toBe(false);
  });

  it('域名无法解析时拒绝', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://unresolvable.agnes-ai.com/v1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('无法解析');
  });

  it('主域名（无点前缀）也匹配', async () => {
    const { isAllowedApiBase } = await import('../url-guard');
    const result = await isAllowedApiBase('https://agnes-ai.com/v1');
    expect(result.ok).toBe(true);
  });
});
