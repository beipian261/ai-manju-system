import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, makeSessionToken, getCookieName, getSessionCookieOptions, isAuthEnabled } from '@/lib/auth/auth';

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    // 未启用鉴权：直接放行
    return NextResponse.json({ success: true, disabled: true });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须为 JSON' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    return NextResponse.json({ success: false, error: '请输入密码' }, { status: 400 });
  }

  const ok = await verifyPassword(password);
  if (!ok) {
    return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 });
  }

  const token = await makeSessionToken();
  const res = NextResponse.json({ success: true });
  res.cookies.set(getCookieName(), token, getSessionCookieOptions());
  return res;
}
