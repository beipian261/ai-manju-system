// ============================================================
// 共享常量 — 项目中多处使用的配置数据
// 单独维护，避免多文件重复定义
// ============================================================

/** 允许的项目题材类型 */
export const ALLOWED_GENRES: readonly string[] = [
  'fantasy', 'sci-fi', 'romance', 'action', 'comedy',
  'horror', 'mystery', 'unknown', 'historical', 'thriller', 'wuxia',
];

/** 允许的画风类型 */
export const ALLOWED_STYLES: readonly string[] = [
  'anime', 'western', 'chinese', 'realistic', 'watercolor',
  'pixel', 'chibi', 'cinematic_photo', 'comic_book', 'manga_bw',
  'pixar_3d', 'oil_painting', 'cyberpunk', 'fantasy', 'ghibli',
  'webtoon', 'vintage', 'disney', 'noir', 'cartoon_2d',
  'low_poly', 'ink_wash',
];

/** 允许的项目状态 */
export const ALLOWED_STATUSES: readonly string[] = ['draft', 'scripting', 'storyboarding', 'producing', 'completed'];

/** 项目状态配置：标签文字与 CSS 类名 */
export const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'badge-zinc' },
  scripting: { label: '剧本生成中', cls: 'badge-amber' },
  storyboarding: { label: '分镜设计中', cls: 'badge-blue' },
  producing: { label: '制作中', cls: 'badge-purple' },
  completed: { label: '已完成', cls: 'badge-emerald' },
};

/** 题材类型 → Emoji 图标映射 */
export const genreIcons: Record<string, string> = {
  fantasy: '🧙',
  'sci-fi': '🚀',
  romance: '💕',
  action: '⚔️',
  comedy: '🎭',
  mystery: '🔍',
  historical: '📜',
  thriller: '😱',
  wuxia: '⚔️',
  horror: '👻',
};

/** 视频状态 → 中文标签 */
export function getVideoStatusLabel(status?: string): string {
  switch (status) {
    case 'queued': return '排队中';
    case 'in_progress': return '生成中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    default: return '排队中';
  }
}

/** Tab 配置 - 使用 lucide-react 图标名称 */
export const TABS = [
  { key: 'overview', label: '概览', icon: 'LayoutDashboard', desc: '工作流总览' },
  { key: 'script', label: '剧本', icon: 'FileText', desc: 'AI 生成剧本' },
  { key: 'characters', label: '角色', icon: 'Users', desc: '角色设定与定妆' },
  { key: 'storyboard', label: '分镜', icon: 'Film', desc: '分镜设计与图片' },
  { key: 'voice', label: '配音', icon: 'Mic', desc: '角色配音与音效' },
  { key: 'timeline', label: '时间线', icon: 'Clock', desc: '视频剪辑编排' },
  { key: 'review', label: '评审', icon: 'Eye', desc: '质量审核修改' },
  { key: 'publish', label: '发布', icon: 'Rocket', desc: '多平台导出' },
] as const;

export type TabKey = 'overview' | 'script' | 'characters' | 'storyboard' | 'voice' | 'timeline' | 'review' | 'publish';
