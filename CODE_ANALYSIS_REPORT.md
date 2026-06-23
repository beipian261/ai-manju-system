# AI 漫剧系统 — 深度代码分析报告

> 生成日期：2026-06-20
> 分析范围：`src/` 全量代码（lib、app/api、app/dashboard、middleware）
> 报告维度：修复 · 改进 · 创新

---

## 目录

- [一、P0 级 — 必须立即修复的 Bug](#一p0-级--必须立即修复的-bug)
- [二、P1 级 — 安全漏洞与逻辑不一致](#二p1-级--安全漏洞与逻辑不一致)
- [三、P2 级 — 性能瓶颈](#三p2-级--性能瓶颈)
- [四、P3 级 — 代码质量与可维护性](#四p3-级--代码质量与可维护性)
- [五、创新功能建议](#五创新功能建议)
- [六、修复优先级路线图](#六修复优先级路线图)

---

## 一、P0 级 — 必须立即修复的 Bug

### P0-1. SSRF 防护被完全绕过（`agnes-client.ts` × `url-guard.ts`）

**文件**：`src/lib/agnes-client.ts` 第 78-87 行
**关联文件**：`src/lib/url-guard.ts` 第 59 行

**问题本质**：
`url-guard.ts` 中的 `isAllowedApiBase()` 是一个 `async` 函数（返回 `Promise<UrlCheckResult>`），因为它内部需要执行 DNS 解析来检测 DNS Rebinding 攻击。但 `agnes-client.ts` 中的 `validateApiBase()` 将其当作同步函数调用：

```typescript
// agnes-client.ts 第 78-87 行 — BUG
function validateApiBase(raw: string): string {
  // ...
  if (!isAllowedApiBase(base)) {   // ← 判断的是 Promise 对象，永远 truthy
    throw new Error(`AGNES_API_BASE 必须为公开的 HTTPS 端点：${base}`);
  }
  return base;
}
```

`!isAllowedApiBase(base)` 实际上是在判断 `!Promise` — 一个 Promise 对象永远为 truthy，所以 `!Promise` 永远为 `false`。**SSRF 校验形同虚设**，攻击者可以将 `AGNES_API_BASE` 设置为 `http://169.254.169.254`（云元数据端点）等内网地址，校验不会阻止。

**影响**：
- 攻击者可通过修改 Settings 中的 API Base 地址，让服务器向任意内网地址发起请求
- 可读取云实例元数据（AWS/GCP/Azure IAM 凭证）
- 可扫描内网端口、访问内部服务

**修复方案**：
```typescript
// 修复：validateApiBase 改为 async，并 await 校验结果
async function validateApiBase(raw: string): Promise<string> {
  if (!raw || typeof raw !== 'string') {
    throw new Error('AGNES_API_BASE 未配置，请前往 /settings 页面配置');
  }
  const base = raw.trim().replace(/\/$/, '');
  const result = await isAllowedApiBase(base);  // ← await
  if (!result.ok) {
    throw new Error(`AGNES_API_BASE 校验失败：${result.reason}`);
  }
  return base;
}

// 所有调用点也需加 await：
// request() 函数第 103 行：
const API_BASE = await validateApiBase(await getSetting('AGNES_API_BASE'));
// getVideoTask() 第 173 行：
const API_BASE = await validateApiBase(await getSetting('AGNES_API_BASE'));
// chatCompletionStream() 第 202 行：
const API_BASE = await validateApiBase(await getSetting('AGNES_API_BASE'));
```

**预期收益**：恢复 SSRF 防护能力，阻止内网探测和云元数据泄露。

---

### P0-2. 批量图片生成失败计数永远为 0（`batch/route.ts`）

**文件**：`src/app/api/agnes/image/batch/route.ts` 第 86-121 行

**问题本质**：两个独立 bug 叠加：

**Bug A — `failed` 变量永远为 0**：
`runWithConcurrencyPool` 的 `onProgress` 回调签名为 `(completed, total, result) => void`，但 batch route 中使用 `(done) => { completed = done; }`，从未更新 `failed` 变量。即使有任务失败，`failed` 仍为 0。

**Bug B — 结果收集逻辑硬编码 `completed`**：
```typescript
// 第 119-121 行 — BUG
for (const item of toGenerate) {
  results.push({ storyboardId: item.storyboardId, status: 'completed' });
  // ← 无论实际成功失败，全部标记为 completed
}
```

**影响**：
- 用户看到的批量生成结果全部显示"成功"，即使部分图片生成失败
- 前端无法获知哪些分镜需要重试
- 进度消息中的失败计数始终为 0，误导用户

**修复方案**：
```typescript
// 修复：利用 runWithConcurrencyPool 的返回值来判断成功/失败
const poolResults = await runWithConcurrencyPool(
  toGenerate,
  BATCH_CONCURRENCY,
  async (item: BatchItem) => {
    const result = await generateStoryboardImage({
      storyboardId: item.storyboardId,
      prompt: item.prompt,
    });
    return { storyboardId: item.storyboardId, status: 'completed' as const, ...result };
  },
  (done) => {
    completed = done;
    const pct = Math.round((completed / toGenerate.length) * 100);
    emitProgress({
      type: 'image',
      id: 'batch:progress',
      status: 'progress',
      progress: pct,
      message: `批量生成中：${completed}/${toGenerate.length}`,
    });
  }
);

// 根据 poolResults 中的实际结果收集
const results: Array<{
  storyboardId: string;
  status: 'completed' | 'failed';
  reason?: string;
}> = [];

for (let i = 0; i < toGenerate.length; i++) {
  const r = poolResults[i];
  if (r && r.status === 'completed') {
    results.push({ storyboardId: toGenerate[i].storyboardId, status: 'completed' });
  } else {
    failed++;
    results.push({ storyboardId: toGenerate[i].storyboardId, status: 'failed', reason: '生成失败' });
  }
}
```

**预期收益**：准确的失败反馈，用户可针对性重试失败的分镜。

---

### P0-3. 图片缓存哈希碰撞率高（`image-gen.ts`）

**文件**：`src/lib/image-gen.ts` 第 25-33 行

**问题本质**：
```typescript
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
```

这是一个经典的 32-bit DJB2 变体哈希，输出空间仅约 43 亿（2^32）。对于长 prompt 字符串（拼接了 `prompt|artStyle|size`），碰撞概率随缓存条目数增长而急剧上升。**当两个不同 prompt 产生相同 hash 时，用户会收到错误的缓存图片**。

此外，`hash & hash` 是无操作（`x & x === x`），这行代码虽然不影响结果但表明开发者对位运算的理解有误。

**影响**：
- 缓存碰撞 → 用户看到与 prompt 不匹配的图片
- 随着缓存增长，碰撞频率增加（生日攻击：约 65K 条目时 50% 碰撞概率）

**修复方案**：
```typescript
import crypto from 'crypto';

function buildCacheKey(prompt: string, artStyle: string, size: string): string {
  return crypto.createHash('sha256')
    .update(`${prompt}|${artStyle}|${size}`)
    .digest('hex')
    .slice(0, 32); // 128-bit 截断，碰撞概率可忽略
}
```

**预期收益**：消除缓存碰撞风险，SHA-256 在实际场景中碰撞概率为零。

---

### P0-4. `concurrency-pool.ts` 进度计数不准确

**文件**：`src/lib/concurrency-pool.ts` 第 29、40 行

**问题本质**：
```typescript
const completed = results.filter(Boolean).length;  // ← 第 29 行和第 40 行
```

`filter(Boolean)` 会过滤掉所有 falsy 值（`0`, `""`, `false`, `null`, `undefined`）。如果 `processor` 返回的合法结果本身是 falsy 值（如数字 `0`、空字符串），这些结果会被误判为"未完成"，导致进度计数偏低。

此外，错误路径中 `results[globalIdx] = undefined as unknown as R`（第 38 行）会污染 results 数组，使后续 `filter(Boolean)` 的计数更不可靠。

**影响**：
- 批量操作的进度条不准确
- 依赖进度做 UI 决策的逻辑会出错

**修复方案**：
```typescript
export async function runWithConcurrencyPool<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number, result: R | null) => void
): Promise<{ results: (R | null)[]; errors: (Error | null)[] }> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  const errors: (Error | null)[] = new Array(items.length).fill(null);
  let completedCount = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkIndices = chunk.map((_, idx) => i + idx);

    const chunkPromises = chunk.map(async (item, localIdx) => {
      const globalIdx = chunkIndices[localIdx];
      try {
        const result = await processor(item, globalIdx);
        results[globalIdx] = result;
        errors[globalIdx] = null;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        errors[globalIdx] = err;
        results[globalIdx] = null;
      } finally {
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, items.length, results[globalIdx]);
        }
      }
    });

    await Promise.all(chunkPromises);
  }

  return { results, errors };
}
```

**预期收益**：准确的进度追踪，调用方可以区分成功和失败结果。

---

## 二、P1 级 — 安全漏洞与逻辑不一致

### P1-1. `GET /api/projects` 和 `GET /api/scripts` 未鉴权

**文件**：
- `src/app/api/projects/route.ts` 第 8-15 行（`GET` 无 `checkApiAuth()`）
- `src/app/api/scripts/route.ts` 第 14-27 行（`GET` 无 `checkApiAuth()`）

**问题本质**：所有 `POST`/`PUT`/`DELETE` 操作都有 `checkApiAuth()` 鉴权，但 `GET` 请求直接返回全量数据。中间件 `middleware.ts` 虽然拦截 `/api/*`，但鉴权未启用时开发环境放行、生产环境返回 503。

**影响**：
- 如果鉴权已启用但用户未登录，仍可通过 `GET /api/projects` 列出所有项目
- 项目标题、描述等元数据泄露
- 剧本内容（含创作大纲）泄露

**修复方案**：
```typescript
// projects/route.ts GET 方法添加鉴权
export async function GET() {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;
  // ... 原有逻辑
}

// scripts/route.ts GET 方法同理
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;
  // ... 原有逻辑
}
```

**预期收益**：堵住数据泄露入口，所有 API 端点统一鉴权。

---

### P1-2. `AUTH_SECRET` 与 `isAuthEnabled()` 逻辑不一致

**文件**：`src/lib/auth.ts` 第 16-18 行 vs 第 39-41 行

**问题本质**：
```typescript
// getSecret() 检查三个环境变量
function getSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD_HASH || process.env.AUTH_PASSWORD || null;
}

// isAuthEnabled() 只检查后两个
export function isAuthEnabled(): boolean {
  return !!(process.env.AUTH_PASSWORD || process.env.AUTH_PASSWORD_HASH);
}
```

如果用户只配置了 `AUTH_SECRET`（用于签发 session）而没有配置 `AUTH_PASSWORD` 或 `AUTH_PASSWORD_HASH`：
- `getSecret()` 返回非 null → `verifySessionToken()` 认为鉴权已配置，会校验 token
- `isAuthEnabled()` 返回 false → `checkApiAuth()` 认为鉴权未启用，开发环境直接放行
- 结果：**鉴权被绕过**

**影响**：仅配置 `AUTH_SECRET` 的部署环境，所有写操作 API 在开发环境无鉴权放行。

**修复方案**：
```typescript
export function isAuthEnabled(): boolean {
  return !!(process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || process.env.AUTH_PASSWORD_HASH);
}
```

**预期收益**：消除鉴权逻辑不一致，确保 `AUTH_SECRET` 独立配置时鉴权生效。

---

### P1-3. `saveToCache` 未 await（fire-and-forget）

**文件**：`src/lib/image-gen.ts` 第 337 行

**问题本质**：
```typescript
if (!usedCache && finalImageUrl) {
  saveToCache(cacheKey, professionalPrompt, finalImageUrl, styleKey as string, lastScore, IMAGE_MODEL);
  // ← 未 await，函数返回后 Promise 可能在进程退出时被中断
}
```

虽然 `saveToCache` 内部有 try-catch，但未 await 意味着：
1. 如果进程在 `saveToCache` 完成前退出（如 Vercel serverless 函数超时），缓存不会写入
2. 缓存写入失败完全静默，无法在日志中追踪
3. 后续代码（`prisma.storyboard.update`）与缓存写入存在竞态

**修复方案**：
```typescript
if (!usedCache && finalImageUrl) {
  await saveToCache(cacheKey, professionalPrompt, finalImageUrl, styleKey as string, lastScore, IMAGE_MODEL);
}
```

**预期收益**：确保缓存可靠写入，消除竞态条件。

---

### P1-4. `getVideoTask` 重复错误处理逻辑

**文件**：`src/lib/agnes-client.ts` 第 172-192 行

**问题本质**：
`getVideoTask()` 完全复制了 `request()` 函数中的错误处理逻辑（第 117-139 行），包括：
- HTTP 状态码读取
- JSON 错误体解析
- 错误消息拼接

两处代码几乎完全相同，违反 DRY 原则。如果未来错误处理逻辑需要变更（如增加特定状态码处理），需要同时修改两处，容易遗漏。

**修复方案**：抽取通用错误处理函数：
```typescript
async function handleErrorResponse(res: Response, context: string): Promise<never> {
  let errMsg = `${context} 返回 ${res.status}`;
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const jsonErr = await res.json();
      const extracted = jsonErr?.error?.message || jsonErr?.message || jsonErr?.error || JSON.stringify(jsonErr).slice(0, 500);
      errMsg = `${res.status}: ${String(extracted).slice(0, 500)}`;
    } else {
      const text = await res.text();
      errMsg = `${res.status}: ${text.slice(0, 500)}`;
    }
  } catch {
    // 保持默认 errMsg
  }
  console.error(`[${context}] error`, res.status, errMsg);
  throw new Error(errMsg);
}

// request() 和 getVideoTask() 共用
```

**预期收益**：消除重复代码，错误处理逻辑统一维护。

---

## 三、P2 级 — 性能瓶颈

### P2-1. `getSetting()` 每次调用查库，无内存缓存

**文件**：`src/lib/settings.ts` 第 80-88 行

**问题本质**：
```typescript
export async function getSetting(key: string): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  // ... 每次都是一次 DB 查询
}
```

在一次图片生成流程中，`getSetting()` 被调用的次数：
- `AGNES_API_BASE` — 1 次（validateApiBase）
- `AGNES_API_KEY` — 1 次（validateApiKey）
- `IMAGE_EVAL_THRESHOLD` — 1 次
- `IMAGE_MAX_RETRIES` — 1 次
- `AGNES_IMAGE_MODEL` — 1 次
- `AGNES_TEXT_MODEL` — 1 次（如果走剧本路径）

单次图片生成至少 5-6 次 DB 查询仅用于读取配置。批量生成 20 张图片时 = 100-120 次配置查询。

**影响**：配置查询占总耗时的比例虽小（SQLite 本地查询快），但数量大时仍产生可观的开销，尤其在并发场景下。

**修复方案**：引入带 TTL 的内存缓存：
```typescript
let settingsCache: { data: AppSettings | null; expiry: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 秒缓存

export async function getSetting(key: string): Promise<string> {
  // 尝试从缓存读取
  const now = Date.now();
  if (!settingsCache || settingsCache.expiry < now) {
    try {
      const settings = await getSettings(); // 一次查全部
      settingsCache = { data: settings, expiry: now + CACHE_TTL_MS };
    } catch {
      settingsCache = { data: null, expiry: now + 5_000 }; // 短缓存避免频繁重试
    }
  }

  if (settingsCache.data && key in settingsCache.data) {
    return settingsCache.data[key as keyof AppSettings] || '';
  }
  return process.env[key] || DEFAULTS[key] || '';
}

// saveSettings 时清除缓存
export async function saveSettings(settings: Record<string, string | undefined>): Promise<void> {
  // ... 原有逻辑
  settingsCache = null; // 清除缓存，下次读取时刷新
}
```

**预期收益**：配置查询从每次 1 次 DB 降到每 30 秒 1 次 DB，批量操作性能提升 10-20%。

---

### P2-2. 前端 `loadData()` 全量拉取，未按 projectId 过滤

**文件**：`src/app/dashboard/projects/[id]/page.tsx`

**问题本质**：
`loadData()` 函数同时请求 `/api/projects`、`/api/characters`、`/api/scripts` 等端点，但部分请求未传 `projectId` 参数，导致后端返回**所有项目的数据**。前端再在客户端过滤。

此外，SSE 实时推送 + 8 秒轮询双重机制并存，两者都在拉取相同数据，造成不必要的网络开销。

**影响**：
- 网络传输冗余数据（其他项目的角色、剧本）
- 客户端内存占用增加
- 轮询与 SSE 重复，浪费带宽

**修复方案**：
1. 所有 GET 请求都传 `projectId` 参数
2. SSE 连接成功后停止轮询，SSE 断开时降级为轮询
```typescript
// 伪代码
const [project, characters, scripts] = await Promise.all([
  fetch(`/api/projects/${projectId}`).then(r => r.json()),
  fetch(`/api/characters?projectId=${projectId}`).then(r => r.json()),
  fetch(`/api/scripts?projectId=${projectId}`).then(r => r.json()),
]);
```

**预期收益**：减少网络传输量 50-80%（取决于项目数量），消除冗余轮询。

---

### P2-3. `prisma-client.ts` 模块加载副作用

**文件**：`src/lib/prisma-client.ts`

**问题本质**：
模块在被 import 时自动调用 `startCleanupScheduler()`，这是一个副作用。如果该模块被某个工具脚本或测试文件 import，会在非预期场景下启动定时器。

**修复方案**：将 `startCleanupScheduler()` 的调用移到应用入口点（如 `instrumentation.ts` 或 `layout.tsx` 的 server 端），而非模块加载时。

**预期收益**：模块职责清晰，副作用可控。

---

## 四、P3 级 — 代码质量与可维护性

### P3-1. 前端页面文件超大，需拆分

**文件**：`src/app/dashboard/projects/[id]/page.tsx`（>23000 tokens）

**问题本质**：
单文件包含所有 Tab 的逻辑（项目信息、角色管理、剧本生成、分镜管理、图片生成、视频生成），导致：
- 文件过大，难以导航
- 状态管理混乱（多个 useState/useEffect 交织）
- 无法复用组件
- 代码审查困难

**修复方案**：按 Tab 拆分为独立组件：
```
src/app/dashboard/projects/[id]/
├── page.tsx                    // 主页面，管理 Tab 状态
├── components/
│   ├── ProjectInfo.tsx         // 项目信息 Tab
│   ├── CharacterManager.tsx    // 角色管理 Tab
│   ├── ScriptGenerator.tsx     // 剧本生成 Tab
│   ├── StoryboardManager.tsx   // 分镜管理 Tab
│   ├── ImageGenerator.tsx      // 图片生成 Tab
│   ├── VideoGenerator.tsx      // 视频生成 Tab
│   └── shared/
│       ├── ProgressBar.tsx     // 通用进度条
│       ├── SSEHandler.tsx      // SSE 连接管理 hook
│       └── ConfirmDialog.tsx   // 替代原生 confirm()
```

**预期收益**：
- 每个文件 200-400 行，可维护性大幅提升
- 组件可独立测试
- 新成员上手成本降低

---

### P3-2. 重复注释块（`scripts/route.ts`）

**文件**：`src/app/api/scripts/route.ts` 第 105-113 行

**问题本质**：
```typescript
// ============================================================
// 流式剧本生成：边生成边推送，用户实时看到剧本内容
// 通过 progress bus 发送 script_content 事件，前端 SSE 接收
// ============================================================

// ============================================================
// 流式剧本生成：边生成边推送，用户实时看到剧本内容
// 通过 progress bus 发送 script_content 事件，前端 SSE 接收
// ============================================================
```
完全相同的注释块出现了两次。

**修复方案**：删除重复的注释块。

**预期收益**：代码整洁度提升。

---

### P3-3. `as any` 类型断言滥用

**文件**：多处

| 文件 | 行号 | 代码 |
|------|------|------|
| `image-gen.ts` | 347 | `data: { ... } as any` |
| `scripts/route.ts` | 189 | `} as any)` |
| `jobs/generate-script.ts` | 多处 | `any[]` 类型 |

**问题本质**：
`as any` 绕过了 TypeScript 类型检查，可能掩盖类型错误。在 `image-gen.ts` 中，`qualityScore` 字段使用 `as any` 是因为 Prisma schema 中可能没有定义该字段或类型不匹配。

**修复方案**：
1. 检查 `prisma/schema.prisma` 中 `Storyboard` 模型是否有 `qualityScore` 字段
2. 如有，确保类型匹配；如无，添加字段并运行 migration
3. 消除所有 `as any`，使用正确的类型定义

**预期收益**：类型安全，减少运行时错误。

---

### P3-4. `deleteCharacter()` 使用原生 `confirm()`

**文件**：`src/app/dashboard/projects/[id]/page.tsx`

**问题本质**：
```typescript
if (!confirm('确定删除该角色？此操作不可撤销。')) return;
```

原生 `confirm()` 在不同浏览器中样式不一致，且会阻塞主线程。

**修复方案**：实现自定义确认弹窗组件（可基于 Modal/Dialog 组件）。

**预期收益**：一致的 UI 体验，非阻塞交互。

---

### P3-5. Job Queue 串行消费限制吞吐

**文件**：`src/lib/job-queue.ts` 第 111 行

**问题本质**：
```typescript
if (workerState.processing) return; // 串行：一次只处理一个
```

Job Queue 的并发度为 1（串行消费）。当有多个剧本生成或图片生成任务排队时，必须等前一个完成才能开始下一个。

**影响**：
- 批量操作耗时 = 单任务耗时 × 任务数
- 用户等待时间长

**修复方案**：
```typescript
const MAX_CONCURRENT_JOBS = 3; // 可配置

async function tick(): Promise<void> {
  const activeCount = workerState.activeJobs?.size ?? 0;
  if (activeCount >= MAX_CONCURRENT_JOBS) return;
  // ... 取出 pending 任务并执行
}
```

**预期收益**：批量操作耗时降低 60-70%（3 并发）。

**注意**：需配合 API 限流策略，避免超出 Agnes API 并发限制。

---

## 五、创新功能建议

### 创新-1. 项目导出功能（高优先级）

**场景**：用户完成漫剧创作后，需要导出为可分享的格式。

**方案**：
- **PDF 导出**：将分镜图片 + 剧本文字编排为 PDF（使用 `puppeteer` 或 `pdfkit`）
- **视频合成**：将分镜图片 + 生成的视频片段合成为完整视频（使用 `ffmpeg`）
- **JSON 导出**：导出完整项目数据（含角色、剧本、分镜），支持导入恢复

**预期收益**：闭环创作流程，提升产品价值。

---

### 创新-2. 版本历史与回滚

**场景**：用户对剧本/分镜做了修改后想回退到之前的版本。

**方案**：
- 在 Prisma schema 中添加 `ScriptVersion` 和 `StoryboardVersion` 模型
- 每次保存时创建版本快照（diff 存储以节省空间）
- 提供"历史版本"面板，支持预览和回滚

**预期收益**：降低误操作风险，提升用户信心。

---

### 创新-3. 模板市场

**场景**：新用户不知道如何写好的大纲，有经验的用户想分享模板。

**方案**：
- 预置剧本模板（奇幻、科幻、爱情、悬疑等类型）
- 用户可将项目发布为模板
- 模板包含：大纲框架 + 角色设定 + 画风推荐
- 支持一键创建项目并应用模板

**预期收益**：降低新用户上手门槛，形成社区生态。

---

### 创新-4. WebSocket 替代 SSE

**场景**：当前 SSE 是单向通信，前端无法主动取消正在进行的生成任务。

**方案**：
- 将 `progress-bus`（EventEmitter）+ SSE 替换为 WebSocket
- 前端可发送 `cancel` 消息，后端中断正在执行的 Job
- 支持多客户端实时同步（如用户在手机和电脑上同时查看）

**预期收益**：双向实时通信，支持任务取消，多端同步。

---

### 创新-5. 速率限制（Rate Limiting）

**场景**：当前无速率限制，恶意用户可频繁调用 AI 生成 API 消耗配额。

**方案**：
- 基于 IP + 用户 ID 的滑动窗口限流
- 对 `/api/agnes/*` 端点限制每分钟请求数
- 使用内存计数器（单机）或 Redis（分布式）

**预期收益**：防止 API 配额浪费，防止 DDoS。

---

### 创新-6. 国际化（i18n）

**场景**：当前系统仅支持中文，限制了用户群体。

**方案**：
- 使用 `next-intl` 或 `react-i18next`
- 提取所有硬编码中文字符串到 locale 文件
- 支持 `zh-CN`（默认）和 `en-US`

**预期收益**：扩大用户群体。

---

### 创新-7. Docker 部署优化

**场景**：当前已有 Dockerfile，但可进一步优化。

**方案**：
- 多阶段构建：builder 阶段编译，runner 阶段仅含运行时依赖
- 健康检查：添加 `HEALTHCHECK` 指令
- 数据卷：明确 SQLite 数据库的持久化路径
- 环境分离：`docker-compose.dev.yml` 和 `docker-compose.prod.yml`

**预期收益**：镜像体积减少 40-60%，部署更安全。

---

### 创新-8. AI 提示词优化助手

**场景**：用户写的大纲质量参差不齐，影响生成效果。

**方案**：
- 在用户输入大纲时，AI 实时分析并给出改进建议
- 检测：角色设定是否完整、情节是否有冲突点、节奏是否合理
- 提供"一键优化"按钮，AI 自动补充缺失要素

**预期收益**：提升生成质量，降低创作门槛。

---

## 六、修复优先级路线图

| 优先级 | 编号 | 问题 | 工作量 | 建议时间 |
|--------|------|------|--------|----------|
| **P0** | P0-1 | SSRF 防护被绕过 | 0.5h | 立即 |
| **P0** | P0-2 | 批量生成失败计数 bug | 1h | 立即 |
| **P0** | P0-3 | 缓存哈希碰撞 | 0.5h | 立即 |
| **P0** | P0-4 | 并发池进度计数 | 1h | 立即 |
| **P1** | P1-1 | GET 端点未鉴权 | 0.5h | 1 天内 |
| **P1** | P1-2 | AUTH_SECRET 逻辑不一致 | 0.5h | 1 天内 |
| **P1** | P1-3 | saveToCache 未 await | 0.5h | 1 天内 |
| **P1** | P1-4 | 重复错误处理逻辑 | 1h | 3 天内 |
| **P2** | P2-1 | getSetting 无缓存 | 1h | 1 周内 |
| **P2** | P2-2 | 前端全量拉取 | 2h | 1 周内 |
| **P2** | P2-3 | 模块加载副作用 | 0.5h | 1 周内 |
| **P3** | P3-1 | 页面文件拆分 | 4-6h | 2 周内 |
| **P3** | P3-2 | 重复注释块 | 5min | 随手修 |
| **P3** | P3-3 | as any 滥用 | 2h | 2 周内 |
| **P3** | P3-4 | 原生 confirm | 1h | 2 周内 |
| **P3** | P3-5 | Job Queue 串行 | 2h | 评估后决定 |

---

## 附录：架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 14 App Router                  │
├─────────────┬───────────────┬───────────────────────────┤
│   Frontend   │    API Routes  │      Middleware (Auth)    │
│  (React/TSX) │  (REST + SSE)  │   /dashboard/* /api/*     │
├─────────────┴───────────────┴───────────────────────────┤
│                     Core Libraries                       │
│  auth · prisma-client · job-queue · agnes-client         │
│  image-gen · settings · url-guard · progress-bus         │
│  concurrency-pool · prompt-library · character-prompt    │
├───────────────────────────────────────────────────────────┤
│                     Data Layer                           │
│        Prisma ORM → SQLite (better-sqlite3)              │
│  Project · Character · Script · Storyboard · Asset       │
│  Setting · Job · ImageCache                              │
├───────────────────────────────────────────────────────────┤
│                   External Services                      │
│              Agnes AI API (Chat/Image/Video)             │
└───────────────────────────────────────────────────────────┘
```

---

*报告完毕。建议从 P0 级 bug 开始修复，这些是影响安全和正确性的关键问题。*
