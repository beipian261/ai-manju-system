'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Save, Upload, ChevronRight } from 'lucide-react';
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
import CommandPalette from './CommandPalette';
import SmartAssistant from '@/components/features/SmartAssistant';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';

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
    project,
    loading,
    error,
    activeTab,
    setActiveTab,
    characters,
    storyboards,
    scripts,
    projectId,
  } = useProjectContext();
  const { dialog } = useConfirmDialog();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header
          className="flex items-center justify-between px-4 flex-shrink-0"
          style={{
            height: '52px',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(226,232,240,0.5)',
          }}
        >
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </header>
        <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-subtle)' }}>
          <div className="animate-pulse text-sm" style={{ color: 'var(--color-text-muted)' }}>
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg-subtle)' }}>
        <header
          className="flex items-center justify-between px-4"
          style={{
            height: '52px',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(226,232,240,0.5)',
          }}
        >
          <Link href="/dashboard/projects" className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-md"
              style={{ width: '28px', height: '28px', background: 'var(--gradient-primary)' }}
            >
              <span className="text-white font-bold" style={{ fontSize: '14px' }}>A</span>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>AI 漫剧</span>
          </Link>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            {error || '项目不存在'}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            请检查项目 ID 或返回项目列表
          </p>
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--gradient-primary)' }}
          >
            返回项目列表
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    // Save functionality - can be extended
  };

  const handlePublish = () => {
    setActiveTab('publish');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'script':
        return <ScriptTab />;
      case 'characters':
        return <CharactersTab />;
      case 'storyboard':
        return <StoryboardTab />;
      case 'voice':
        return <VoiceTab />;
      case 'timeline':
        return <TimelineTab />;
      case 'review':
        return <ReviewTab />;
      case 'publish':
        return <PublishTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Top Bar - Glass Effect */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: '52px',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.5)',
          zIndex: 50,
        }}
      >
        {/* Left: Logo */}
        <Link href="/dashboard/projects" className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-md"
            style={{ width: '28px', height: '28px', background: 'var(--gradient-primary)' }}
          >
            <span className="text-white font-bold" style={{ fontSize: '14px' }}>A</span>
          </div>
          <span className="font-semibold text-sm hidden sm:block" style={{ color: 'var(--color-text)' }}>
            AI 漫剧
          </span>
        </Link>

        {/* Center: Breadcrumb */}
        <nav className="hidden sm:flex items-center gap-1.5">
          <Link
            href="/dashboard/projects"
            className="text-xs transition-colors hover:opacity-70"
            style={{ color: 'var(--color-text-muted)' }}
          >
            项目
          </Link>
          <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs font-medium truncate max-w-[200px]" style={{ color: 'var(--color-text)' }}>
            {project.title}
          </span>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:opacity-80"
            style={{
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              background: 'white',
            }}
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">保存</span>
          </button>
          <button
            onClick={handlePublish}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90"
            style={{
              background: 'var(--gradient-primary)',
              boxShadow: 'var(--shadow-button)',
            }}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">发布</span>
          </button>
        </div>
      </header>

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Sidebar (includes mobile tab bar) */}
        <WorkflowSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--color-bg-subtle)' }}
        >
          {renderTabContent()}
        </div>
      </div>

      <SmartAssistant projectId={projectId} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {dialog}
    </main>
  );
}
