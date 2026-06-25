// 简单的进程内事件总线（用于 SSE 实时进度）
// 单进程部署够用；多进程需要替换为 Redis Pub/Sub

import { EventEmitter } from 'events';

export type ProgressEvent = {
  type: 'script' | 'storyboard' | 'image' | 'video' | 'system';
  id: string;
  status: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled' | 'connected';
  progress?: number;
  message?: string;
  projectId?: string;  // 关联项目 ID（用于前端筛选）
  at: number;
};

class ProgressBus extends EventEmitter {
  // 自定义方法：发送结构化事件
  send(event: ProgressEvent): void {
    super.emit('progress', event);
  }

  subscribe(handler: (event: ProgressEvent) => void) {
    super.on('progress', handler);
    return () => super.off('progress', handler);
  }
}

const globalForBus = globalThis as unknown as { __progressBus?: ProgressBus };

export const progressBus: ProgressBus = (globalForBus.__progressBus ??= new ProgressBus());

// 增加监听上限（默认 10，SSE 路由可能多连接）
progressBus.setMaxListeners(100);

export function emitProgress(event: Omit<ProgressEvent, 'at'>) {
  progressBus.send({ ...event, at: Date.now() });
}
