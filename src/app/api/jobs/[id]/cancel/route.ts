import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import { cancelJob } from '@/lib/queue/job-queue';

// POST /api/jobs/[id]/cancel — 取消一个正在执行或等待中的异步任务
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const jobId = id;
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const result = await cancelJob(jobId);

  if (!result.success) {
    return NextResponse.json({ error: result.reason || 'Failed to cancel job' }, { status: 400 });
  }

  return NextResponse.json({ success: true, jobId });
}
