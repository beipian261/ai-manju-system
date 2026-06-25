import { NextRequest } from 'next/server';
import { progressBus, ProgressEvent } from '@/lib/bus/progress-bus';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

// SSE 端点：客户端通过 ?projectId=xxx 订阅项目级进度
// 事件格式：data: <json>\n\n
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const resourceId = searchParams.get('resourceId'); // 可选：只订阅某个 scriptId / storyboardId

  // 预加载项目关联的 script/storyboard ID，用于服务端过滤
  let projectResourceIds: Set<string> | null = null;
  if (projectId) {
    try {
      const [scripts, storyboards] = await Promise.all([
        prisma.script.findMany({ where: { projectId }, select: { id: true } }),
        prisma.storyboard.findMany({ where: { script: { projectId } }, select: { id: true } }),
      ]);
      projectResourceIds = new Set([
        ...scripts.map((s) => s.id),
        ...storyboards.map((s) => s.id),
      ]);
    } catch {
      // 如果查询失败，退化为不过滤
    }
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ProgressEvent) => {
        // 过滤：按 resourceId（精确匹配）
        if (resourceId && event.id !== resourceId) return;
        
        // 过滤：按 projectId
        // - batch_* 类型的 id：通过 event.projectId 匹配
        // - 其他 id：必须在 projectResourceIds 中
        if (projectId) {
          const isBatchEvent = event.id.startsWith('batch_');
          if (isBatchEvent) {
            // batch 事件需要匹配 projectId
            if (event.projectId !== projectId) return;
          } else {
            // 普通事件必须在项目资源列表中
            if (!projectResourceIds?.has(event.id)) return;
          }
        } else if (projectResourceIds && !projectResourceIds.has(event.id)) {
          // 如果没有指定 projectId，至少要匹配资源列表
          if (!event.id.startsWith('batch_')) return;
        }

        const data = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // 客户端已关闭
        }
      };

      // 立即发送 connected 事件
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'system', status: 'connected' })}\n\n`));

      unsubscribe = progressBus.subscribe(send);

      // 30s 心跳防超时
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // ignore
        }
      }, 30_000);

      // 客户端关闭时清理
      req.signal.addEventListener('abort', () => {
        if (unsubscribe) unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
