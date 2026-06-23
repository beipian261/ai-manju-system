# Phase 0: AI 流式输出 + 可视化进度 — 设计文档

> **日期**: 2026-06-21
> **状态**: 已批准

---

## 1. 概述

在 AI 剧本生成、分镜分析、图片生成等环节中，实现类 ChatGPT 的**流式内容输出**和**步骤化进度可视化**，让用户在等待 AI 生成过程中能看到实时进展，提升创作沉浸感。

## 2. 架构

```
前端 StreamingContent 组件
  │  fetch() with AbortController
  ▼
/api/agnes/chat/stream  (Next.js API Route)
  │  streaming Response (ReadableStream)
  ▼
agnes-client.chatCompletionStream()
  │  fetch() with stream: true
  ▼
Agnes AI API (SSE NDJSON)
```

对于图片/视频生成（不支持流式），使用现有的 SSE ProgressBus + 新增可视化组件。

## 3. 新增组件

### 3.1 StreamingContent

**位置**: `src/components/StreamingContent.tsx`

通用流式内容展示组件，支持三种状态：

| 状态 | 显示 |
|------|------|
| `idle` | 空状态，显示占位提示 |
| `streaming` | 逐字显示内容 + 闪烁光标 + 字数统计 |
| `completed` | 完整内容 + 操作按钮（保存/重新生成） |

**Props**:

```typescript
interface StreamingContentProps {
  content: string;           // 已收到的内容
  status: 'idle' | 'streaming' | 'completed';
  placeholder?: string;      // idle 状态的占位提示
  wordCount?: number;        // 已生成字数
  className?: string;
}
```

### 3.2 ProgressSteps

**位置**: `src/components/ProgressSteps.tsx`

步骤化进度条组件，显示多阶段任务的每个步骤状态。

```typescript
interface ProgressStep {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  className?: string;
}
```

### 3.3 ImageGridProgress

**位置**: `src/components/ImageGridProgress.tsx`

图片批量生成的进度网格，显示每张图的状态。

---

## 4. 后端流式 API

**位置**: `src/app/api/agnes/chat/stream/route.ts`

```typescript
// POST /api/agnes/chat/stream
// Body: { messages, model?, temperature? }
// Response: streaming text/event-stream (SSE)
//
// 事件格式:
// data: {"type":"token","content":"...","done":false}
// data: {"type":"done","content":"完整内容"}
// data: {"type":"error","message":"..."}
```

---

## 5. 修改文件

| 文件 | 变更 |
|------|------|
| `src/components/StreamingContent.tsx` | **新增** — 流式内容展示 |
| `src/components/ProgressSteps.tsx` | **新增** — 步骤化进度 |
| `src/components/ImageGridProgress.tsx` | **新增** — 图片网格进度 |
| `src/app/api/agnes/chat/stream/route.ts` | **新增/修改** — 流式 API 端点 |
| `src/app/dashboard/projects/[id]/ScriptTab.tsx` | 集成 StreamingContent 显示剧本生成 |
| `src/app/dashboard/projects/[id]/StoryboardTab.tsx` | 集成 StreamingContent 显示分镜分析 |
| `src/app/dashboard/projects/[id]/ProjectContext.tsx` | 添加 streaming state 管理 |

## 6. 实施顺序

1. `StreamingContent` 组件
2. `ProgressSteps` 组件
3. 后端流式 API 端点
4. `ImageGridProgress` 组件
5. ScriptTab 集成
6. StoryboardTab 集成
7. 图片/视频生成进度集成
