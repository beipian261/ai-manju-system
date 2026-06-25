# AI 漫剧系统 — 安全审计报告

**审计日期**: 2026-06-25
**审计范围**: `c:\Users\28406\Desktop\新建文件夹\ai-comic-drama-system` 全代码库
**技术栈**: Next.js 15.5.19 + TypeScript + Prisma + SQLite + Agnes AI API
**审计方法**: 代码白盒审计，按攻击面分组系统性检查

---

## 执行摘要

本次审计覆盖了认证与访问控制、注入向量、外部交互、敏感数据处理四大攻击面，共计检查 58 个 API 路由文件及全部核心库代码。

**结论：发现 1 个中等严重度已确认漏洞，2 个低严重度已确认问题。**

项目整体安全态势良好——无 SQL 注入、命令注入、XSS、路径遍历、SSRF 等经典高危漏洞。SSRF 防护（域名白名单 + DNS 解析 + 私有 IP 检测）和认证体系（HMAC-SHA256 签名 session + bcrypt 密码哈希）设计完善。

---

## 已确认漏洞

### [M-01] 登录端点无速率限制 — 密码暴力破解风险

| 属性 | 值 |
|------|-----|
| **严重度** | 中等 |
| **位置** | `src/app/api/auth/login/route.ts`（第 4-31 行） |
| **CWE** | CWE-307: Improper Restriction of Excessive Authentication Attempts |

**攻击者画像**: 任何能访问该应用的网络攻击者（外部用户）。

**可控输入向量**: `POST /api/auth/login` 请求体中的 `password` 字段，可无限次提交。

**完整利用路径**:
1. 攻击者向 `POST /api/auth/login` 发送请求 `{"password": "guess1"}`
2. 该端点在 middleware 中被标记为公开路径（`PUBLIC_API_PATHS`），无需认证即可访问
3. 端点代码（第 22 行）调用 `verifyPassword(password)` 进行密码比对
4. 整个流程中**没有任何速率限制、尝试计数、账户锁定或延迟机制**
5. 攻击者可自动化发送大量请求，逐一尝试密码字典

**影响**:
- 单用户密码系统下，若密码强度不足（如 `demo123`），可在短时间内被暴力破解
- 破解后攻击者获得完整管理员权限，可访问所有项目数据、调用 AI API（消耗配额）、修改系统设置

**证据**:
```typescript
// src/app/api/auth/login/route.ts — 无任何 rate limit 调用
export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ success: true, disabled: true });
  }
  // ... 直接验证密码，无速率限制
  const ok = await verifyPassword(password);
  if (!ok) {
    return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 });
  }
```

**修复建议**:
1. 在登录端点集成现有的 `checkRateLimit`（项目已有 `rate-limiter.ts` 实现）
2. 建议限制：同一 IP 每分钟最多 5 次尝试，连续失败 10 次后锁定 15 分钟
3. 可选：增加指数退避延迟（每次失败增加响应时间）

---

## 低严重度问题

### [L-01] CSRF 防护函数已实现但未启用

| 属性 | 值 |
|------|-----|
| **严重度** | 低 |
| **位置** | `src/lib/utils/security-middleware.ts`（第 55-86 行） |

**描述**: `validateCsrf()` 函数已完整实现（Double-submit cookie 模式 + HMAC-SHA256），但**未被任何 API 路由导入或调用**。项目现有的 CSRF 防护完全依赖 cookie 的 `SameSite: lax` 属性。

**攻击者画像**: 需要诱导已认证用户访问恶意网站的攻击者。

**利用路径分析**:
1. `SameSite: lax` 阻止跨站 POST 请求携带 cookie — 大部分 CSRF 场景已被阻断
2. 但 `SameSite: lax` 允许顶级导航 GET 请求携带 cookie
3. 项目中存在 3 个未认证的 GET 端点（`/api/review/comments`、`/api/quality/review`、`/api/preview/generate`），但这些端点仅返回配置/评论数据，不执行状态变更操作
4. **所有状态变更操作（POST/PUT/PATCH/DELETE）均被 `SameSite: lax` 有效阻断**

**影响**: 由于所有状态变更端点均为 POST+ 方法，`SameSite: lax` 已提供充分保护。当前风险极低，但建议启用已有的 CSRF 验证作为纵深防御。

**修复建议**: 在需要 CSRF 保护的 POST/PUT/PATCH/DELETE 路由中导入并调用 `validateCsrf(req)`。

---

### [L-02] `handleApiError` 可能泄露 "not found" 相关的内部路径信息

| 属性 | 值 |
|------|-----|
| **严重度** | 低 |
| **位置** | `src/lib/api/response.ts`（第 49-63 行） |

**描述**: `handleApiError` 函数在第 57-59 行检查 `error.message` 是否包含 `"not found"` 或 `"不存在"`，如果匹配则直接将该 message 返回给客户端。

**攻击者画像**: 已认证用户。

**利用路径**:
1. 已认证用户请求一个不存在的资源（如 `GET /api/projects/nonexistent-id`）
2. Prisma 抛出包含内部信息的错误
3. 如果错误消息包含 "not found" 关键词，原始 message 被返回给客户端

**影响**: 可能泄露资源 ID 格式、表名等辅助信息，帮助攻击者进行信息收集。不直接导致数据泄露或权限提升。

**证据**:
```typescript
// src/lib/api/response.ts:57-59
if (error.message.includes('not found') || error.message.includes('不存在')) {
  return notFoundResponse(error.message);  // 直接返回原始错误消息
}
```

**修复建议**: 对 "not found" 场景也返回统一的 "资源不存在" 消息，将原始错误仅记录到服务端日志。

---

## 审计通过的安全控制（亮点）

| 控制项 | 状态 | 说明 |
|--------|------|------|
| SQL 注入 | 安全 | 全部使用 Prisma ORM 参数化查询，无 `$queryRaw`/`$executeRaw` |
| 命令注入 | 安全 | 无 `child_process`、`exec`、`spawn` 调用 |
| XSS | 安全 | 无 `dangerouslySetInnerHTML`，React 默认转义 |
| 路径遍历 | 安全 | 无直接文件系统操作 |
| SSRF | 安全 | `url-guard.ts` 实现协议白名单 + 域名白名单 + DNS 解析 + 私有 IP 检测 |
| 认证覆盖 | 安全 | middleware matcher 覆盖所有路由，55/58 API 端点有 `checkApiAuth()` |
| 密码存储 | 安全 | 支持 bcrypt 哈希 + 常量时间比较 |
| Cookie 安全 | 安全 | HttpOnly + SameSite:lax + 生产环境 Secure |
| Open Redirect | 安全 | `safeRedirectPath()` 过滤 `//`、`\\`、控制字符 |
| API Key 保护 | 安全 | GET 响应中脱敏为 `sk-****`，无 `NEXT_PUBLIC_` 泄露 |
| Next.js 版本 | 安全 | 15.5.19 > 15.5.7，不受 CVE-2025-66478 影响 |
| 密钥管理 | 安全 | `.env` 已在 `.gitignore` 中，未被提交 |
| 日志安全 | 安全 | 无敏感信息（密码、token、API key）的日志记录 |
| AI API 速率限制 | 安全 | agnes 端点已集成 `checkRateLimit` |

---

## 未包含在报告中的检查项（已排除）

- **开发环境认证旁路** (`isAuthEnabled() === false` 时放行): 仅影响开发环境，生产环境 middleware 强制拒绝未配置密码的请求
- **CSRF 默认密钥硬编码** (`'csrf-default-secret-change-me'`): `validateCsrf` 函数未被任何路由调用，该密钥当前无实际影响
- **`safeEqual` 长度泄露**: 密码通常很短（<100字符），实际利用难度极高
- **登出 cookie 清除不完整**: 浏览器能正确匹配并清除同名 cookie，实际影响极低

---

*审计完成。如需对任何发现进行深入讨论或开始修复工作，请告知。*
