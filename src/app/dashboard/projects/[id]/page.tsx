'use client';
// 项目详情页 — 左侧固定工作流导航 + 右侧主内容区
// 统一线性工作流：概览 → 剧本 → 角色 → 分镜 → 配音 → 时间线 → 评审 → 发布
import { useParams } from 'next/navigation';
import { ProjectProvider, useProjectContext } from './ProjectContext';
import { TABS } from './types';
import type { TabKey } from './types';
import OverviewTab from './OverviewTab';
import CharactersTab from './CharactersTab';
import ScriptTab from './ScriptTab';
import StoryboardTab from './StoryboardTab';
import VoiceTab from './VoiceTab';
import TimelineTab from './TimelineTab';
import ReviewTab from './ReviewTab';
import PublishTab from './PublishTab';
import WorkflowSidebar from './WorkflowSidebar';
import SmartAssistant from '@/components/SmartAssistant';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { Navbar } from '@/components/navbar';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.id as string;
  if (!projectId) return null;
  return (
    <ProjectProvider projectId={projectId}>
      <ProjectContent />
    </ProjectProvider>
  );
}

function ProjectContent() {
  const {
    project, loading, error, activeTab, setActiveTab,
    updateProject, deleteProject, characters, storyboards, scripts,
    projectId,
  } = useProjectContext();
  const { showConfirm, dialog } = useConfirmDialog();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="card h-24 w-96 p-6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="card text-center py-20">
            <div className="text-6xl mb-6">🔍</div>
            <h2 className="text-xl font-bold text-ink mb-3">{error || '项目不存在'}</h2>
            <p className="text-sm text-ink-muted">请检查项目 ID 或返回首页</p>
          </div>
        </div>
      </div>
    );
  }

  // 计算当前 Tab 在 TABS 中的索引
  const currentTabIndex = TABS.findIndex(t => t.key === activeTab);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 全局顶栏 */}
      <div className="h-14 border-b border-border bg-white flex items-center px-6 gap-4 flex-shrink-0 z-10">
        <Navbar />
        <div className="flex-1" />
        {/* 面包屑 */}
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span>项目</span>
          <span>/</span>
          <span className="text-ink font-medium truncate max-w-[200px]">{project.title}</span>
        </div>
        {/* 快捷操作 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newTitle = window.prompt('编辑项目标题', project.title);
              if (newTitle) updateProject({ title: newTitle });
            }}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            ✏️
          </button>
          <button
            onClick={async () => {
              if (await showConfirm('删除项目', '确定删除这个项目吗？所有数据将永久丢失')) await deleteProject();
            }}
            className="btn-danger px-3 py-1.5 text-xs"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 主体：左侧导航 + 右侧内容 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧工作流导航 */}
        <WorkflowSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 右侧主内容区 */}
        <main className="flex-1 overflow-y-auto">
          {/* 项目标题区 */}
          <div className="px-8 pt-6 pb-4 border-b border-border bg-white sticky top-0 z-[5]">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-ink">{project.title}</h1>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="badge badge-emerald">{project.genre || '未分类'}</span>
                  <span className="badge badge-zinc">{project.style || '默认风格'}</span>
                  <span className="text-xs text-ink-muted">
                    {characters.length} 角色 · {storyboards.length} 分镜 · {scripts.length} 剧本
                  </span>
                </div>
                {project.description && (
                  <p className="text-sm text-ink-muted mt-1.5 max-w-2xl line-clamp-1">{project.description}</p>
                )}
              </div>

              {/* 步骤指示器 */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right hidden md:block">
                  <p className="text-xs text-ink-muted">当前步骤</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {TABS[currentTabIndex]?.icon} {TABS[currentTabIndex]?.label}
                  </p>
                </div>
                <div className="flex gap-1">
                  {TABS.map((tab, idx) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      title={tab.label}
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all ${
                        idx === currentTabIndex
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : idx < currentTabIndex
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {idx < currentTabIndex ? '✓' : tab.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tab 内容 */}
          <div className="p-8">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'script' && <ScriptTab />}
            {activeTab === 'characters' && <CharactersTab />}
            {activeTab === 'storyboard' && <StoryboardTab />}
            {activeTab === 'voice' && <VoiceTab />}
            {activeTab === 'timeline' && <TimelineTab />}
            {activeTab === 'review' && <ReviewTab />}
            {activeTab === 'publish' && <PublishTab />}
          </div>
        </main>
      </div>

      <SmartAssistant projectId={projectId} />
      {dialog}
    </div>
  );
}
