// WorkflowSidebar — 左侧固定工作流导航栏
// 参考 Linear / Notion 风格，8步线性流程 + 进度指示器
'use client';
import { TABS } from './types';
import type { TabKey } from './types';
import { useProjectContext } from './ProjectContext';

interface WorkflowSidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export default function WorkflowSidebar({ activeTab, onTabChange }: WorkflowSidebarProps) {
  const { project, characters, scripts, storyboards } = useProjectContext();

  if (!project) return null;

  // 计算各步骤完成状态
  const charsWithRef = characters.filter(c => c.referenceImg).length;
  const hasCompletedScript = scripts.some(s => s.status === 'completed');
  const storyboardsWithImage = storyboards.filter(s => s.imageUrls).length;
  const storyboardsWithVideo = storyboards.filter(s => s.videoUrl).length;
  const hasStoryboards = storyboards.length > 0;
  const hasImages = storyboardsWithImage > 0;

  const stepStatus: Record<string, 'completed' | 'active' | 'locked'> = {
    overview: activeTab === 'overview' ? 'active' : 'active',
    script: hasCompletedScript ? 'completed' : (activeTab === 'script' ? 'active' : 'locked'),
    characters: characters.length > 0 ? 'completed' : !hasCompletedScript ? 'locked' : (activeTab === 'characters' ? 'active' : 'locked'),
    storyboard: hasStoryboards ? 'completed' : !hasCompletedScript ? 'locked' : (activeTab === 'storyboard' ? 'active' : 'locked'),
    voice: activeTab === 'voice' ? 'active' : (hasStoryboards ? 'active' : 'locked'),
    timeline: activeTab === 'timeline' ? 'active' : (hasStoryboards ? 'active' : 'locked'),
    review: activeTab === 'review' ? 'active' : (hasImages ? 'active' : 'locked'),
    publish: activeTab === 'publish' ? 'active' : (hasImages || storyboardsWithVideo > 0 ? 'active' : 'locked'),
  };

  const completedSteps = Object.values(stepStatus).filter(s => s === 'completed').length;
  const totalSteps = TABS.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-white border-r border-border h-full">
      {/* 项目信息 */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-lg flex-shrink-0">
            🎬
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate leading-tight">{project.title}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">{characters.length} 角色 · {storyboards.length} 分镜</p>
          </div>
        </div>
      </div>

      {/* 工作流导航 */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider px-2 mb-2">创作流程</p>
        <ul className="space-y-0.5">
          {TABS.map(tab => {
            const status = stepStatus[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <li key={tab.key}>
                <button
                  onClick={() => onTabChange(tab.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-emerald-50 border border-emerald-200 shadow-sm'
                      : status === 'locked'
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* 状态图标 */}
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                      : status === 'completed'
                        ? 'bg-emerald-100 text-emerald-600'
                        : status === 'locked'
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-gray-100 text-ink-muted group-hover:bg-gray-200'
                  }`}>
                    {status === 'completed' ? '✓' : tab.icon}
                  </span>

                  {/* 标签 */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${
                      isActive
                        ? 'font-semibold text-emerald-700'
                        : status === 'completed'
                          ? 'font-medium text-ink'
                          : status === 'locked'
                            ? 'text-gray-400'
                            : 'text-ink-secondary group-hover:text-ink'
                    }`}>
                      {tab.label}
                    </p>
                    <p className="text-[10px] text-ink-muted leading-tight mt-0.5">{tab.desc}</p>
                  </div>

                  {/* 活跃指示器 */}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 进度指示器 */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-muted">完成进度</span>
          <span className="text-xs font-semibold text-emerald-600">{completedSteps}/{totalSteps}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-[10px] text-ink-muted mt-1.5">{progressPercent}% 完成 · {progressPercent === 100 ? '🎉' : '继续加油！'}</p>
      </div>
    </aside>
  );
}
