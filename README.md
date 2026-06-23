# AI 漫剧生成系统

基于 Agnes AI 免费 API 的 AI 漫剧生成 Web 应用。

## 功能

- 项目管理（创建/编辑/删除）
- 角色管理系统（角色档案 + 一致性控制）
- AI 剧本生成（基于 Agnes Text Model）
- 智能分镜设计（从剧本自动提取）
- AI 图片生成（角色一致性保障）
- 视频动画生成
- 仪表盘和数据统计

## 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + TailwindCSS
- **后端**: Next.js API Routes
- **数据库**: SQLite (Prisma ORM)
- **AI 服务**: Agnes AI Platform (OpenAI 兼容格式)

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Agnes AI API Key

# 3. 初始化数据库
npx prisma db push

# 4. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| AGNES_API_BASE | Agnes AI API 地址 | https://platform.agnes-ai.com/v1 |
| AGNES_API_KEY | 你的 API Key | 必填 |
| AGNES_TEXT_MODEL | 文本模型 | agnes-2.0-flash |
| AGNES_IMAGE_MODEL | 图像模型 | agnes-image-2.1-flash |
| AGNES_VIDEO_MODEL | 视频模型 | agnes-video-v2.0 |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 获取所有项目 |
| POST | /api/projects | 创建项目 |
| GET | /api/characters | 获取所有角色 |
| POST | /api/characters | 创建角色 |
| POST | /api/scripts | AI 生成剧本 |
| POST | /api/storyboards | AI 生成分镜 |
| POST | /api/agnes/chat | 通用聊天 |
| POST | /api/agnes/image | 生成图片 |
| POST | /api/agnes/video | 生成视频 |

## 部署

```bash
# Docker 部署
docker-compose up -d
```