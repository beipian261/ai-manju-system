import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, getCookieName, isAuthEnabled } from '@/lib/auth-core';

// 拦截受保护路径：/dashboard/* 和 /api/*
// 未鉴权时：API 返回 401 JSON，页面重定向到 /login
// 生产环境且未配置密码：默认拒绝所有非公开请求（默认安全）

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/status',
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// 安全化 next 参数：必须是本站相对路径，防止 open redirect
function safeRedirectPath(nextRaw: string | null): string {
  if (!nextRaw || typeof nextRaw !== 'string') return '/dashboard';
  // 必须以单个 / 开头，不能是 // / \\ / http:
  if (!nextRaw.startsWith('/')) return '/dashboard';
  if (nextRaw.startsWith('//')) return '/dashboard';
  if (nextRaw.startsWith('/\\')) return '/dashboard';
  if (nextRaw.startsWith('/:')) return '/dashboard';
  if (nextRaw === '/login') return '/dashboard';
  // 过滤换行符 / 控制字符
  const cleaned = nextRaw.replace(/[\r\n\t\0]/g, '');
  return cleaned || '/dashboard';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProd = process.env.NODE_ENV === 'production';

  // 公开页面：始终放行
  if (pathname === '/login' || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // 生产环境且未配置鉴权：默认拒绝（避免 API 裸奔）
  if (isProd && !isAuthEnabled()) {
    if (pathname.startsWith('/api/')) {
      if (isPublicApi(pathname)) return NextResponse.next();
      return NextResponse.json(
        { error: '服务器未配置鉴权密码（AUTH_PASSWORD），拒绝访问。请在 .env 配置后重启。' },
        { status: 503 }
      );
    }
    // 页面请求：重定向到登录页并提示
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    const nextParam = req.nextUrl.searchParams.get('next');
    if (nextParam) {
      url.searchParams.set('next', safeRedirectPath(nextParam));
    }
    url.searchParams.set('error', 'unconfigured');
    return NextResponse.redirect(url);
  }

  // 鉴权未启用（仅开发环境可能到这里）：放行
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const token = req.cookies.get(getCookieName())?.value;
  const authed = verifySessionToken(token);

  if (authed) return NextResponse.next();

  // API：返回 401
  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) return NextResponse.next();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 页面：重定向到 /login，使用安全的 next 参数
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', safeRedirectPath(pathname));
  return NextResponse.redirect(url);
}

// 匹配所有路由，但排除静态资源/图片，避免性能开销
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
