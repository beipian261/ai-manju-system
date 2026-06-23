import { NextResponse } from 'next/server';
import { isAuthEnabled, checkAuthFromCookies } from '@/lib/auth';

export async function GET() {
  const enabled = isAuthEnabled();
  const authed = await checkAuthFromCookies();
  return NextResponse.json({ enabled, authed });
}
