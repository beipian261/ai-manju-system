# AI 漫剧生成系统

基于 Agnes AI API 的 AI 漫剧/漫画生成 Web 应用，支持从剧本生成到视频输出的全流程 AI 创作。

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

## 功能

### 核心流程
- **项目管理**：创建/编辑/删除漫画项目，管理项目元数据
- **角色管理**：角色档案系统、AI 角色提取、DNA 一致性控制
- **AI 剧本生成**：基于文本模型生成多场景剧本，支持流式预览、版本历史与回滚
- **智能分镜设计**：从剧本自动提取分镜，支持导演分析与模板生成
- **AI 图片生成**：角色一致性保障、质量评估与自动重试
- **视频动画生成**：支持批量视频生成与任务跟踪

### 辅助功能
- **质量评审**：分镜一致性检查、情感一致性、视觉质量评估
- **配音系统**：AI 配音生成、台词分配、批量配音
- **发布导出**：项目素材打包、导出功能
- **智能助手**：AI 对话式辅助创作
- **实时进度**：SSE 推送实时任务进度
- **速率限制**：AI API 调用限流保护配额

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15.5 (App Router) |
| UI 框架 | React 19.2 + TailwindCSS 3.4 |
| 语言 | TypeScript 5.6 |
| 数据库 | SQLite (better-sqlite3) via Prisma ORM 5.22 |
| AI 服务 | Agnes AI Platform (OpenAI 兼容接口) |
| 认证 | HMAC-SHA256 Session Token (bcryptjs) |
| 任务队列 | SQLite 持久化队列 + SSE 进度推送 |
| 部署 | Docker (多阶段构建) + Nginx |

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 Agnes AI API Key 和访问密码

# 3. 初始化数据库
npx prisma db push

# 4. 启动开发服务器
npm run dev
# 或指定端口：node node_modules/next/dist/bin/next dev -p 3001
```

访问 http://localhost:3000（默认密码：在 .env 中设置的 AUTH_PASSWORD）

### Docker 部署

```bash
# 生产环境
docker-compose up -d

# 开发环境
docker-compose -f docker-compose.dev.yml up -d
```

## 环境变量

完整配置说明见 `.env.example`。核心变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AGNES_API_KEY` | Agnes AI API Key | 必填 |
| `AGNES_API_BASE` | API 地址 | `https://apihub.agnes-ai.com/v1` |
| `AGNES_TEXT_MODEL` | 文本模型 | `agnes-2.0-flash` |
| `AGNES_IMAGE_MODEL` | 图片模型 | `agnes-image-2.1-flash` |
| `AGNES_VIDEO_MODEL` | 视频模型 | `agnes-video-v2.0` |
| `AUTH_PASSWORD` | 登录密码 | 必填 |
| `AUTH_SECRET` | Session 签名密钥 | 自动生成（建议固定） |

## 开发

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 运行测试
npm test

# 数据库管理
npx prisma studio
```

## 架构概览

```
src/
├── app/
│   ├── api/          # API 路由（50+ 端点）
│   ├── dashboard/    # 控制台页面
│   └── login/        # 登录页面
├── components/       # React 组件
├── lib/              # 核心库
│   ├── agnes-client.ts      # AI API 客户端
│   ├── auth.ts/             # 认证模块
│   ├── job-queue.ts         # 异步任务队列
│   ├── image-gen.ts         # 图片生成 & 缓存
│   ├── settings.ts          # 配置管理（DB+缓存）
│   ├── rate-limiter.ts      # 滑动窗口限流
│   └── logger.ts            # 结构化日志
└── middleware.ts     # 全局鉴权中间件
```

## 文档

- [CODE_WIKI.md](./CODE_WIKI.md) — 完整代码文档与 API 参考
- [BUSINESS_ARCHITECTURE.md](./docs/BUSINESS_ARCHITECTURE.md) — 业务架构设计
- [CODE_ANALYSIS_REPORT.md](./CODE_ANALYSIS_REPORT.md) — 代码审计报告

## 许可

Private — All rights reserved.
