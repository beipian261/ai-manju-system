// ============================================================
// 共享常量 — 项目中多处使用的配置数据
// 单独维护，避免多文件重复定义
// ============================================================

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
};
