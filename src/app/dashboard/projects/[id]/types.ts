// 共享类型定义 — 从 page.tsx 提取，供主页面和子组件复用

export interface Project {
  id: string;
  title: string;
  description?: string;
  genre: string;
  style: string;
  status: string;
  characters?: Character[];
  scripts?: Script[];
}

export interface Character {
  id: string;
  name: string;
  age?: string;
  gender?: string;
  personality?: string;
  clothing?: string;
  appearance?: string;
  hair?: string;
  eyes?: string;
  build?: string;
  referenceImg?: string;
  projectId?: string;
}

export interface Script {
  id: string;
  outline: string;
  content: string;
  status: string;
  projectId?: string;
}

export interface Storyboard {
  id: string;
  scriptId: string;
  sceneNum: number;
  description: string;
  cameraAngle: string;
  dialogue?: string;
  emotion?: string;
  imagePrompt?: string;
  imageUrls?: string;
  videoUrl?: string;
  videoTaskId?: string;
  videoStatus?: string;
  projectId?: string;
  duration?: number | null;
  qualityScore?: number | null;
  charactersInScene?: string;
  reviewStatus?: string;
  comments?: Array<{ id: string; text: string; author?: string }>;
}

export interface ProgressInfo {
  progress: number;
  message: string;
  status: string;
}

// ========== 常量 ==========

export function getVideoStatusLabel(status?: string): string {
  switch (status) {
    case 'queued': return '排队中';
    case 'in_progress': return '生成中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    default: return '排队中';
  }
}

export const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'badge-stone' },
  scripting: { label: '剧本生成中', cls: 'badge-amber' },
  storyboarding: { label: '分镜设计中', cls: 'badge-blue' },
  producing: { label: '制作中', cls: 'badge-purple' },
  completed: { label: '已完成', cls: 'badge-green' },
};

export const TABS = [
  { key: 'overview', label: '概览', icon: '📊', desc: '工作流总览' },
  { key: 'script', label: '剧本', icon: '📝', desc: 'AI 生成剧本' },
  { key: 'characters', label: '角色', icon: '🎭', desc: '角色设定与定妆' },
  { key: 'storyboard', label: '分镜', icon: '🎬', desc: '分镜设计与图片' },
  { key: 'voice', label: '配音', icon: '🎙️', desc: '角色配音与音效' },
  { key: 'timeline', label: '时间线', icon: '🎞️', desc: '视频剪辑编排' },
  { key: 'review', label: '评审', icon: '✅', desc: '质量审核修改' },
  { key: 'publish', label: '发布', icon: '🚀', desc: '多平台导出' },
] as const;

export type TabKey = typeof TABS[number]['key'];
