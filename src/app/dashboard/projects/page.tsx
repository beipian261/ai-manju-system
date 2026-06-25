'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, LayoutGrid, List, Menu, X, ChevronDown } from 'lucide-react';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { TemplateSelector, mapTemplateGenre, mapTemplateStyle } from '@/components/common/TemplateSelector';
import type { ScriptTemplate } from '@/features/scripts/script-templates';
import { apiGet, apiPost, apiDelete } from '@/lib/utils/api-client';
import { logger } from '@/lib/utils/logger';

interface Project {
  id: string;
  title: string;
  description?: string;
  genre: string;
  style: string;
  status: string;
  characters?: any[];
  storyboards?: any[];
  scripts?: any[];
  createdAt?: string;
  updatedAt?: string;
}

const genreGradientMap: Record<string, string> = {
  'sci-fi': 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
  'fantasy': 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
  'romance': 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
  'action': 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
  'comedy': 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
  'mystery': 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)',
  'adventure': 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
  'youth': 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
};

const genreLabelMap: Record<string, string> = {
  'sci-fi': '科幻',
  'fantasy': '奇幻',
  'romance': '言情',
  'action': '动作',
  'comedy': '喜剧',
  'mystery': '悬疑',
  'adventure': '冒险',
  'youth': '青春',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'var(--color-text-muted)' },
  scripting: { label: '进行中', color: 'var(--state-success)' },
  storyboarding: { label: '进行中', color: 'var(--state-success)' },
  producing: { label: '进行中', color: 'var(--state-success)' },
  completed: { label: '已完成', color: 'var(--state-info)' },
  published: { label: '已发布', color: 'var(--color-text-muted)' },
};

function getProgressPercent(status: string, charCount: number, boardCount: number, hasScript: boolean): number {
  if (status === 'published' || status === 'completed') return 100;
  if (status === 'producing') return 80;
  if (boardCount > 0) return 60;
  if (charCount > 0) return 40;
  if (hasScript) return 25;
  return 15;
}

function getGenreGradient(genre: string): string {
  return genreGradientMap[genre] || 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)';
}

function getGenreLabel(genre: string): string {
  return genreLabelMap[genre] || genre;
}

const demoProjects: Project[] = [
  {
    id: 'demo-1',
    title: '星际迷途',
    description: '探索未知星系的冒险旅程，寻找失落文明的秘密',
    genre: 'sci-fi',
    style: 'anime',
    status: 'storyboarding',
    characters: Array(6),
    storyboards: Array(24),
    scripts: Array(3),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    title: '校园时光',
    description: '记录青春岁月里的友情与成长故事',
    genre: 'youth',
    style: 'anime',
    status: 'scripting',
    characters: Array(4),
    storyboards: Array(18),
    scripts: Array(1),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    title: '古风传奇',
    description: '穿越千年的爱恨情仇，江湖恩怨录',
    genre: 'fantasy',
    style: 'chinese',
    status: 'completed',
    characters: Array(8),
    storyboards: Array(36),
    scripts: Array(5),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    title: '都市传说',
    description: '城市角落里隐藏的神秘事件与都市怪谈',
    genre: 'mystery',
    style: 'realistic',
    status: 'published',
    characters: Array(5),
    storyboards: Array(30),
    scripts: Array(4),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-5',
    title: '童话森林',
    description: '奇幻森林中的精灵冒险，守护自然的秘密',
    genre: 'fantasy',
    style: 'anime',
    status: 'producing',
    characters: Array(3),
    storyboards: Array(12),
    scripts: Array(2),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-6',
    title: '深海探秘',
    description: '深入海底探索未知生物与沉船宝藏的秘密',
    genre: 'adventure',
    style: 'realistic',
    status: 'completed',
    characters: Array(7),
    storyboards: Array(42),
    scripts: Array(6),
    updatedAt: new Date().toISOString(),
  },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { showConfirm, dialog } = useConfirmDialog();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenre, setNewGenre] = useState('fantasy');
  const [newStyle, setNewStyle] = useState('anime');
  const [newOutline, setNewOutline] = useState('');
  const [selectedTpl, setSelectedTpl] = useState<ScriptTemplate | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiGet<Project[]>('/api/projects');
      if (data && data.length > 0) {
        setProjects(data);
      } else {
        setProjects(demoProjects);
      }
    } catch {
      setProjects(demoProjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = projects.filter(p => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'in-progress') return ['scripting', 'storyboarding', 'producing', 'draft'].includes(p.status);
    if (filterStatus === 'completed') return p.status === 'completed';
    if (filterStatus === 'published') return p.status === 'published';
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateLoading(true);
    try {
      const res = await apiPost<{ id: string }>('/api/projects', {
        title: newTitle,
        description: newDesc,
        genre: newGenre,
        style: newStyle,
        outline: newOutline,
      });
      window.location.href = `/dashboard/projects/${res.id}`;
    } catch (e) {
      logger.error('Failed to create project:', e);
    }
    setCreateLoading(false);
  }

  const navItems = [
    { href: '/dashboard', label: '工作台' },
    { href: '/dashboard/projects', label: '项目', active: true },
    { href: '/dashboard/characters', label: '角色库' },
    { href: '/dashboard/settings', label: '设置' },
  ];

  const filterOptions = [
    { key: 'all', label: '全部' },
    { key: 'in-progress', label: '进行中' },
    { key: 'completed', label: '已完成' },
    { key: 'published', label: '已发布' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 border-b relative"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(226,232,240,0.5)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'var(--gradient-primary)' }}
            >
              A
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              AI 漫剧
            </span>
          </Link>

          <button
            className="md:hidden flex items-center justify-center rounded-lg"
            style={{ width: '36px', height: '36px', background: 'var(--color-bg-subtle)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
            ) : (
              <Menu className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
            )}
          </button>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm transition-colors duration-150 hover:opacity-80 relative pb-0.5 no-underline"
                style={{
                  color: item.active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  fontWeight: item.active ? 600 : 400,
                }}
              >
                {item.label}
                {item.active && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: 'var(--brand-primary)' }}
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 hover:opacity-80"
              style={{ background: 'var(--color-bg-subtle)' }}
            >
              <Search className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-white px-4 py-2 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-button)' }}
            >
              <Plus className="w-4 h-4" />
              新建项目
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="md:hidden absolute top-full left-0 right-0 border-b animate-fade-in"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                  style={{
                    color: item.active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    background: item.active ? 'rgba(16,185,129,0.08)' : 'transparent',
                    fontWeight: item.active ? 500 : 400,
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setShowCreate(true);
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white mt-1"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <Plus className="w-4 h-4" />
                新建项目
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold animate-slide-up" style={{ color: 'var(--color-text)' }}>
              项目
            </h1>
            <p className="text-sm mt-1 animate-slide-up stagger-1" style={{ color: 'var(--color-text-secondary)' }}>
              管理你的所有漫剧项目
            </p>
          </div>
          <div className="flex items-center gap-1 animate-slide-up stagger-1">
            <button
              onClick={() => setViewMode('grid')}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150"
              style={{
                background: viewMode === 'grid' ? 'var(--color-bg-subtle)' : 'transparent',
              }}
            >
              <LayoutGrid
                className="w-4 h-4"
                style={{ color: viewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 hover:opacity-80"
              style={{
                background: viewMode === 'list' ? 'var(--color-bg-subtle)' : 'transparent',
              }}
            >
              <List
                className="w-4 h-4"
                style={{ color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4 animate-slide-up stagger-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {filterOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilterStatus(opt.key)}
                className="rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150"
                style={
                  filterStatus === opt.key
                    ? { background: 'var(--gradient-primary)', color: 'white' }
                    : {
                        background: 'var(--color-bg)',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                      }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              最近更新
            </span>
            <ChevronDown className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 animate-slide-up stagger-2">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden animate-pulse"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
              >
                <div className="h-2" style={{ background: 'var(--color-bg-subtle-2)' }} />
                <div className="p-5">
                  <div className="h-4 w-16 rounded mb-3" style={{ background: 'var(--color-bg-subtle-2)' }} />
                  <div className="h-4 w-32 rounded mb-2" style={{ background: 'var(--color-bg-subtle-2)' }} />
                  <div className="h-3 w-full rounded mb-4" style={{ background: 'var(--color-bg-subtle-2)' }} />
                  <div className="h-3 w-24 rounded" style={{ background: 'var(--color-bg-subtle-2)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🎬</div>
            <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
              还没有项目
            </h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              创建你的第一个 AI 漫剧项目，开启创意创作之旅
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-button-lg)' }}
            >
              <Plus className="w-4 h-4" />
              创建第一个项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p, idx) => {
              const charCount = p.characters?.length || 0;
              const boardCount = p.storyboards?.length || 0;
              const hasScript = (p.scripts?.length || 0) > 0;
              const progress = getProgressPercent(p.status, charCount, boardCount, hasScript);
              const status = statusConfig[p.status] || statusConfig.draft;

              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer group block no-underline"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-card)',
                    animationDelay: `${idx * 0.05}s`,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                >
                  <div className="h-2" style={{ background: getGenreGradient(p.genre) }} />
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium rounded-full px-2.5 py-0.5 whitespace-nowrap"
                        style={{
                          background: 'var(--gradient-primary-soft)',
                          color: 'var(--brand-primary)',
                        }}
                      >
                        {getGenreLabel(p.genre)}
                      </span>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                    <h3
                      className="text-sm font-semibold mt-3 truncate group-hover:text-brand-primary transition-colors"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {p.title}
                    </h3>
                    {p.description && (
                      <p
                        className="text-xs mt-1 line-clamp-2"
                        style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
                      >
                        {p.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                        {charCount} 角色 · {boardCount} 分镜
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--color-bg-subtle-2)' }}>
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, background: 'var(--gradient-primary)' }}
                          />
                        </div>
                        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                          {progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center gap-1">
          <button
            className="text-sm px-3 py-1.5 transition-colors duration-150 hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="mr-1">←</span>上一页
          </button>
          <button
            className="w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center text-white"
            style={{ background: 'var(--gradient-primary)' }}
          >
            1
          </button>
          <button
            className="w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors duration-150 hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            2
          </button>
          <button
            className="w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors duration-150 hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            3
          </button>
          <button
            className="text-sm px-3 py-1.5 transition-colors duration-150 hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            下一页<span className="ml-1">→</span>
          </button>
        </div>
      </div>

      {dialog}

      {/* Create Project Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                创建新项目
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <input
                className="input-field"
                placeholder="项目标题"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                autoFocus
              />
              <textarea
                className="textarea-field min-h-[60px]"
                placeholder="故事简介（可选）"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />

              <TemplateSelector
                selectedId={selectedTpl?.id}
                onSelect={(tpl) => {
                  setSelectedTpl(tpl);
                  setNewTitle(tpl.label + ' - ' + new Date().getFullYear());
                  setNewDesc(tpl.description);
                  setNewOutline(tpl.outline);
                  setNewGenre(mapTemplateGenre(tpl.genre));
                  setNewStyle(mapTemplateStyle(tpl.artStyle));
                }}
              />

              {newOutline && (
                <div
                  className="rounded-lg p-2.5"
                  style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium" style={{ color: '#D97706' }}>
                      📖 故事大纲 (已从模板填充，可修改)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewOutline('');
                        setSelectedTpl(null);
                      }}
                      className="text-[10px] underline hover:opacity-80"
                      style={{ color: '#F59E0B' }}
                    >
                      清除模板
                    </button>
                  </div>
                  <textarea
                    className="textarea-field min-h-[80px] text-xs"
                    value={newOutline}
                    onChange={e => setNewOutline(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={createLoading || !newTitle.trim()}
              >
                {createLoading ? '创建中...' : '🎬 创建项目'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-105 z-40"
        style={{ background: 'var(--gradient-primary)' }}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
