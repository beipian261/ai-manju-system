'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { STATUS_CONFIG, genreIcons } from '@/lib/constants';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { TemplateSelector, mapTemplateGenre, mapTemplateStyle } from '@/components/TemplateSelector';
import type { ScriptTemplate } from '@/lib/script-templates';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { logger } from '@/lib/logger';

interface Project { id: string; title: string; description?: string; genre: string; style: string; status: string; }

const genreOptions = [
  { value: 'fantasy', label: '奇幻', icon: '🧙' },
  { value: 'sci-fi', label: '科幻', icon: '🚀' },
  { value: 'romance', label: '言情', icon: '💕' },
  { value: 'action', label: '动作', icon: '⚔️' },
  { value: 'comedy', label: '喜剧', icon: '🎭' },
  { value: 'mystery', label: '悬疑', icon: '🔍' },
];

const styleOptions = [
  { value: 'anime', label: '日式动漫', icon: '🌸' },
  { value: 'western', label: '美式漫画', icon: '💥' },
  { value: 'chinese', label: '国风水墨', icon: '🎋' },
  { value: 'realistic', label: '写实风格', icon: '📷' },
  { value: 'pixel', label: '像素', icon: '👾' },
  { value: 'chibi', label: 'Q版', icon: '🎀' },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const { showConfirm, dialog } = useConfirmDialog();

  // Create modal state
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
      setProjects(await apiGet<Project[]>('/api/projects'));
    } catch { setError('加载项目列表失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const filteredProjects = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await showConfirm('批量删除', `确定删除选中的 ${selectedIds.size} 个项目吗？所有数据将永久丢失。`)) return;

    setDeleting(true);
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        const res = await apiDelete(`/api/projects/${id}`);
        if (res) deleted++;
      } catch { /* skip */ }
    }
    setSelectedIds(new Set());
    await loadProjects();
    setDeleting(false);
  };

  const handleSingleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!await showConfirm('删除项目', `确定删除「${title}」吗？所有数据将永久丢失。`)) return;
    await apiDelete(`/api/projects/${id}`);
    await loadProjects();
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateLoading(true);
    try {
      const res = await apiPost<{ id: string }>('/api/projects', { title: newTitle, description: newDesc, genre: newGenre, style: newStyle, outline: newOutline });
      window.location.href = `/dashboard/projects/${res.id}`;
    } catch (e) { logger.error('Failed to create project:', e); }
    setCreateLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><div className="h-10 w-48 rounded skeleton mb-2"></div><div className="h-5 w-32 rounded skeleton"></div></div>
          <div className="h-11 w-40 rounded skeleton"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 rounded-2xl skeleton"></div>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-red-600 mb-4 text-lg">{error}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          <span className="mr-2">🔄</span> 重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">我的项目</h1>
          <p className="text-sm text-ink-secondary">共 {projects.length} 个项目</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><span className="mr-2">✨</span>创建新项目</button>
      </div>

      {/* Search & Filter + Batch bar */}
      <div className="card-subtle p-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">🔍</span>
            <input className="input-field pl-12" placeholder="搜索项目标题或描述..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select-field sm:w-48" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="scripting">剧本生成中</option>
            <option value="storyboarding">分镜设计中</option>
            <option value="producing">制作中</option>
            <option value="completed">已完成</option>
          </select>
          {projects.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer flex-shrink-0">
              <input type="checkbox" checked={selectedIds.size === filteredProjects.length && filteredProjects.length > 0}
                onChange={toggleSelectAll} className="accent-emerald-500" />
              全选
            </label>
          )}
        </div>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-card px-5 py-3 animate-slide-up">
          <span className="text-sm text-emerald-700 font-medium">已选择 {selectedIds.size} 个项目</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-xs px-3 py-1.5">取消选择</button>
            <button onClick={handleBatchDelete} disabled={deleting} className="btn-danger btn-sm">
              {deleting ? '删除中...' : `🗑️ 删除 ${selectedIds.size} 个`}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="card text-center py-20 animate-slide-up">
          <div className="text-6xl mb-6">🎬</div>
          <h2 className="text-xl font-bold text-ink mb-3">还没有项目</h2>
          <p className="text-ink-secondary mb-8 max-w-md mx-auto">创建你的第一个 AI 漫剧项目，开启创意创作之旅</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary"><span className="mr-2">✨</span>创建第一个项目</button>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length > 0 && (
        <>
          {filteredProjects.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-ink-secondary">没有找到匹配的项目</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((p, idx) => {
                const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                const isSelected = selectedIds.has(p.id);
                return (
                  <div key={p.id} className={`relative card p-0 animate-slide-up group ${isSelected ? 'border-emerald-400 bg-emerald-50/20' : ''}`}
                    style={{ animationDelay: `${idx * 0.03}s` }}>
                    <Link href={`/dashboard/projects/${p.id}`} className="block p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            {genreIcons[p.genre] || '📖'}
                          </div>
                        </div>
                        <span className={statusCfg.cls}>{statusCfg.label}</span>
                      </div>
                      <h3 className="font-bold text-lg text-ink mb-2 group-hover:text-emerald-700 transition-colors line-clamp-1">{p.title}</h3>
                      <p className="text-sm text-ink-muted mb-3">{p.genre} · {p.style}</p>
                      {p.description && (
                        <p className="text-sm text-ink-secondary leading-relaxed line-clamp-2 mb-4">{p.description}</p>
                      )}
                      <div className="pt-4 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-ink-muted">点击进入详情</span>
                        <span className="text-emerald-600 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">→</span>
                      </div>
                    </Link>
                    {/* Checkbox overlay */}
                    <div className="absolute top-3 left-3 z-10" onClick={(e) => e.preventDefault()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
                    </div>
                    {/* Delete button */}
                    <button onClick={(e) => handleSingleDelete(e, p.id, p.title)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-ink-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="删除项目">
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {dialog}

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">创建新项目</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-lg hover:bg-base-bg flex items-center justify-center text-ink-muted transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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

              {/* Template Selector */}
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
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-amber-700 font-medium">📖 故事大纲 (已从模板填充，可修改)</span>
                    <button
                      type="button"
                      onClick={() => { setNewOutline(''); setSelectedTpl(null); }}
                      className="text-[10px] text-amber-500 hover:text-amber-700 underline"
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-ink-muted mb-1.5">题材</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {genreOptions.map(g => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setNewGenre(g.value)}
                        className={`p-2 rounded-lg text-xs font-medium transition-all ${
                          newGenre === g.value
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-base-bg text-ink-secondary border border-border'
                        }`}
                      >
                        {g.icon} {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1.5">风格</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {styleOptions.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setNewStyle(s.value)}
                        className={`p-2 rounded-lg text-xs font-medium transition-all ${
                          newStyle === s.value
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-base-bg text-ink-secondary border border-border'
                        }`}
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={createLoading || !newTitle.trim()}>
                {createLoading ? '创建中...' : '🎬 创建项目'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
