import { NextResponse } from 'next/server';
import { getCookieName } from '@/lib/auth/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(getCookieName(), '', { path: '/', maxAge: 0 });
  return res;
}
