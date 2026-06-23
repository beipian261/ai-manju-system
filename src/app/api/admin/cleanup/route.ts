import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

// 手动触发清理：清理超时仍处于 generating 状态的脚本
// 可选入参：{ timeoutMin?: number } 默认 10 分钟
export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let timeoutMin = 10;
  try {
    const body = await req.json();
    if (typeof body.timeoutMin === 'number' && body.timeoutMin > 0) {
      timeoutMin = Math.min(body.timeoutMin, 1440); // 上限 24 小时
    }
  } catch {
    // 允许空 body
  }

  const cutoff = new Date(Date.now() - timeoutMin * 60 * 1000);

  try {
    const staleScripts = await prisma.script.findMany({
      where: { status: 'generating', updatedAt: { lte: cutoff } },
      select: { id: true },
    });
    const count = staleScripts.length;

    if (count > 0) {
      await prisma.script.updateMany({
        where: { id: { in: staleScripts.map((s) => s.id) } },
        data: { status: 'failed' },
      });
    }

    return NextResponse.json({
      success: true,
      cleanup: {
        timeoutMin,
        scriptsFailed: count,
        cutoff: cutoff.toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cleanup failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
