# AI Comic Drama System - Code Wiki

> 基于 Agnes AI 免费 API 的 AI 漫剧生成 Web 应用。从剧本到成片，全流程 AI 驱动。

---

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [项目架构](#项目架构)
- [数据库模型](#数据库模型)
- [核心模块说明](#核心模块说明)
- [API 端点](#api-端点)
- [页面路由](#页面路由)
- [中间件与安全](#中间件与安全)
- [环境变量](#环境变量)
- [依赖关系图](#依赖关系图)
- [项目运行方式](#项目运行方式)
- [主要流程](#主要流程)

---

## 项目概述

AI 漫剧生成平台，支持从故事大纲到完整漫剧视频的全流程 AI 生成。

**核心功能：**
- 项目管理（创建/编辑/删除）
- 角色管理系统（角色档案 + 一致性控制）
- AI 剧本生成（基于 Agnes Text Model，支持流式预览）
- 智能分镜设计（从剧本自动提取，多路径解析）
- AI 图片生成（角色一致性保障，缓存机制，质量评估）
- 视频动画生成
- 仪表盘和数据统计

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | TailwindCSS |
| 后端 | Next.js API Routes |
| 数据库 | SQLite (Prisma ORM) |
| AI 服务 | Agnes AI Platform (OpenAI 兼容格式) |
| 认证 | Cookie-based Session (HMAC 签名) |
| 容器化 | Docker + Docker Compose |

**主要依赖：**
- `next@14.2.35` - React 框架
- `react@18.3.1` - UI 库
- `prisma@5.22.0` + `@prisma/client@5.22.0` - ORM
- `better-sqlite3@11.7.0` - SQLite 驱动
- `bcryptjs@2.4.3` - 密码哈希
- `uuid@10.0.0` - ID 生成

---

## 项目架构

```
ai-comic-drama-system/
├── prisma/
│   └── schema.prisma          # 数据库 Schema（数据模型）
├── src/
│   ├── app/                   # Next.js App Router（页面 + API 路由）
│   │   ├── api/               # API 路由
│   │   │   ├── admin/         # 管理接口
│   │   │   │   └── cleanup/   # 任务清理
│   │   │   ├── agnes/         # Agnes AI 集成
│   │   │   │   ├── chat/      # 通用聊天
│   │   │   │   ├── image/     # 图片生成（含 batch 批量）
│   │   │   │   └── video/     # 视频生成（含 task 轮询）
│   │   │   ├── assistant/      # 智能助手
│   │   │   ├── auth/          # 认证
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   └── status/
│   │   │   ├── characters/     # 角色 CRUD
│   │   │   │   ├── [id]/      # 单角色操作
│   │   │   │   ├── ai-suggest/   # AI 角色建议
│   │   │   │   ├── generate/     # 角色生成
│   │   │   │   └── generate-cast/ # 批量生成角色卡
│   │   │   ├── director/       # 导演 AI（场景分析）
│   │   │   ├── progress/       # SSE 进度推送
│   │   │   ├── projects/       # 项目 CRUD
│   │   │   ├── publish/        # 发布导出
│   │   │   ├── review/         # 评审（评论 + 状态）
│   │   │   ├── scenes/         # 场景操作（构建 + 重排）
│   │   │   ├── scripts/        # 剧本管理
│   │   │   ├── settings/       # 设置管理
│   │   │   ├── storyboards/    # 分镜管理
│   │   │   │   └── smart-prompt/ # 智能提示词
│   │   │   └── voice/          # 语音生成
│   │   ├── dashboard/          # 管理后台页面
│   │   │   ├── characters/     # 角色管理页
│   │   │   ├── projects/       # 项目列表
│   │   │   │   └── [id]/      # 项目详情
│   │   │   │       ├── director/   # 导演模式
│   │   │   │       ├── publish/    # 发布页
│   │   │   │       ├── review/     # 评审页
│   │   │   │       ├── timeline/   # 时间线
│   │   │   │       └── voice/      # 语音页
│   │   │   └── settings/       # 设置页
│   │   ├── login/             # 登录页
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # React 组件
│   │   ├── ui/                 # 通用 UI 基础组件
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Section.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Stepper.tsx
│   │   ├── ConfirmDialog.tsx       # 确认对话框
│   │   ├── ConsistencyDashboard.tsx # 角色一致性仪表盘
│   │   ├── ImageGallery.tsx        # 图片画廊
│   │   ├── ImageGridProgress.tsx   # 图片网格进度
│   │   ├── OutlineAnalyzer.tsx      # 大纲分析器
│   │   ├── PipelineQualityDashboard.tsx # 流水线质量仪表盘
│   │   ├── ProgressSteps.tsx       # 进度步骤条
│   │   ├── ScenePreview.tsx         # 场景预览
│   │   ├── ScriptRenderer.tsx       # 剧本渲染器
│   │   ├── ScriptVersionPanel.tsx   # 剧本版本面板
│   │   ├── SmartAssistant.tsx       # 智能助手
│   │   ├── StreamingContent.tsx    # 流式内容展示
│   │   ├── TemplateSelector.tsx    # 模板选择器
│   │   └── navbar.tsx              # 导航栏
│   ├── lib/                   # 核心工具库
│   │   ├── hooks/             # React Hooks
│   │   │   └── useProjectPage.ts  # 项目页面数据获取 + 导航
│   │   ├── jobs/              # 异步任务处理器
│   │   │   ├── index.ts                # handler 注册入口
│   │   │   ├── generate-script.ts      # 剧本生成 job
│   │   │   ├── generate-storyboards.ts # 分镜生成 job
│   │   │   └── generate-full-workflow.ts # 全流程自动化 job
│   │   ├── agnes-client.ts    # Agnes AI API 客户端
│   │   ├── auth.ts            # 认证工具（HMAC session）
│   │   ├── auth-core.ts       # 认证核心逻辑
│   │   ├── character-batch-generator.ts # 角色批量生成器
│   │   ├── character-generator.ts  # 角色生成器
│   │   ├── character-prompt.ts    # 角色提示词构建（Character Sheet）
│   │   ├── cleanup-scheduler.ts   # 定时清理调度器
│   │   ├── concurrency-pool.ts    # 并发池（滑动窗口）
│   │   ├── constants.ts           # 常量定义
│   │   ├── extract-characters-from-script.ts # 从剧本提取角色
│   │   ├── fetch-with-retry.ts    # 带重试的 fetch
│   │   ├── image-eval.ts          # 图片质量评估
│   │   ├── image-gen.ts           # 图片生成（含缓存）
│   │   ├── job-queue.ts           # 异步任务队列（SQLite worker）
│   │   ├── prisma-client.ts      # Prisma 单例
│   │   ├── progress-bus.ts       # SSE 进度事件总线
│   │   ├── project-status.ts     # 项目状态机
│   │   ├── prompt-library.ts     # 提示词库（镜头/情绪/风格/光影）
│   │   ├── rate-limiter.ts        # 频率限制器
│   │   ├── scene-builder.ts      # 智能场景构建器
│   │   ├── script-parser.ts       # 剧本解析工具
│   │   ├── script-refiner.ts      # 剧本润色优化
│   │   ├── script-templates.ts   # 剧本模板
│   │   ├── settings.ts           # 设置读写（DB + 内存缓存）
│   │   ├── smart-assistant.ts     # 智能助手
│   │   ├── smart-prompt-engine.ts # 智能提示词引擎
│   │   ├── storyboard-templates.ts # 分镜模板
│   │   ├── task-cleanup.ts       # 超时任务清理
│   │   ├── test-connection.ts     # 连接测试
│   │   ├── url-guard.ts           # SSRF 防护
│   │   └── video-gen.ts          # 视频生成（含轮询）
│   ├── instrumentation.ts    # Next.js  instrumentation
│   └── middleware.ts         # 路由中间件（鉴权）
├── data/                     # 本地数据目录
│   └── settings.json
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## 数据库模型

### Project（项目）

顶层实体，包含整个漫剧项目的元数据。

```prisma
model Project {
  id           String      @id @default(uuid())
  title        String
  description  String?
  genre        String      @default("unknown")   // fantasy/sci-fi/romance/action/comedy/horror/mystery/unknown
  style        String      @default("anime")      // anime/western/chinese/realistic/watercolor
  status       String      @default("draft")      // draft/scripting/storyboarding/producing/completed
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  characters   Character[]
  scripts      Script[]
}
```

### Character（角色）

角色档案，控制角色一致性。

```prisma
model Character {
  id             String  @id @default(uuid())
  name           String
  age            String?
  gender         String?
  personality    String?
  clothing       String?
  appearance     String?
  hair           String?
  eyes           String?
  build          String?
  referenceImg   String?   // 参考图 URL（用于 IP-Adapter）
  expressions    String?   // 表情动作描述
  signaturePose  String?   // 标志动作
  colorScheme    String?   // 主色调
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
}
```

### Script（剧本）

剧本内容，由 AI 生成。

```prisma
model Script {
  id          String       @id @default(uuid())
  outline     String       // 用户输入的故事大纲
  content     String       // AI 生成的剧本（JSON 格式）
  status      String       @default("generating")  // generating/completed/failed
  projectId   String
  project     Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  storyboards Storyboard[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

### Storyboard（分镜）

分镜帧，包含镜头参数、AI 提示词和生成的媒体资源。

```prisma
model Storyboard {
  id               String   @id @default(uuid())
  sceneNum         Int
  title            String?
  description      String
  cameraAngle      String   @default("medium shot")
  emotion          String?
  location         String?
  timeOfDay        String?
  visualKeywords   String?
  charactersInScene String?
  lighting         String?   // 光影方案 key
  composition      String?   // 构图 key
  cameraMovement   String?   // 镜头运动 key
  colorPalette     String?   // 色板 key
  atmosphere       String?   // AI 生成的氛围描述
  dialogue         String?
  imagePrompt      String?
  promptMode       String?  @default("rule")  // rule | smart
  imageUrls        String?   // 生成的图片 URL
  qualityScore     Float?    // 质量评分
  videoUrl         String?   // 视频 URL
  videoTaskId      String?   // Agnes 视频任务 ID
  videoStatus      String?   // queued/in_progress/completed/failed
  duration         Int?      // 镜头时长（秒）
  reviewStatus     String?  @default("pending")  // pending/reviewing/approved/rejected
  scriptId         String
  script           Script   @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  comments         ReviewComment[]
  createdAt        DateTime @default(now())
}
```

### ReviewComment（评审评论）

分镜帧的标注和意见。

```prisma
model ReviewComment {
  id            String   @id @default(uuid())
  storyboardId  String
  storyboard    Storyboard @relation(fields: [storyboardId], references: [id], onDelete: Cascade)
  author        String
  text          String
  annotationX   Float?   // 标注 X 坐标 (0-1 相对位置)
  annotationY   Float?   // 标注 Y 坐标 (0-1 相对位置)
  createdAt     DateTime @default(now())
}
```

### Asset（资源）

存储生成的媒体资源。

```prisma
model Asset {
  id        String   @id @default(uuid())
  type      String
  filePath  String
  url       String?
  projectId String?
  createdAt DateTime @default(now())
}
```

### Setting（设置）

系统配置（存储在数据库，支持运行时修改）。

```prisma
model Setting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Job（异步任务队列）

持久化异步任务队列，解决 fire-and-forget 后台任务在请求结束后丢失的问题。

```prisma
model Job {
  id         String   @id @default(uuid())
  type       String   // 'script' | 'storyboard' | 'image_batch'
  status     String   @default("pending")  // pending/running/completed/failed
  payload    String   // JSON：任务参数
  result     String?  // JSON：结果
  progress   Int      @default(0)
  error      String?
  projectId  String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @default(now())
  startedAt  DateTime?
  finishedAt DateTime?
}
```

### ImageCache（图片生成缓存）

基于 prompt 哈希缓存已生成的图片 URL。

```prisma
model ImageCache {
  id         String   @id @default(uuid())
  promptHash String   @unique   // prompt 的 SHA256 哈希
  prompt     String              // 原始提示词
  imageUrl   String              // 生成的图片 URL
  artStyle   String?             // 风格标签
  score      Float?              // 质量评分
  model      String?             // 使用的模型
  createdAt  DateTime @default(now())
  expiresAt  DateTime?
}
```

---

## 核心模块说明

### 1. Agnes AI 客户端 (`lib/agnes-client.ts`)

封装与 Agnes AI Platform 的交互，支持文本聊天、图片生成、视频生成、流式输出。

**主要函数：**

| 函数 | 说明 |
|------|------|
| `chatCompletion(params)` | 文本对话生成（非流式） |
| `chatCompletionStream(params, onChunk)` | 流式文本生成，返回 `ReadableStream` |
| `generateImage(params)` | 图片生成（含 `character_ref` 角色一致性） |
| `generateVideo(params)` | 视频生成（异步任务，返回 task_id） |
| `getVideoTask(taskId)` | 查询视频任务状态 |

**请求超时配置：**
- 文本生成：90s（流式 120s）
- 图片生成：120s
- 视频生成：180s

**安全特性：**
- API Base URL 校验：DNS 解析 + 私有 IP 检测 + 域名白名单
- API Key 长度验证

---

### 2. 认证模块 (`lib/auth.ts`)

单用户密码登录系统，使用 HttpOnly Cookie 存储 HMAC 签名 session。

**核心函数：**

| 函数 | 说明 |
|------|------|
| `isAuthEnabled()` | 检查是否启用鉴权 |
| `verifyPassword(plain)` | 校验密码（支持明文或 bcrypt hash） |
| `makeSessionToken()` | 生成带过期时间的 HMAC 签名 token |
| `verifySessionToken(token)` | 验证 token 合法性 |
| `getSessionCookieOptions()` | 获取 cookie 配置 |
| `checkAuthFromCookies()` | 从请求 cookie 验证认证状态 |
| `checkApiAuth()` | API 级鉴权检查（返回 `AuthCheckResult`） |

**Session 格式：** `userId.expTime.signature`

**安全特性：**
- 生产环境未配置密钥时默认拒绝所有 API
- 使用 `timingSafeEqual` 防止时序攻击
- 支持 bcrypt 哈希密码

---

### 3. 进度事件总线 (`lib/progress-bus.ts`)

进程内 `EventEmitter`，用于 SSE 实时进度推送。单进程部署够用。

**事件类型：**

```typescript
type ProgressEvent = {
  type: 'script' | 'storyboard' | 'image' | 'video' | 'system';
  id: string;
  status: 'started' | 'progress' | 'completed' | 'failed' | 'connected';
  progress?: number;
  message?: string;
  projectId?: string;
  at: number;
};
```

**核心函数：**
- `progressBus.send(event)` - 发送结构化事件
- `progressBus.subscribe(handler)` - 订阅事件（返回取消函数）
- `emitProgress(event)` - 快捷发送函数

---

### 4. 项目状态机 (`lib/project-status.ts`)

项目状态单向流转：`draft → scripting → storyboarding → producing → completed`

```typescript
const PROJECT_STATUS = {
  DRAFT: 'draft',
  SCRIPTING: 'scripting',
  STORYBOARDING: 'storyboarding',
  PRODUCING: 'producing',
  COMPLETED: 'completed',
};
```

**核心函数：** `updateProjectStatus(projectId, target)` - 安全更新状态（不倒退）

---

### 5. 异步任务队列 (`lib/job-queue.ts`)

基于 SQLite 的进程内 worker，解决 HTTP 响应结束后后台任务丢失的问题。

**设计要点：**
- 任务记录持久化到 Job 表，状态机：`pending → running → completed/failed`
- 进程内 worker 轮询 DB（每 2s），串行消费
- 首次入队时自动启动 worker；定时器 `unref()` 避免阻塞进程退出
- 心跳机制：running 期间每 30s 更新 `updatedAt`
- 崩溃恢复：worker 启动时扫描遗留 running Job，标记 failed

**核心函数：**

| 函数 | 说明 |
|------|------|
| `registerJobHandler(type, handler)` | 注册任务处理器 |
| `enqueueJob(type, payload, projectId)` | 入队，返回 Job 记录 |
| `ensureWorkerStarted()` | 启动 worker（幂等） |
| `cleanupStaleJobs(timeoutMin)` | 清理超时 running Job |
| `isWorkerStarted()` | 查询 worker 状态 |

**Job Handler 注册：** `src/lib/jobs/index.ts` 统一导入 `generate-script.ts` 和 `generate-storyboards.ts`

---

### 6. 剧本解析 (`lib/script-parser.ts`)

将剧本内容解析为分镜数组，支持多种格式。

**核心函数：** `parseScriptToStoryboards(rawContent)` → `StoryboardFrame[]`

**解析字段：** `scene_number`, `title`, `location`, `time_of_day`, `description`, `camera_angle`, `emotion`, `dialogue`, `visual_keywords`, `characters_in_scene`, `weather`, `act_num`

**解析路径（三路）：**
1. **直接 JSON**：尝试解析 `acts[].scenes[]` 或 `scenes[]`
2. **AI 提取**：无法解析时调用 LLM 提取
3. **正则解析**：正则提取 `场景X:` 或 `Scene X:` 格式的文本

---

### 7. 角色提示词构建 (`lib/character-prompt.ts`)

构建图片生成提示词，实现角色一致性控制。

**核心类型：**

```typescript
interface CharacterSheet {
  name: string;       age: string;       gender: string;
  face: string;       hair: string;       eyes: string;
  skin: string;       body: string;
  signature_look: string;  // 标志外观
  outfit_main: string;       outfit_accessories: string;
  personality: string;
  referenceImages: string[];
  englishDescription: string;
}
```

**核心函数：**

| 函数 | 说明 |
|------|------|
| `buildCharacterSheet(character)` | 转换为标准 Character Sheet |
| `buildCharacterReferencePrompt(sheet, styleKey)` | IP-Adapter 风格角色参考提示词 |
| `enrichImagePrompt(input)` | 组合完整分镜图片提示词 |
| `buildCharacterConsistencyInstructions(characters)` | 剧本生成用角色一致性指令 |
| `buildCharacterPortraitPrompt(sheet, styleKey)` | 角色定妆照提示词 |
| `buildNegativePrompt()` | 负向提示词 |

**约束：** 最大提示词长度 2500 字符

---

### 8. 提示词库 (`lib/prompt-library.ts`)

专业 AI 漫剧提示词库，包含镜头语言、情绪氛围、艺术风格、光影方案、构图规则、色板等。

**常量映射：**

| 常量 | 说明 |
|------|------|
| `CAMERA_ANGLES` | 镜头角度库（18 种：ECU/close_up/medium_shot/POV/low_angle 等） |
| `EMOTION_TONES` | 情绪氛围库（20 种：romantic/tense/mysterious/epic 等） |
| `ART_STYLES` | 艺术风格库（20 种：anime/realistic/cyberpunk/ghibli 等） |
| `LIGHTING_SCHEMES` | 光影方案库（16 种：golden_hour/backlit/neon 等） |
| `COMPOSITION_RULES` | 构图规则库（12 种：rule_of_thirds/golden_ratio/symmetry 等） |
| `COLOR_PALETTES` | 色板库（10 种：warm_amber/cool_blue/neon 等） |
| `CAMERA_MOVEMENT` | 镜头运动库（10 种：static/tracking/crane 等） |
| `GENRE_TONES` | 题材基调库 |
| `QUALITY_TAGS` | 质量标签（base/face/composition/lighting/color/depth） |
| `SCRIPT_PROMPTS` | 剧本生成提示词模板 |

**智能推断函数：**

| 函数 | 说明 |
|------|------|
| `inferCameraAngle(rawHint)` | 从中文/英文提示词推断镜头角度 |
| `inferEmotion(rawEmotion)` | 推断情绪氛围 |
| `inferArtStyle(rawStyle)` | 推断艺术风格 |
| `inferLighting(rawHint)` | 推断光影方案 |
| `inferComposition(rawHint)` | 推断构图规则 |
| `inferColorPalette(rawHint)` | 推断色板 |
| `inferCameraMovement(rawHint)` | 推断镜头运动 |
| `normalizeCameraKey(raw)` | 从存储值恢复标准 key |
| `normalizeEmotionKey(raw)` | 同上 |
| `normalizeStyleKey(raw)` | 同上 |

---

### 9. 设置管理 (`lib/settings.ts`)

数据库 + 环境变量两层配置优先，带内存缓存（30s TTL）。

**核心函数：**

| 函数 | 说明 |
|------|------|
| `getSettings()` | 获取所有设置（数据库） |
| `getPublicSettings()` | 面向客户端（移除敏感字段，掩码 API Key） |
| `getSetting(key)` | 获取单个设置（缓存优先） |
| `saveSettings(settings)` | 批量保存设置（upsert） |

**默认值：**

```typescript
AGNES_API_BASE: 'https://apihub.agnes-ai.com/v1'
AGNES_TEXT_MODEL: 'agnes-2.0-flash'
AGNES_IMAGE_MODEL: 'agnes-image-2.1-flash'
AGNES_VIDEO_MODEL: 'agnes-video-v2.0'
```

---

### 10. 带重试的 Fetch (`lib/fetch-with-retry.ts`)

封装 fetch，支持超时和指数退避重试。

**配置项：**
- `timeoutMs`：请求超时（默认 60s）
- `maxRetries`：最大重试次数（默认 3）
- `baseDelayMs`：基础延迟（默认 1s）
- `retryOn`：需重试的状态码 `[408, 425, 429, 500, 502, 503, 504]`

**重试策略：** 指数退避 + 随机抖动（避免惊群效应）

---

### 11. 并发池 (`lib/concurrency-pool.ts`)

滑动窗口模式并发控制，限制同时执行的任务数。

**函数：** `runWithConcurrencyPool(items, concurrency, processor, onProgress)`

一个任务完成立即启动下一个，不被慢任务阻塞。

---

### 12. 图片生成 (`lib/image-gen.ts`)

分镜图片生成，含 Character Sheet 标准化、IP-Adapter 风格锁、缓存、评估、重试。

**核心函数：** `generateStoryboardImage(options)` → `GenerateImageResult`

**流程：**
1. 角色一致性控制（参考图 URL + Character Sheet）
2. 缓存查询（SHA256 哈希）
3. 构建高质量提示词（`enrichImagePrompt`）
4. 调用 Agnes Image API（最多 `maxRetries` 次）
5. 质量评估 + 达标判断（阈值可配置）
6. 角色一致性专项评估
7. 保存到缓存和数据库

**缓存策略：** prompt 哈希命中则直接返回（免费 API 无成本）

---

### 13. 图片质量评估 (`lib/image-eval.ts`)

基于 AI 的图片质量评估系统，免费 API 可放心调用。

**评估维度（加权）：**
- `visual_quality` (25%)：清晰度、噪点、完整性
- `content_match` (30%)：描述与画面一致性
- `character_consistency` (25%)：角色一致性
- `composition` (20%)：构图、镜头语言、风格

**函数：**

| 函数 | 说明 |
|------|------|
| `evaluateImage(opts)` | 四维度图片质量评估 |
| `evaluateCharacterConsistency(opts)` | 角色一致性专项评分 |

---

### 14. 视频生成 (`lib/video-gen.ts`)

分镜视频生成，调用 Agnes Video API（异步任务模式）。

**核心函数：**

| 函数 | 说明 |
|------|------|
| `generateStoryboardVideo(options)` | 创建视频任务，返回 task_id |
| `pollVideoTask(taskId)` | 轮询视频任务状态 |
| `syncStoryboardVideo(storyboardId)` | 同步分镜视频状态 |

---

### 15. 智能场景构建器 (`lib/scene-builder.ts`)

从简短描述生成完整场景设定，支持场景序列规划。

**核心函数：**

| 函数 | 说明 |
|------|------|
| `buildScene(seed)` | 从简短描述生成完整场景设定 → `SceneResult` |
| `suggestSceneFlow(params)` | 从故事情节生成场景序列 → `SceneFlowResult` |
| `expandSceneDetail(params)` | 对已有场景进行细节扩展 |

---

### 16. 任务清理 (`lib/cleanup-scheduler.ts`, `lib/task-cleanup.ts`)

后台定时清理超时任务（超过 15 分钟停留在 running 状态）。

**核心函数：**
- `startCleanupScheduler()` - 启动调度器（首次延迟 30s，之后每 5 分钟）
- `cleanupStaleJobs(timeoutMin)` - 重置超时 Job 状态为 failed
- `cleanupStaleScripts(timeoutMin)` - 重置超时 Script 状态为 failed

---

### 17. Prisma 客户端 (`lib/prisma-client.ts`)

Prisma 单例模式，开发环境避免热更新重复创建连接。

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

### 18. URL 防护 (`lib/url-guard.ts`)

SSRF 防护：校验外部 API 地址和图片 URL 安全。

**策略：**
- **API 地址**：协议白名单（https） + 域名后缀白名单（`*.agnes-ai.com`） + DNS 解析验证（拒绝私有 IP）
- **图片 URL**：协议校验 + 字面量内网 IP 拒绝（不做 DNS 解析）

**函数：**

| 函数 | 说明 |
|------|------|
| `isAllowedApiBase(raw)` | 主校验入口（用于 Agnes API） |
| `isSafeExternalUrl(raw)` | 轻量校验（用于参考图 URL） |

---

## API 端点

### 认证 `/api/auth/*`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录（密码校验 + 签发 session cookie） |
| POST | `/api/auth/logout` | 登出（清除 session cookie） |
| GET | `/api/auth/status` | 查询认证状态 |

**登录请求体：** `{ "password": "xxx" }`

---

### 项目管理 `/api/projects`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 获取所有项目（按 updatedAt 倒序） |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/[id]` | 获取单个项目 |
| PATCH | `/api/projects/[id]` | 更新项目 |
| DELETE | `/api/projects/[id]` | 删除项目 |

**创建项目请求体：**

```json
{
  "title": "项目标题（必填，最多100字符）",
  "genre": "fantasy|fantasy/sci-fi/romance/action/comedy/horror/mystery/unknown",
  "style": "anime|western/chinese/realistic/watercolor",
  "description": "可选描述（最多1000字符）"
}
```

---

### 角色管理 `/api/characters`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/characters` | 获取角色列表 |
| POST | `/api/characters` | 创建角色 |
| POST | `/api/characters/generate` | AI 生成角色 |
| POST | `/api/characters/generate-cast` | 批量生成角色卡 |
| GET | `/api/characters/[id]` | 获取单个角色 |
| PATCH | `/api/characters/[id]` | 更新角色 |
| DELETE | `/api/characters/[id]` | 删除角色 |
| POST | `/api/characters/[id]/generate-image` | 生成分镜图片 |
| GET | `/api/characters/ai-suggest` | AI 角色建议 |

---

### 剧本管理 `/api/scripts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scripts` | 获取剧本列表（支持 `?projectId` 过滤） |
| POST | `/api/scripts` | AI 生成剧本（异步 Job 队列或流式） |
| GET | `/api/scripts/[id]` | 获取单个剧本 |
| DELETE | `/api/scripts/[id]` | 删除剧本 |

**生成剧本请求体：**

```json
{
  "projectId": "项目ID（必填）",
  "outline": "故事大纲（必填，最多5000字符）"
}
```

**查询参数：** `?stream=true` 启用流式生成（`text/event-stream`）

**返回：** HTTP 202（Job 队列模式）或 HTTP 200 + SSE（流式模式）

---

### 分镜管理 `/api/storyboards`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/storyboards` | 获取分镜（支持 `?projectId` 或 `?scriptId` 过滤） |
| POST | `/api/storyboards` | AI 生成分镜（异步 Job 队列） |
| GET | `/api/storyboards/[id]` | 获取单个分镜 |
| DELETE | `/api/storyboards/[id]` | 删除分镜 |

**生成分镜请求体：**

```json
{
  "scriptId": "剧本ID（必填）",
  "projectId": "项目ID（必填）"
}
```

---

### Agnes AI 集成 `/api/agnes/*`

#### 聊天 `/api/agnes/chat`

```json
POST
{ "messages": [{ "role": "user|system|assistant", "content": "..." }] }
```

#### 图片生成 `/api/agnes/image`

```json
POST
{
  "storyboardId": "分镜ID",
  "prompt": "图片提示词",
  "size": "512x512|768x768|1024x1024|1024x1792|1792x1024",
  "n": 1
}
```

#### 批量图片生成 `/api/agnes/image/batch`

```json
POST
{
  "storyboardIds": ["id1", "id2", ...]  // 最多20个
}
```

返回：`batchId`（通过 SSE 推送进度）

#### 视频生成 `/api/agnes/video`

```json
POST
{
  "prompt": "视频描述",
  "images": ["图片URL数组"],
  "duration": 5,
  "transitions": ["fade"]
}
```

#### 视频任务查询 `/api/agnes/video/task/[id]`

```json
GET
→ { "taskId": "...", "status": "queued|in_progress|completed|failed", "videoUrl": "..." }
```

---

### 场景管理 `/api/scenes`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/scenes/build` | 智能构建场景 |
| POST | `/api/scenes/reorder` | 批量重排场景顺序 |

---

### 导演 `/api/director`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/director/analyze` | AI 分析场景 |
| GET | `/api/director/scenes` | 获取场景分析结果 |

---

### 评审 `/api/review`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/review/status` | 获取分镜评审状态 |
| POST | `/api/review/comments` | 添加评审评论 |

---

### 发布 `/api/publish`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/publish/export` | 导出项目 |

---

### 进度推送 `/api/progress/stream`

SSE 端点，客户端通过 `EventSource` 订阅。

**查询参数：**
- `projectId` - 项目级订阅
- `resourceId` - 单资源订阅（script/storyboard）

**事件格式（SSE）：**

```
event: progress
data: {"type":"script","id":"...","status":"progress","progress":50,"message":"..."}
```

---

### 智能提示词 `/api/storyboards/smart-prompt`

```json
POST
{
  "storyboardId": "分镜ID",
  "sceneDescription": "场景描述",
  "characters": ["角色列表"],
  "style": "风格"
}
```

---

### 语音 `/api/voice`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/voice/generate` | 生成语音 |
| GET | `/api/voice/lines` | 获取台词列表 |

---

### 设置 `/api/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取公开设置（API Key 已掩码） |
| POST | `/api/settings` | 保存设置（仅白名单 key） |
| GET | `/api/settings/test` | 测试连接（Agnes API） |

---

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页 - 创建项目 |
| `/login` | 登录页 |
| `/dashboard` | 仪表盘 - 数据统计 |
| `/dashboard/characters` | 角色管理 |
| `/dashboard/projects` | 项目列表 |
| `/dashboard/projects/[id]` | 项目详情 |
| `/dashboard/projects/[id]/director` | 导演模式 - 场景分析与构建 |
| `/dashboard/projects/[id]/review` | 评审模式 - 分镜审核评论 |
| `/dashboard/projects/[id]/timeline` | 时间线模式 |
| `/dashboard/projects/[id]/voice` | 语音生成 |
| `/dashboard/projects/[id]/publish` | 发布导出 |
| `/dashboard/settings` | 系统设置 |

---

## 中间件与安全

### 鉴权中间件 (`middleware.ts`)

**鉴权逻辑：**
1. 公开路径放行：`/login`, `/_next/*`, `/favicon.ico`, `/api/auth/*`
2. 生产环境未配置密钥：默认拒绝所有 API（返回 503）
3. 启用鉴权后：无 session cookie 时，API 返回 401 JSON，页面重定向到 `/login`
4. `next` 参数安全化：过滤 `//`, `/\`, `/$:`, 换行符等

### SSRF 防护 (`lib/url-guard.ts`)

- Agnes API：DNS 解析 + 私有 IP 检测 + 域名白名单（`*.agnes-ai.com`）
- 参考图 URL：协议校验 + 字面量拒绝

### 会话安全

- HttpOnly Cookie：防止 XSS 窃取
- HMAC-SHA256 签名：防篡改
- `timingSafeEqual`：防时序攻击
- 7 天过期

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AGNES_API_BASE` | Agnes AI API 地址 | `https://apihub.agnes-ai.com/v1` |
| `AGNES_API_KEY` | API Key | **必填** |
| `AGNES_TEXT_MODEL` | 文本模型 | `agnes-2.0-flash` |
| `AGNES_IMAGE_MODEL` | 图像模型 | `agnes-image-2.1-flash` |
| `AGNES_VIDEO_MODEL` | 视频模型 | `agnes-video-v2.0` |
| `AUTH_PASSWORD` | 登录密码（设置后启用鉴权） | - |
| `AUTH_PASSWORD_HASH` | bcrypt 哈希密码（优先于明文） | - |
| `AUTH_SECRET` | Cookie 签名密钥（生产环境建议） | `AUTH_PASSWORD` |
| `NODE_ENV` | 运行环境 | `development` |
| `DATA_DIR` | 本地数据目录 | `./data` |

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                         Pages                                 │
│          (page.tsx, dashboard/*, login/*)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ fetch API
┌───────────────────────────▼─────────────────────────────────┐
│                      API Routes                               │
│  (projects, characters, scripts, storyboards, agnes/*, etc.)  │
└───────────────────────────┬─────────────────────────────────┘
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
      ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│   Prisma     │    │  Agnes AI    │    │   Progress Bus   │
│   Client     │    │   Client     │    │   (EventEmitter) │
└──────┬───────┘    └──────┬───────┘    └────────┬─────────┘
       │                   │                     │
       ▼                   ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│   SQLite     │    │ Agnes API    │    │  SSE Stream      │
│   (dev.db)   │    │ (External)   │    │  (实时推送)       │
└──────────────┘    └──────────────┘    └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Shared Libs                               │
│  auth.ts           │  settings.ts      │  project-status.ts │
│  script-parser.ts   │  character-prompt.ts                    │
│  prompt-library.ts  │  fetch-with-retry.ts                    │
│  cleanup-scheduler.ts│  url-guard.ts    │  job-queue.ts      │
│  image-gen.ts       │  video-gen.ts    │  scene-builder.ts  │
│  image-eval.ts      │  concurrency-pool.ts                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Job Worker (进程内)                          │
│   generate-script.ts  │  generate-storyboards.ts              │
│   (注册到 job-queue，由 worker 轮询调度)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 项目运行方式

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 AGNES_API_KEY 和 AUTH_PASSWORD

# 3. 初始化数据库
npm run db_init
# 或 npx prisma db push

# 4. 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止
docker-compose down
```

### 数据库管理

```bash
npm run db_studio   # 打开 Prisma Studio（浏览器可视化）
npm run db_init     # 同步 schema 到数据库
npm run build       # 生产构建
npm run start       # 启动生产服务器
npm run lint        # 代码检查
```

### 常用脚本

```bash
# Docker 手动构建
docker build -t ai-comic-drama .

# 进入容器
docker run -it ai-comic-drama /bin/sh
```

---

## 主要流程

### 1. 创建漫剧流程

```
1. 创建项目 (title, genre, style)
      ↓
2. 添加角色 (name, age, gender, personality, clothing, referenceImg)
      ↓
3. 输入故事大纲，AI 生成剧本 (Agnes Text Model, 流式预览)
      ↓
4. AI 从剧本提取分镜 (Storyboard，多路径解析：JSON/AI/正则)
      ↓
5. AI 生成分镜图片 (Agnes Image Model, 角色一致性 + 缓存 + 评估)
      ↓
6. AI 合成视频 (Agnes Video Model, 异步任务 + 轮询)
      ↓
7. 项目完成
```

### 2. 实时进度推送

```
前端：new EventSource('/api/progress/stream?projectId=xxx')
      ↓
后端：SSE 路由订阅 progressBus 事件
      ↓
事件触发点：
  - scripts/route.ts: 流式生成 + Job 队列
  - storyboards/route.ts: Job 队列
  - agnes/image/batch/route.ts: 批量图片并发生成
  - job-queue.ts: 崩溃恢复 + 超时清理
      ↓
前端：根据 progress 事件更新 UI
```

### 3. 异步任务队列（Job Worker）

```
1. API 路由调用 enqueueJob('script', payload, projectId)
      ↓
2. Job 表写入 pending 记录
      ↓
3. Worker 启动（首次入队时触发，幂等）
      ↓
4. Worker tick（每 2s 轮询）：
   a. 原子抢占一个 pending Job（状态 → running）
   b. 调用注册的 handler
   c. handler 通过 setProgress() 更新进度和心跳
   d. 完成：status → completed
   e. 失败：status → failed + error 消息
      ↓
5. cleanup-scheduler（每 5 分钟）：
   a. 查找 updatedAt 超过 15 分钟且 status='running' 的 Job
   b. 标记为 failed + emitProgress 通知前端
```

### 4. 图片生成流程（单个分镜）

```
1. generateStoryboardImage(storyboardId)
      ↓
2. 查询 storyboard + project + characters
      ↓
3. 构建 Character Sheet（标准化角色描述）
      ↓
4. 缓存查询（SHA256(prompt|style|size)）
   → 命中：直接返回
      ↓
5. 构建高质量提示词（enrichImagePrompt）
   → 镜头角度 + 场景描述 + 角色一致性 + 情绪氛围 + 艺术风格 + 质量标签
      ↓
6. 调用 Agnes Image API（最多 maxRetries=4 次）
      ↓
7. 质量评估（evaluateImage）
   → 达标（score >= threshold）：保存
   → 不达标：带上改进建议重试
      ↓
8. 角色一致性评估（evaluateCharacterConsistency）
      ↓
9. 保存到 ImageCache + 更新 storyboard.imageUrls
      ↓
10. 返回 { imageUrl, score, attempts, characterConsistency }
```

### 5. 崩溃恢复流程

```
进程启动（workerState.started = false）
      ↓
ensureWorkerStarted()
      ↓
recoverStaleRunningJobs()：
  扫描所有 status='running' 的 Job
      ↓
标记为 failed + emitProgress('failed', 'Worker crashed before completion')
      ↓
启动轮询 + 心跳定时器（unref，不阻塞进程退出）
```
