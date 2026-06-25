// 共享类型定义 — 从 page.tsx 提取，供主页面和子组件复用
// 常量统一从 @/lib/config/constants 导入，这里只做重新导出方便引用

import type { Project as PrismaProject, Character as PrismaCharacter, Script as PrismaScript, Storyboard as PrismaStoryboard } from '@prisma/client';
export { TABS, STATUS_CONFIG, getVideoStatusLabel } from '@/lib/config/constants';
export type { TabKey } from '@/lib/config/constants';

// 前端使用的扩展类型（包含关联数据）
export interface Project extends PrismaProject {
  characters?: Character[];
  scripts?: Script[];
}

export interface Character extends PrismaCharacter {}

export interface Script extends PrismaScript {}

export interface Storyboard extends PrismaStoryboard {
  comments?: Array<{ id: string; text: string; author?: string }>;
}

export interface ProgressInfo {
  progress: number;
  message: string;
  status: string;
}
