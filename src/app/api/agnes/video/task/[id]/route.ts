import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { syncStoryboardVideo } from '@/lib/video-gen';

// 查询 Agnes 视频任务状态
// 参数 id 是 storyboardId（数据库主键），后端根据 storyboard.videoTaskId 查询 Agnes
// 前端每 5 秒轮询一次，直到 status 为 completed / failed
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const storyboardId = id;
  if (!storyboardId) {
    return NextResponse.json({ error: 'storyboardId 必填' }, { status: 400 });
  }

  try {
    const result = await syncStoryboardVideo(storyboardId);
    return NextResponse.json({
      success: true,
      storyboardId,
      videoUrl: result.videoUrl || null,
      videoTaskId: result.videoTaskId || null,
      videoStatus: result.videoStatus || 'queued',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, storyboardId }, { status: 500 });
  }
}
