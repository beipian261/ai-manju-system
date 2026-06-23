# AI 漫剧系统 — 业务流程架构白皮书

> 面向"一人短剧工作室"的全流程 AI 漫剧生成平台。从故事大纲到成片，全链路自动化。

---

## 目录

1. [整体业务流程设计](#1-整体业务流程设计)
2. [核心流程步骤划分](#2-核心流程步骤划分)
3. [功能模块逻辑关联](#3-功能模块逻辑关联)
4. [数据流转方式](#4-数据流转方式)
5. [用户交互路径](#5-用户交互路径)
6. [业务规则与边界条件](#6-业务规则与边界条件)

---

## 1. 整体业务流程设计

### 1.1 设计哲学

系统遵循 **"创作流水线"** 范式——模仿传统动画/漫画工作室的工作流程，将人工创作的每个环节替换为 AI 驱动的自动化步骤。核心设计原则：

| 原则 | 说明 |
|------|------|
| **单向流转** | 项目状态只进不退（draft → scripting → storyboarding → producing → completed），防止流程回退导致数据不一致 |
| **异步解耦** | 长耗时 AI 任务（剧本生成、批量生图）通过 Job Queue 解耦，HTTP 请求立即返回 202，前端通过 SSE 订阅进度 |
| **角色一致性锁** | 所有分镜图片生成时自动注入 Character Sheet + IP-Adapter 参考图，确保同一角色在不同分镜中视觉统一 |
| **质量闭环** | 图片生成 → 四维度评估 → 不达标自动重试（带改进建议），形成自愈式质量保证 |
| **免费 API 激进策略** | 依赖 Agnes AI 免费额度，对 AI 调用不做成本限制，宁可多调几次保证质量 |

### 1.2 端到端流水线

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Phase 1 │───→│  Phase 2 │───→│  Phase 3 │───→│  Phase 4 │───→│  Phase 5 │───→│  Phase 6 │
│ 项目创建  │    │ 角色设计  │    │ 剧本生成  │    │ 分镜提取  │    │ 图片生成  │    │ 视频/导出 │
│  draft   │    │  draft   │    │scripting │    │storboard │    │producing │    │completed │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   手动输入        手动+AI         AI 驱动         AI 驱动         AI 驱动         AI 驱动
```

---

## 2. 核心流程步骤划分

### Phase 1：项目创建（手动输入）

**目标**：建立创作上下文容器。

| 步骤 | 操作 | 输入 | 输出 | 关键校验 |
|------|------|------|------|----------|
| 1.1 | 创建项目 | title (≤100字), genre, style, description (≤1000字) | Project 记录 (status=draft) | title 非空；genre ∈ 8个枚举值；style ∈ 5个枚举值 |
| 1.2 | 配置 AI | AGNES_API_KEY, AGNES_API_BASE | Setting 记录 | API Key 长度 ≥ 20；API Base 通过 SSRF 校验（DNS + 私有IP + 白名单） |

**genre 枚举**：`fantasy | sci-fi | romance | action | comedy | horror | mystery | unknown`

**style 枚举**：`anime | western | chinese | realistic | watercolor`

**边界条件**：
- API Base URL 必须为 HTTPS，且仅允许 `*.agnes-ai.com` 域名后缀
- 生产环境未配置 AUTH_PASSWORD 时，所有 API 默认拒绝（防止裸奔）

---

### Phase 2：角色设计（手动 + AI 辅助）

**目标**：建立角色 DNA，确保后续生成的角色一致性。

| 步骤 | 操作 | 触发方式 | 关键数据 |
|------|------|----------|----------|
| 2.1 | 手动创建角色 | 用户填写表单 | name, age, gender, personality, clothing, appearance, hair, eyes, build, referenceImg |
| 2.2 | AI 批量生成角色卡 | `POST /api/characters/generate-cast` | 调用 Agnes Text Model，基于大纲 + 风格生成 2-6 个角色 |
| 2.3 | AI 角色建议 | `GET /api/characters/ai-suggest` | 基于已有角色 + 大纲建议缺失角色 |
| 2.4 | 生成角色定妆照 | `POST /api/characters/[id]/generate-image` | 调用 Agnes Image Model 生成参考图 |
| 2.5 | 锁定角色 DNA | 用户手动标记 `dnaLocked=true` | 锁定后所有分镜生图强制注入该角色全部参考图 |

**角色 DNA 资产体系**（`CharacterAsset`）：

| 资产类型 | 说明 | 用途 |
|----------|------|------|
| `front` | 正面参考图 | 角色面部一致性 |
| `side` | 侧面参考图 | 侧面镜头 |
| `fullbody` | 全身参考图 | 全身镜头 |
| `expression` | 表情参考图（多张） | 情绪变化场景 |
| `outfit` | 服装参考图（多张） | 换装场景 |
| `custom` | 自定义参考图 | 特殊场景 |

**边界条件**：
- 锁定角色前至少需要 1 张主参考图（`isPrimary=true`）
- 角色提示词最大长度 **2500 字符**（IP-Adapter 限制）
- 参考图 URL 强制 HTTPS（已修复 `isSafeExternalUrl` 安全漏洞）

---

### Phase 3：剧本生成（AI 驱动，异步 Job）

**目标**：从故事大纲生成完整剧本 JSON。

```
用户提交大纲 → API 创建 Job → 立即返回 202
                                    ↓
                              Worker 轮询消费
                                    ↓
                              Agnes Text Model 生成
                              （流式：SSE 逐字推送）
                                    ↓
                              Script 表写入 content
                              项目状态 → scripting
```

| 步骤 | 详情 |
|------|------|
| 3.1 | 用户输入大纲（≤5000字），调用 `POST /api/scripts` |
| 3.2 | 系统创建 Job（type='script', status='pending'），返回 202 + jobId |
| 3.3 | Worker 消费：调用 `chatCompletion` / `chatCompletionStream` |
| 3.4 | 剧本生成（含角色一致性指令注入） |
| 3.5 | 完成后 Script.status → 'completed'，Project.status → 'scripting' |
| 3.6 | SSE 推送进度（每 20% 更新一次，流式模式逐字符推送） |

**两种模式**：

| 模式 | 触发参数 | 适用场景 | 超时 |
|------|----------|----------|------|
| Job 队列 | 默认 | 长剧本，用户可离开页面 | 无限制（异步） |
| 流式 SSE | `?stream=true` | 短剧本，用户实时预览 | 120s |

**边界条件**：
- 大纲最大 5000 字符
- 文本生成超时 90s（流式 120s），内部重试 2 次
- Job 超时 15 分钟无心跳 → 标记 failed
- 进程崩溃恢复：遗留 running Job → 标记 failed + emitProgress

---

### Phase 4：分镜提取（AI 多路径解析）

**目标**：从剧本内容提取分镜帧列表，每帧包含完整镜头参数。

| 步骤 | 详情 |
|------|------|
| 4.1 | 调用 `POST /api/storyboards`（传入 scriptId + projectId） |
| 4.2 | 系统创建 Job（type='storyboard'），返回 202 |
| 4.3 | Worker 消费：调用 `parseScriptToStoryboards(rawContent)` |
| 4.4 | 分镜写入 Storyboard 表（每帧一条记录） |
| 4.5 | 完成后 Project.status → 'storyboarding' |

**三路解析策略**（`script-parser.ts`）：

```
剧本内容
  │
  ├── 路径 1：直接 JSON 解析
  │   尝试 JSON.parse，查找 acts[].scenes[] 或 scenes[]
  │   → 成功：直接映射 StoryboardFrame[]
  │
  ├── 路径 2：AI 提取（LLM）
  │   调用 chatCompletion，指示模型从文本提取结构化分镜
  │   → 成功：解析 AI 返回的 JSON
  │
  └── 路径 3：正则提取（兜底）
      正则匹配 "场景X:"、"Scene X:"、"第X幕" 等中文/英文/日文格式
      → 最低保障
```

**单帧分镜字段**：

| 字段 | 说明 | 来源 |
|------|------|------|
| sceneNum | 场景序号 | 自动递增 |
| title | 标题 | 解析 |
| description | 场景描述 | 解析 |
| cameraAngle | 镜头角度 | 解析 + 推断（18种） |
| emotion | 情绪氛围 | 解析 + 推断（20种） |
| location | 地点 | 解析 |
| timeOfDay | 时段 | 解析 |
| lighting | 光影方案 | 推断（16种） |
| composition | 构图 | 推断（12种） |
| cameraMovement | 镜头运动 | 推断（10种） |
| colorPalette | 色板 | 推断（10种） |
| dialogue | 台词 | 解析 |
| charactersInScene | 出场角色 | 解析 |

**边界条件**：
- 正则路径提取不到任何分镜 → 尝试文本分段兜底（每 500 字一段）
- 所有路径均失败 → Job 标记 failed，emitProgress 通知前端

---

### Phase 5：分镜图片生成（AI 驱动，批量并发）

**目标**：为每个分镜帧生成高质量图片，保证角色一致性。

这是系统**最复杂的环节**，涉及多个子系统的协同：

```
POST /api/agnes/image/batch
  │
  ├── storyboardIds[] (最多 20 个)
  │
  ▼
runWithConcurrencyPool (concurrency=3, taskTimeout=60s)
  │
  ├── Task 1 ─→ generateStoryboardImage(storyboard_1)
  ├── Task 2 ─→ generateStoryboardImage(storyboard_2)
  ├── Task 3 ─→ generateStoryboardImage(storyboard_3)
  │            │
  │            └── [完成] → 自动启动 Task 4（滑动窗口）
  │
  ▼
SSE 推送进度：completed/total, failed count
```

**单帧图片生成内部流程**（`image-gen.ts`）：

```
1. 查询 DB → storyboard + project + characters
2. 构建 Character Sheet → 标准化角色描述
3. 缓存查询 → SHA256(prompt|style|size) → 命中则直接返回
4. 构建高质量提示词 → enrichImagePrompt
   ├── 镜头角度描述
   ├── 场景描述
   ├── 角色一致性（Character Sheet + IP-Adapter referenceImages）
   ├── 情绪氛围
   ├── 艺术风格
   ├── 光影方案
   ├── 构图规则 + 镜头运动 + 色板
   └── 质量标签（base / face / composition / lighting / color / depth）
5. 调用 Agnes Image API → 最多 maxRetries=4 次
6. 质量评估 → evaluateImage (4维度加权)
   ├── 达标 (score ≥ threshold) → 保存
   └── 不达标 → 带改进建议重试
7. 角色一致性评估 → evaluateCharacterConsistency
8. 保存 ImageCache + 更新 storyboard.imageUrls
```

**质量评估四维度**（`image-eval.ts`）：

| 维度 | 权重 | 评估内容 |
|------|------|----------|
| content_match | 30% | 描述与画面内容一致性 |
| visual_quality | 25% | 清晰度、噪点、完整性、畸形检测 |
| character_consistency | 25% | 角色外观与 Character Sheet 一致性 |
| composition | 20% | 构图、镜头语言、风格匹配 |

**边界条件**：
- 批量生图最多 20 帧/次
- 并发生图上限 3（`BATCH_CONCURRENCY=3`）
- 单帧内部重试上限 4 次（`maxRetries=4`）
- 单帧任务超时 60s（并发池级别），内部 API 超时 120s
- 默认质量阈值 60 分，可在设置中调整
- 哈希缓存基于 SHA-256，碰撞概率低于 2^-128
- 角色一致性评估阈值 50 分（更宽松）

---

### Phase 6：视频生成与发布

**目标**：将分镜图片合成为动态视频，导出成品。

| 步骤 | 操作 | 关键 API |
|------|------|----------|
| 6.1 | 提交视频任务 | `POST /api/agnes/video` → 返回 taskId |
| 6.2 | 轮询任务状态 | `GET /api/agnes/video/task/[id]` → 每 5s 轮询 |
| 6.3 | 同步分镜状态 | `video-gen.ts` 更新 storyboard.videoStatus/videoUrl |
| 6.4 | 评审审核 | 导演模式逐帧审核 → 标注问题 → 重新生成 |
| 6.5 | 发布导出 | `POST /api/publish/export` → 打包导出 |

**视频生成参数**：
- duration：镜头时长（秒）
- images：图片 URL 数组（关键帧）
- transitions：转场效果（fade 等）
- 视频任务超时 180s，轮询最多 60 次

**边界条件**：
- 视频任务为异步模式（Agnes Video API），不等待完成即返回
- 轮询间隔 5s，最长等待 300s
- 若轮询超时仍 pending → 标记 failed

---

## 3. 功能模块逻辑关联

### 3.1 模块依赖拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端页面层                                │
│  login → dashboard → characters → projects → director           │
│  → review → timeline → voice → publish → settings               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch / EventSource
┌───────────────────────────▼─────────────────────────────────────┐
│                        API 路由层 (58 端点)                       │
│  auth/* | projects/* | characters/* | scripts/* |               │
│  storyboards/* | agnes/* | director/* | review/* |              │
│  publish/* | voice/* | progress/* | settings/*                  │
└───┬───────┬───────┬───────┬───────┬───────┬─────────────────────┘
    │       │       │       │       │       │
    ▼       ▼       ▼       ▼       ▼       ▼
┌───────┐┌──────┐┌───────┐┌───────┐┌───────┐┌──────────┐
│Auth   ││Prisma││Job    ││Agnes  ││Progress││URL Guard │
│Module ││Client││Queue  ││Client ││Bus     ││(SSRF)    │
└───┬───┘└──┬───┘└───┬───┘└───┬───┘└───┬───┘└──────────┘
    │       │       │       │       │
    ▼       ▼       ▼       ▼       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        基础服务层                                  │
│  SQLite DB  │  Agnes AI Platform  │  SSE Stream  │  Settings    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 关键模块耦合说明

| 模块 A | 模块 B | 耦合方式 | 说明 |
|--------|--------|----------|------|
| API Routes | Auth | 同步调用 `checkApiAuth()` | 55/58 个路由启用鉴权，3 个公开（login/logout/progress） |
| API Routes | Job Queue | 异步 `enqueueJob()` | 剧本生成、分镜生成立即返回 202，后台消费 |
| Job Queue | Progress Bus | `emitProgress()` | Worker 执行中通过总线推送进度 |
| Progress Bus | SSE Route | EventEmitter.subscribe | 前端 EventSource 订阅，实时接收 |
| Image Gen | Character Prompt | `buildCharacterSheet()` | 从角色数据构建 IP-Adapter 参考 |
| Image Gen | Prompt Library | `enrichImagePrompt()` | 组合镜头/情绪/光影/构图描述 |
| Image Gen | Image Cache | SHA-256 lookup | 命中缓存跳过 API 调用 |
| Image Gen | Image Eval | `evaluateImage()` | 质量不达标则触发重试 |
| Video Gen | Agnes Client | `generateVideo()` + `getVideoTask()` | 异步提交 + 轮询状态 |
| Cleanup | Job Queue | `cleanupStaleJobs()` | 定时清理超时 running Job |
| Middleware | Auth | `checkAuthFromCookies()` | 页面级重定向 + API 级 401 |

### 3.3 松耦合设计

| 设计模式 | 应用位置 | 效果 |
|----------|----------|------|
| Handler 注册 | `registerJobHandler(type, handler)` | 新增 Job 类型无需改 worker 代码 |
| Event Emitter | Progress Bus | 进度事件与消费端完全解耦 |
| Settings KV | `getSetting(key)` | AI 模型配置热更新，无需重启 |
| Strategy Pattern | Script Parser 三路 | 新增解析策略无需改入口逻辑 |
| Sliding Window Pool | Concurrency Pool | 慢任务不阻塞快任务 |

---

## 4. 数据流转方式

### 4.1 数据生命周期

```
用户输入 ──→ 数据库持久化 ──→ Job 队列消费 ──→ AI 生成 ──→ 数据库写入 ──→ SSE 推送 ──→ 前端渲染
   │              │                │              │             │             │
   │         SQLite DB         Job 表         Agnes API     Storyboard     EventSource
   │         (dev.db)        (pending→       (外部 AI)      ImageCache    (实时)
   │                         completed)                      Asset 表
   │
   └── 所有数据存储在单个 SQLite 文件（prisma/dev.db）
```

### 4.2 核心实体流转

**创作数据流**：

```
Project (1)
  ├── Character (N) ──→ CharacterAsset (N)    [角色 DNA]
  │     │
  │     └── buildCharacterSheet() ──→ CharacterSheet JSON
  │                                        │
  └── Script (N)                           │
        │                                  │
        └── parseScriptToStoryboards()     │
              │                            │
              └── Storyboard (N) ←─────────┘
                    │              (角色一致性注入)
                    │
                    ├── generateStoryboardImage()
                    │     │
                    │     ├── SHA-256 哈希 → ImageCache 查/存
                    │     ├── imageUrls 持久化到 Storyboard
                    │     └── qualityScore 写入
                    │
                    └── generateStoryboardVideo()
                          │
                          ├── videoTaskId 写入 Storyboard
                          ├── videoUrl 写入（轮询完成后）
                          └── videoStatus 更新
```

### 4.3 三级缓存体系

| 缓存级别 | 位置 | TTL | 用途 |
|----------|------|-----|------|
| 内存缓存 | `settings.ts` global Map | 30s | 减少 Setting 表读频率 |
| 图片缓存 | `ImageCache` 表 (SQLite) | 可配置 / 永久 | prompt→imageUrl 映射，避免重复调 API |
| PRISMA 单例 | `globalThis.prisma` | 进程生命周期 | 避免热更新重复创建连接 |

### 4.4 SSE 实时推送数据格式

```typescript
// 事件类型定义
type ProgressEvent = {
  type: 'script' | 'storyboard' | 'image' | 'video' | 'system';
  id: string;           // resourceId 或 jobId
  status: 'started' | 'progress' | 'completed' | 'failed' | 'connected';
  progress?: number;    // 0-100
  message?: string;     // 人类可读描述
  projectId?: string;   // 用于前端过滤
  at: number;           // 毫秒时间戳
};

// SSE 协议格式
// event: progress
// data: {"type":"image","id":"batch-xxx","status":"progress","progress":45,"message":"批量生成中：9/20（失败 1）","projectId":"proj-xxx","at":1719158400000}
```

---

## 5. 用户交互路径

### 5.1 完整用户旅程

```
  登录页                   项目列表                    项目详情
┌─────────┐           ┌─────────────┐           ┌──────────────────┐
│ /login  │──登录──→  │ /dashboard/ │──新建──→  │ /dashboard/      │
│         │           │ projects    │           │ projects/[id]    │
│ 密码认证 │←──登出──  │             │←──返回──  │                  │
└─────────┘           └─────────────┘           └──────┬───────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────────┐
                    │                │                 │                 │     │
                    ▼                ▼                 ▼                 ▼     ▼
              ┌──────────┐   ┌──────────┐     ┌──────────┐     ┌──────────┐ ┌──────────┐
              │ Director │   │ Timeline │     │  Review  │     │  Voice   │ │ Publish  │
              │ 导演模式  │   │ 时间线    │     │ 评审审核  │     │ 语音生成  │ │ 发布导出  │
              └──────────┘   └──────────┘     └──────────┘     └──────────┘ └──────────┘
```

### 5.2 各页面交互矩阵

| 页面 | 核心操作 | 实时反馈 | 异步操作 |
|------|----------|----------|----------|
| **项目列表** | 创建/删除项目, 筛选/搜索 | — | — |
| **项目详情** | 输入大纲 → 生成剧本 | SSE 进度条 | 剧本生成 Job |
| **导演模式** | 场景构建, 分镜提取, 批量生图 | SSE 批量进度 | 分镜生成 Job + 图片并发生成 |
| **评审模式** | 逐帧审核, 添加标注评论, 重新生成 | — | 单帧重新生成 |
| **时间线** | 拖拽排序分镜, 预览图片 | — | — |
| **语音** | 选择台词 → 生成语音 | — | 语音生成 API |
| **发布** | 预览成片, 导出 | 导出进度 | 视频合成 + 打包 |
| **角色管理** | 创建/编辑角色, AI 生成角色卡, 锁定 DNA | — | AI 批量生成角色 |
| **设置** | 配置 API Key, 模型选择, 测试连接 | 测试结果 | 连接测试 |

### 5.3 错误处理 UX

| 场景 | 前端表现 | 恢复方式 |
|------|----------|----------|
| 剧本生成失败 | SSE 推送 `status: 'failed'` + 错误消息 | 用户可重新提交 |
| 图片生成失败 | 分镜卡片显示红色错误标记 | 逐帧重试或批量重试 |
| 视频任务超时 | 视频状态显示 "failed" | 手动重新提交 |
| 进程崩溃恢复 | 相关 Job 自动标记 failed | 系统 recovery 通知 + 手动重试 |
| API Key 无效 | 设置页测试连接返回错误 | 更新 Key 重新测试 |
| 网络中断 | EventSource 自动重连 | 恢复后追赶最新进度事件 |

---

## 6. 业务规则与边界条件

### 6.1 状态机约束

**项目状态**（单向流转，不可逆）：

```
draft ──→ scripting ──→ storyboarding ──→ producing ──→ completed
  │           │               │                │
  (初始)   (剧本完成)     (分镜完成)       (图片完成)
```

实现细节（`project-status.ts`）：
- 状态顺序按数值比较（0→1→2→3→4）
- `updateProjectStatus()` 若目标数值 ≤ 当前数值，则**静默跳过**（不报错，不倒退）
- 异常状态（'failed', 'unknown'）允许被任意状态覆盖

**Job 状态机**：

```
pending ──→ running ──→ completed
                │
                └──→ failed (错误 / 超时 / 崩溃)
```

**Storyboard 审核状态**：

```
pending ──→ reviewing ──→ approved
                │
                └──→ rejected (可重新生成)
```

### 6.2 数据约束

| 约束项 | 限制值 | 位置 |
|--------|--------|------|
| 大纲最大长度 | 5000 字符 | `scripts/route.ts` POST |
| 项目标题最大长度 | 100 字符 | `projects/route.ts` POST |
| 项目描述最大长度 | 1000 字符 | `projects/route.ts` POST |
| 提示词最大长度 | 2500 字符 | `character-prompt.ts` MAX_PROMPT_LENGTH |
| Job result 最大长度 | 10000 字符 | `job-queue.ts` JSON.stringify.slice(0, 10000) |
| Job 错误消息最大长度 | 2000 字符 | `job-queue.ts` failJob slice(0, 2000) |
| 批量生图最大帧数 | 20 | `batch/route.ts` |
| 并发生图上限 | 3 | `batch/route.ts` BATCH_CONCURRENCY |
| Job 最大并发数 | 3 | `job-queue.ts` MAX_CONCURRENT_JOBS |

### 6.3 超时与重试策略

| 操作 | 超时 | 重试次数 | 退避策略 |
|------|------|----------|----------|
| 文本生成 (非流式) | 90s | 2 | 指数退避 + 随机抖动 |
| 文本生成 (流式) | 120s | 2 | 同上 |
| 图片生成 (单帧) | 120s (API) | 4 | 内部重试 |
| 图片批量任务 (单帧) | 60s (Pool) | — | 超时则标记失败 |
| 视频生成提交 | 180s | 1 | 指数退避 |
| 视频任务轮询 | 5s × 60次 | — | 固定间隔 |
| Job 超时 (无心跳) | 15 min | — | cleanup 定时检查 |
| Fetch 重试状态码 | 408, 425, 429, 500, 502, 503, 504 | maxRetries 可配 | 指数退避 |

### 6.4 安全规则

| 安全机制 | 实现位置 | 作用 |
|----------|----------|------|
| SSRF 防护 (API) | `url-guard.ts` `isAllowedApiBase()` | DNS 解析 + 私有 IP 过滤 + 域名后缀白名单 `*.agnes-ai.com` |
| SSRF 防护 (参考图) | `url-guard.ts` `isSafeExternalUrl()` | 协议强制 HTTPS + 内网 IP 拒绝 + metadata hostname 黑名单 |
| 鉴权 (页面) | `middleware.ts` | Cookie HMAC 签名校验 + 重定向到 /login |
| 鉴权 (API) | 55/58 路由 `checkApiAuth()` | API 级别 401 JSON 返回 |
| 防时序攻击 | `auth.ts` `timingSafeEqual()` | 密码/Token 比较 |
| 防 XSS | HttpOnly Cookie | Session Token 不可 JS 读取 |
| 防 CSRF | 同源策略 + Cookie | 配合 Next.js Server Actions 自然防护 |
| URL 参数安全 | `middleware.ts` | 过滤 `//`、`/\`、`/$:`、换行符 |
| 生产环境保护 | `middleware.ts` | 未配置 AUTH_PASSWORD 时默认拒绝所有 API |

### 6.5 免费 API 策略边界

由于依赖 Agnes AI 免费 API，系统设计存在以下隐含假设：

| 假设 | 影响 | 应对 |
|------|------|------|
| API 无调用频率限制 | 不做 rate limit | — |
| 图片生成无成本 | 质量不达标直接重试，最多 4 次 | — |
| 评估调用免费 | 每张图额外调 1-2 次 Chat API | — |
| API 可用性不确定 | 所有调用外围都有 try/catch + 重试 | — |

若未来切换为付费 API，需新增以下功能：
- API 调用计数 + 预算上限
- 图片生成前预估成本
- 评估调用可选（跳过质量检查以节省成本）

### 6.6 部署边界

| 约束 | 说明 |
|------|------|
| 单机单进程 | Job Queue 依赖进程内轮询，不支持集群部署 |
| SQLite | 不支持并发写入（WAL 模式可缓解读锁），数据量 < 100MB 可接受 |
| 无 Redis | Progress Bus 为进程内 EventEmitter，多实例无法共享 |
| 无消息队列 | 没有持久化消息中间件，进程崩溃丢失未消费的 pending Job |
| Docker 支持 | 提供 Dockerfile + docker-compose，但不强制 |

---

## 附录：关键术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 分镜 | Storyboard | 单个镜头帧，包含描述、镜头参数、生成的图片 |
| 角色 DNA | Character DNA | 角色的标准外观描述 + 多视角参考图，确保生图一致性 |
| Character Sheet | — | 角色 DNA 的标准化 JSON 表示，注入到图片 prompt 中 |
| IP-Adapter | — | 图片生成模型中的角色一致性控制机制 |
| Job Queue | — | 基于 SQLite 的进程内异步任务队列 |
| SSE | Server-Sent Events | 服务端主动推送进度事件的协议 |
| Concurrency Pool | — | 滑动窗口模式的并发控制器 |
| Cleanup Scheduler | — | 后台定时清理超时任务的调度器 |
| SSRF | Server-Side Request Forgery | 服务端请求伪造攻击（URL Guard 防护对象） |
