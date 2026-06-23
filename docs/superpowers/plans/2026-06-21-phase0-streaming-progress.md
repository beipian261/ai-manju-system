# Phase 0: AI 流式输出 + 可视化进度 — 实施计划

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan task-by-task.

**目标**: 在 AI 剧本生成/分镜分析/图片生成环节实现流式内容展示和步骤化进度

**架构**: 前端 StreamingContent 组件 → 后端流式 API Route → agnes-client.chatCompletionStream → Agnes AI Stream API

**技术栈**: Next.js 14 + TypeScript + TailwindCSS

---

### 文件清单

| 操作 | 文件 |
|------|------|
| 新增 | `src/components/StreamingContent.tsx` |
| 新增 | `src/components/ProgressSteps.tsx` |
| 新增 | `src/components/ImageGridProgress.tsx` |
| 新增 | `src/app/api/agnes/chat/stream/route.ts` |
| 修改 | `src/app/dashboard/projects/[id]/ProjectContext.tsx` |
| 修改 | `src/app/dashboard/projects/[id]/ScriptTab.tsx` |
| 修改 | `src/app/dashboard/projects/[id]/StoryboardTab.tsx` |

### 任务 0: 后端流式 API 端点

**文件:**
- 创建: `src/app/api/agnes/chat/stream/route.ts`

- [ ] **步骤 1: 创建流式 API 路由**

```typescript
import { NextRequest } from 'next/server';
import { chatCompletionStream } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { checkApiAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体必须为 JSON' }), { status: 400 });
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = Array.isArray(
    body.messages
  )
    ? body.messages
        .filter((m) => m && typeof m === 'object' && typeof (m as any).content === 'string')
        .map((m) => {
          const rawRole = String((m as any).role).toLowerCase();
          const role: 'system' | 'user' | 'assistant' =
            rawRole === 'system' ? 'system' : rawRole === 'user' ? 'user' : 'assistant';
          return { role, content: String((m as any).content).slice(0, 8000) };
        })
    : [];

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages 必填且不能为空' }), { status: 400 });
  }

  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(0, Math.min(2, body.temperature))
      : 0.7;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullContent = '';
        await chatCompletionStream(
          { model: TEXT_MODEL, messages, temperature },
          (token: string, done: boolean) => {
            if (done) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`));
              controller.close();
              return;
            }
            fullContent += token;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`));
          }
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream failed';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg.slice(0, 500) })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 任务 1: StreamingContent 组件

**文件:**
- 创建: `src/components/StreamingContent.tsx`

- [ ] **步骤 1: 创建 StreamingContent 组件**

```tsx
'use client';

interface StreamingContentProps {
  content: string;
  status: 'idle' | 'streaming' | 'completed';
  placeholder?: string;
  wordCount?: number;
  className?: string;
  onRegenerate?: () => void;
  onSave?: () => void;
}

export function StreamingContent({
  content,
  status,
  placeholder = '等待 AI 生成...',
  wordCount,
  className = '',
  onRegenerate,
  onSave,
}: StreamingContentProps) {
  if (status === 'idle') {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <div className="text-4xl mb-3 opacity-40">✨</div>
        <p className="text-sm text-ink-muted">{placeholder}</p>
      </div>
    );
  }

  return (
    <div className={`border border-border rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-base-bg">
        <div className={`w-2 h-2 rounded-full ${
          status === 'streaming' ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
        }`} />
        <span className="text-sm font-medium text-ink">
          {status === 'streaming' ? 'AI 正在创作...' : '生成完成'}
        </span>
        {wordCount !== undefined && (
          <span className="text-xs text-ink-muted ml-auto">
            共 {wordCount} 字
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 min-h-[120px] max-h-96 overflow-y-auto">
        {content ? (
          <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
            {content}
            {status === 'streaming' && (
              <span className="inline-block w-0.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-ink-muted text-sm">
            <span className="w-4 h-4 border-2 border-border-strong border-t-emerald-500 rounded-full animate-spin" />
            等待响应...
          </div>
        )}
      </div>

      {/* Actions (completed only) */}
      {status === 'completed' && (onRegenerate || onSave) && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-base-bg">
          {onRegenerate && (
            <button onClick={onRegenerate} className="btn-ghost text-xs px-3 py-1.5">
              🔄 重新生成
            </button>
          )}
          {onSave && (
            <button onClick={onSave} className="btn-primary btn-sm text-xs px-3 py-1.5 ml-auto">
              💾 保存内容
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 任务 2: ProgressSteps 组件

**文件:**
- 创建: `src/components/ProgressSteps.tsx`

- [ ] **步骤 1: 创建 ProgressSteps 组件**

```tsx
'use client';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  className?: string;
}

export function ProgressSteps({ steps, className = '' }: ProgressStepsProps) {
  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 min-w-0">
          {/* Step indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              step.status === 'completed'
                ? 'bg-emerald-500 text-white'
                : step.status === 'active'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-gray-50 text-ink-muted border border-border'
            }`}>
              {step.status === 'completed' ? '✓' : idx + 1}
            </div>
            <span className={`text-xs truncate ${
              step.status === 'completed'
                ? 'text-emerald-600 font-medium'
                : step.status === 'active'
                ? 'text-ink font-medium'
                : 'text-ink-muted'
            }`}>
              {step.label}
            </span>
          </div>
          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${
              step.status === 'completed' ? 'bg-emerald-300' : 'bg-border'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

### 任务 3: ImageGridProgress 组件

**文件:**
- 创建: `src/components/ImageGridProgress.tsx`

- [ ] **步骤 1: 创建 ImageGridProgress 组件**

```tsx
'use client';

interface ImageSlot {
  id: string;
  status: 'completed' | 'generating' | 'pending';
  thumbnail?: string;
  label?: string;
}

interface ImageGridProgressProps {
  slots: ImageSlot[];
  totalSlots: number;
  className?: string;
}

export function ImageGridProgress({ slots, totalSlots, className = '' }: ImageGridProgressProps) {
  const completedCount = slots.filter(s => s.status === 'completed').length;
  const progress = totalSlots > 0 ? Math.round((completedCount / totalSlots) * 100) : 0;

  // Fill remaining slots as pending
  const displaySlots = [...slots];
  while (displaySlots.length < totalSlots) {
    displaySlots.push({ id: `pending-${displaySlots.length}`, status: 'pending' });
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {displaySlots.map((slot) => (
          <div
            key={slot.id}
            className={`aspect-square rounded-lg border flex items-center justify-center text-lg transition-all ${
              slot.status === 'completed'
                ? 'bg-emerald-50 border-emerald-200'
                : slot.status === 'generating'
                ? 'bg-emerald-50/50 border-emerald-200 border-dashed animate-pulse'
                : 'bg-gray-50 border-border border-dashed'
            }`}
          >
            {slot.status === 'completed' ? (
              <span className="text-2xl">🖼️</span>
            ) : slot.status === 'generating' ? (
              <span className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-500 rounded-full animate-spin" />
            ) : (
              <span className="text-ink-muted text-sm">+</span>
            )}
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between text-xs text-ink-muted mb-1">
          <span>生成进度</span>
          <span>{completedCount}/{totalSlots}</span>
        </div>
        <div className="progress-track md">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
```

### 任务 4: 更新 ProjectContext — 添加 streaming state

**文件:**
- 修改: `src/app/dashboard/projects/[id]/ProjectContext.tsx`

- [ ] **步骤 1: 在 ProjectContext 中添加 streaming 状态管理**

在合适位置添加以下状态和逻辑（找到 `progressMap` 附近）：

```typescript
// === 流式输出状态 ===
const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
const [streamingStatus, setStreamingStatus] = useState<Record<string, 'idle' | 'streaming' | 'completed'>>({});

// 流式生成剧本
async function generateScriptStreaming(outline: string): Promise<void> {
  const scriptId = crypto.randomUUID?.() || `${Date.now()}`;
  
  // 先创建空白 script 记录
  await createScript(outline);
  
  // 从 existing scripts 中找到刚创建的那个
  const script = scripts.find(s => s.outline === outline);
  if (!script) return;
  
  const sid = script.id;
  setStreamingContent(prev => ({ ...prev, [sid]: '' }));
  setStreamingStatus(prev => ({ ...prev, [sid]: 'streaming' }));

  try {
    const res = await fetch('/api/agnes/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是一个专业的漫剧剧本作家...' },
          { role: 'user', content: `请根据以下大纲创作一个完整的漫剧剧本：\n${outline}` },
        ],
      }),
    });

    if (!res.ok) throw new Error('Stream request failed');
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.slice(6));
        if (data.type === 'token') {
          setStreamingContent(prev => ({ ...prev, [sid]: (prev[sid] || '') + data.content }));
        } else if (data.type === 'done') {
          setStreamingContent(prev => ({ ...prev, [sid]: data.content }));
          setStreamingStatus(prev => ({ ...prev, [sid]: 'completed' }));
          // 保存完整内容到后端
          await updateScript(sid, { content: data.content, status: 'completed' });
        } else if (data.type === 'error') {
          throw new Error(data.message);
        }
      }
    }
  } catch (err) {
    setStreamingStatus(prev => ({ ...prev, [sid]: 'completed' }));
    console.error('Streaming error:', err);
  }
}
```

同时在 Context 的返回值中添加：

```typescript
streamingContent,
streamingStatus,
generateScriptStreaming,
```

### 任务 5: 更新 ScriptTab — 集成流式显示

**文件:**
- 修改: `src/app/dashboard/projects/[id]/ScriptTab.tsx`

- [ ] **步骤 1: 在 ScriptTab 中使用 StreamingContent 和 generateScriptStreaming**

主要变更：
- 将原有的 `generateScript` 替换为 `generateScriptStreaming`（或并行保留）
- 生成状态下用 `StreamingContent` 替换普通 loading
- 使用 `ProgressSteps` 显示生成阶段（大纲→第一幕→第二幕→第三幕）

在 `useProjectContext` 中解构新增的流式状态：

```typescript
const { 
  ...existing,
  streamingContent, 
  streamingStatus, 
  generateScriptStreaming 
} = useProjectContext();
```

在剧本生成表单的提交处理中：

```typescript
async function handleGenerate(e: React.FormEvent) {
  e.preventDefault();
  if (!outline.trim()) return;
  await generateScriptStreaming(outline);
  setOutline('');
  setShowForm(false);
}
```

在剧本列表区域，对于正在生成的剧本显示 StreamingContent：

```tsx
{/* 显示流式生成中的剧本 */}
{Object.entries(streamingStatus).filter(([_, status]) => status === 'streaming').map(([id]) => (
  <div key={id} className="mb-4">
    <StreamingContent
      content={streamingContent[id] || ''}
      status="streaming"
      wordCount={(streamingContent[id] || '').length}
    />
    <ProgressSteps
      steps={[
        { id: 'outline', label: '大纲构建', status: 'completed' },
        { id: 'act1', label: '第一幕', status: 'active' },
        { id: 'act2', label: '第二幕', status: 'pending' },
        { id: 'act3', label: '第三幕', status: 'pending' },
      ]}
      className="mt-3"
    />
  </div>
))}
```

### 任务 6: 构建验证

- [ ] **步骤 1: 运行构建检查**

```bash
cd C:\Users\28406\Desktop\新建文件夹\ai-comic-drama-system
npx next build
```

Expected: 编译成功，无 TypeScript 错误。

- [ ] **步骤 2: 启动开发服务器验证**

```bash
npx next dev
```

验证：
1. 打开剧本页面 → 点击 AI 生成 → 看到流式内容逐字出现
2. 看到步骤进度条跟随生成阶段变化
3. 生成完成后显示保存/重新生成按钮
