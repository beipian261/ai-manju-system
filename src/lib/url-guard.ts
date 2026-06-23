// SSRF 防护：校验外部 API 地址是否安全
// 策略：1) 协议白名单 2) 域名后缀白名单 3) 拒绝解析到内网/保留 IP 的地址

import dns from 'dns';
import net from 'net';

export interface UrlCheckResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

// 允许的 Agnes API 域名后缀
const ALLOWED_HOST_SUFFIXES = [
  '.agnes-ai.com',
  '.agnes-ai.cn',
];

// 私有/保留 IP 段（CIDR 简化判断）
function isPrivateIp(ip: string): boolean {
  // IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / 云元数据)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    return false;
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6，递归检查内嵌的 IPv4
    return isPrivateIp(lower.slice('::ffff:'.length));
  }
  return false;
}

function dnsResolve(hostname: string): Promise<string[]> {
  return new Promise((resolve) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err || !addresses.length) {
        resolve([]);
        return;
      }
      resolve(addresses.map((a) => a.address));
    });
  });
}

// 主校验入口：用于 AGNES_API_BASE 等服务端将发起 fetch 的地址
export async function isAllowedApiBase(raw: string): Promise<UrlCheckResult> {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: '地址为空' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL 格式非法' };
  }

  // 协议白名单：生产仅 https；开发允许 http 但仅 localhost
  const isProd = process.env.NODE_ENV === 'production';
  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:' && !isProd && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      // 开发环境本地回环放行
    } else {
      return { ok: false, reason: isProd ? '生产环境仅允许 https' : '仅允许 https(或开发环境 localhost http)' };
    }
  }

  const hostname = parsed.hostname.toLowerCase();

  // 纯 IP 地址直接判内网
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { ok: false, reason: '禁止使用内网/保留 IP 地址' };
    }
    // 公网 IP 也拒绝：Agnes API 必须走域名，避免 DNS 缓存绕过
    return { ok: false, reason: '必须使用域名，不接受裸 IP' };
  }

  // 域名后缀白名单
  const matched = ALLOWED_HOST_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
  if (!matched) {
    return { ok: false, reason: `域名不在允许列表(需 *.agnes-ai.com)` };
  }

  // DNS 解析后再校验：防止域名指向内网 IP（DNS rebinding / 内网穿透）
  const ips = await dnsResolve(hostname);
  if (ips.length === 0) {
    return { ok: false, reason: '域名无法解析' };
  }
  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      return { ok: false, reason: `域名解析到内网地址 ${ip}` };
    }
  }

  return { ok: true, url: parsed.toString() };
}

// 轻量校验：用于用户提供的图片/参考图 URL（characterRefs）
// 仅允许 HTTPS，拒绝内网 IP / localhost / 云元数据主机名
// 不做 DNS 解析（参考图 URL 通常指向外部 CDN，同步校验即可）
export function isSafeExternalUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  // 只允许 HTTPS（不接受 http，防止 MITM 劫持参考图）
  if (parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  // 拒绝内网/保留 IP（含 IPv4-mapped IPv6）
  if (net.isIP(hostname) && isPrivateIp(hostname)) return false;
  // 拒绝裸 IP（任何 IP 均不接受，即便是公网）
  if (net.isIP(hostname)) return false;
  // 拒绝回环 / 本地
  if (hostname === 'localhost') return false;
  // 拒绝云厂商元数据服务主机名（SSRF 高危目标）
  if (
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254' ||
    hostname === 'metadata.internal' ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) return false;
  return true;
}
