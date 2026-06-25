'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/common/Navbar';
import { apiGet } from '@/lib/utils/api-client';
import { Search, LayoutGrid, List, ChevronDown, Folder, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  personality?: string;
  clothing?: string;
  appearance?: string;
  hair?: string;
  eyes?: string;
  build?: string;
  expressions?: string;
  signaturePose?: string;
  colorScheme?: string;
  gender?: string;
  referenceImg?: string;
  role?: string;
  description?: string;
  source?: string;
  appearances?: number;
}

const MOCK_CHARACTERS: Character[] = [
  { id: '1', name: '林远', personality: '勇敢果断', role: '主角', description: '星际探险队队长，勇敢果断，带领团队穿越虫洞寻找新家园。', source: '星际迷途', appearances: 12, gender: '男' },
  { id: '2', name: '苏晴', personality: '聪明理性', role: '主角', description: '天才科学家，负责解读外星文明遗迹中的密码。', source: '星际迷途', appearances: 10, gender: '女' },
  { id: '3', name: '老陈', personality: '沉稳老练', role: '配角', description: '经验丰富的工程师，维护飞船的核心系统。', source: '星际迷途', appearances: 8, gender: '男' },
  { id: '4', name: '影子', personality: '神秘莫测', role: '反派', description: '神秘的外星生命体，似乎在引导探险队走向陷阱。', source: '星际迷途', appearances: 6, gender: '未知' },
  { id: '5', name: '小雨', personality: '活泼开朗', role: '主角', description: '活泼开朗的高中生，意外获得了穿越时空的能力。', source: '校园时光', appearances: 9, gender: '女' },
  { id: '6', name: '李老师', personality: '严厉关心', role: '配角', description: '严厉但关心学生的班主任，隐藏着秘密。', source: '校园时光', appearances: 5, gender: '男' },
];

const AVATAR_GRADIENTS = [
  'from-emerald-500 to-cyan-500',
  'from-violet-500 to-violet-400',
  'from-amber-500 to-amber-400',
  'from-red-500 to-red-400',
  'from-pink-500 to-pink-400',
  'from-slate-500 to-slate-400',
];

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  '主角': { bg: 'bg-gradient-to-r from-emerald-500 to-cyan-500', text: 'text-white' },
  '配角': { bg: 'bg-slate-100', text: 'text-slate-600' },
  '反派': { bg: 'bg-red-50', text: 'text-red-500' },
  '群演': { bg: 'bg-slate-50', text: 'text-slate-500' },
};

type ViewMode = 'grid' | 'list';
type SortOption = 'name' | 'recent' | 'appearances';

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    apiGet<Character[]>('/api/characters')
      .then(data => {
        const merged = data && data.length > 0 ? data : MOCK_CHARACTERS;
        setCharacters(merged);
        setLoading(false);
      })
      .catch(() => {
        setCharacters(MOCK_CHARACTERS);
        setLoading(false);
      });
  }, []);

  const FILTER_TABS = [
    { key: 'all', label: '全部' },
    { key: '主角', label: '主角' },
    { key: '配角', label: '配角' },
    { key: '反派', label: '反派' },
    { key: '群演', label: '群演' },
  ];

  const filteredCharacters = characters
    .filter(ch => {
      if (filter !== 'all' && ch.role !== filter) return false;
      if (search && !ch.name.includes(search) && !ch.description?.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      if (sortBy === 'appearances') return (b.appearances || 0) - (a.appearances || 0);
      return 0;
    });

  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredCharacters.length / itemsPerPage);
  const paginatedCharacters = filteredCharacters.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getAvatarGradient = (index: number) => {
    return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  };

  const getRoleStyle = (role?: string) => {
    return ROLE_STYLES[role || '配角'] || ROLE_STYLES['配角'];
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-8 pb-4 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">角色库</h1>
              <p className="text-sm mt-1 text-slate-500">管理你的漫剧角色</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg p-0.5 bg-slate-50 border border-slate-100">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors">
                  <span>
                    {sortBy === 'name' ? '按名称排序' : sortBy === 'appearances' ? '按出场排序' : '最近创建'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-sm hover:shadow-md transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>创建角色</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-4 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setFilter(tab.key); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    filter === tab.key
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                      : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索角色..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-xl text-sm outline-none bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className={`grid gap-4 ${
              viewMode === 'grid'
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            }`}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-[220px] rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : paginatedCharacters.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <UserPlus className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">暂无角色</h3>
              <p className="text-sm text-slate-500 mb-4">开始创建你的第一个角色吧</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                创建角色
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedCharacters.map((ch, index) => {
                const roleStyle = getRoleStyle(ch.role);
                return (
                  <div
                    key={ch.id}
                    className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="h-32 flex items-center justify-center bg-slate-50 relative overflow-hidden">
                      {ch.referenceImg ? (
                        <img src={ch.referenceImg} alt={ch.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br ${getAvatarGradient(index)}`}>
                          {ch.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold truncate text-slate-900">{ch.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${roleStyle.bg} ${roleStyle.text}`}>
                          {ch.role || '配角'}
                        </span>
                      </div>
                      <p className="text-xs mt-2 line-clamp-2 text-slate-600">
                        {ch.description || ch.personality || '暂无描述'}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="flex items-center gap-1 text-xs whitespace-nowrap text-slate-400">
                          <Folder className="w-3.5 h-3.5" />
                          <span>出自：{ch.source || '未关联'}</span>
                        </span>
                        <span className="text-xs whitespace-nowrap text-slate-400">
                          出场 {ch.appearances || 0} 次
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedCharacters.map((ch, index) => {
                const roleStyle = getRoleStyle(ch.role);
                return (
                  <div
                    key={ch.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer"
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white bg-gradient-to-br ${getAvatarGradient(index)} flex-shrink-0`}>
                      {ch.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900">{ch.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                          {ch.role || '配角'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {ch.description || ch.personality || '暂无描述'}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Folder className="w-3.5 h-3.5" />
                        {ch.source || '未关联'}
                      </span>
                      <span>出场 {ch.appearances || 0} 次</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pb-12 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors ${
                    currentPage === page
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                      : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up">
            <h2 className="text-xl font-bold text-slate-900 mb-4">创建新角色</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">角色名称</label>
                <input type="text" className="input-field" placeholder="输入角色名称" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">角色类型</label>
                <select className="select-field">
                  <option>主角</option>
                  <option>配角</option>
                  <option>反派</option>
                  <option>群演</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">角色描述</label>
                <textarea className="textarea-field" rows={3} placeholder="描述角色的性格、外貌等特征" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 btn-secondary"
              >
                取消
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 btn-primary"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
