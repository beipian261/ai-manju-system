'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import DNAPanel from '@/components/DNAPanel';

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
}

const MOCK_CHARACTERS = [
  { id: '1', name: '林晚月', personality: '冷静 / 理性 / 执着', clothing: '黑色风衣 / 白手套', appearance: '短发 / 冷峻眼神', hair: '黑色短发', eyes: '深灰', build: '纤细', expressions: '冷漠 / 沉思', signaturePose: '推眼镜 / 皱眉', colorScheme: '黑+银白', gender: '女' },
  { id: '2', name: '顾北辰', personality: '热情 / 正直 / 冲动', clothing: '牛仔夹克 / 红围巾', appearance: '蓬松卷发 / 浓眉', hair: '棕色卷发', eyes: '琥珀色', build: '健壮', expressions: '开朗 / 愤怒', signaturePose: '握拳 / 叉腰', colorScheme: '蓝+暖橙', gender: '男' },
  { id: '3', name: '陆景琛', personality: '阴沉 / 算计 / 执念', clothing: '深灰西装 / 银色袖扣', appearance: '梳背头 / 冷面', hair: '黑色背头', eyes: '浅蓝', build: '高瘦', expressions: '冷笑 / 凝视', signaturePose: '双手插兜 / 侧身回眸', colorScheme: '深灰+暗金', gender: '男' },
  { id: '4', name: '叶知秋', personality: '聪慧 / 忠诚 / 内敛', clothing: '白大褂 / 圆框眼镜', appearance: '马尾辫 / 雀斑', hair: '深棕色马尾', eyes: '棕色', build: '娇小', expressions: '专注 / 微笑', signaturePose: '推眼镜 / 记录笔记', colorScheme: '白+墨绿', gender: '女' },
  { id: '5', name: '沈墨', personality: '神秘 / 果断 / 孤独', clothing: '黑色帽衫 / 皮手套', appearance: '遮目长发 / 苍白', hair: '黑色长发', eyes: '深褐', build: '中等', expressions: '沉默 / 凌厉', signaturePose: '拉帽 / 半掩面', colorScheme: '黑+暗红', gender: '男' },
  { id: '6', name: '苏染', personality: '开朗 / 乐观 / 治愈', clothing: '碎花裙 / 帆布鞋', appearance: '双马尾 / 圆脸', hair: '棕色双马尾', eyes: '翠绿', build: '娇小', expressions: '大笑 / 感动', signaturePose: '比耶 / 跳跃', colorScheme: '粉+米白', gender: '女' },
];

const RELATION_COLORS: Record<string, string> = { '搭档': 'text-amber-600', '对手': 'text-red-600', '下属': 'text-emerald-600', '师徒': 'text-emerald-600', '朋友': 'text-sky-600' };

const colorMap: Record<string, string> = {
  '黑+银白': 'from-zinc-700 to-zinc-300',
  '蓝+暖橙': 'from-sky-600 to-amber-400',
  '深灰+暗金': 'from-stone-600 to-amber-700',
  '白+墨绿': 'from-stone-100 to-emerald-800',
  '黑+暗红': 'from-zinc-800 to-red-700',
  '粉+米白': 'from-pink-300 to-stone-100',
};

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/characters')
      .then(r => r.json())
      .then(data => {
        const merged = data && data.length > 0 ? data : MOCK_CHARACTERS;
        setCharacters(merged);
        setSelected(merged[0]);
        setLoading(false);
      })
      .catch(() => {
        setCharacters(MOCK_CHARACTERS);
        setSelected(MOCK_CHARACTERS[0]);
        setLoading(false);
      });
  }, []);

  const FILTER_TABS = [
    { key: 'all', label: '全部', count: characters.length },
    { key: 'lead', label: '主角', count: 2 },
    { key: 'support', label: '配角', count: 2 },
    { key: 'villain', label: '反派', count: 1 },
    { key: 'npc', label: 'NPC', count: 1 },
  ];

  const getRelationColor = (rel: string) => {
    for (const [k, v] of Object.entries(RELATION_COLORS)) {
      if (rel.includes(k)) return v;
    }
    return 'text-ink-muted';
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">角色资料库</h1>
            <p className="text-sm text-ink-secondary">管理和编辑你的角色</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="input-field pl-10 w-60 text-sm"
                placeholder="搜索角色..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-primary btn-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              新建角色
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b border-border px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 py-2">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`tab-item ${filter === tab.key ? 'active' : ''}`}
              >
                {tab.label} <span className="opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-4 h-[calc(100vh-200px)]">
          {/* Cards Grid */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-[232px] rounded-2xl skeleton" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {characters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelected(ch)}
                    className={`text-left p-5 rounded-card border transition-all duration-200 ${
                      selected?.id === ch.id
                        ? 'card-emerald'
                        : 'card hover:border-emerald-100'
                    }`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      {/* Avatar */}
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorMap[ch.colorScheme || ''] || 'from-stone-400 to-stone-600'} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-2xl font-bold text-white">{ch.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-ink text-base truncate">{ch.name}</h3>
                          <span className="badge badge-emerald text-[10px]">{ch.gender === '女' ? '女主' : ch.gender === '男' ? '男主' : '配角'}</span>
                        </div>
                        <p className="text-xs text-ink-muted line-clamp-2 mb-2">{ch.personality}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-ink-muted w-8">外貌</span>
                            <span className="text-xs text-ink-secondary truncate">{ch.appearance}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-ink-muted w-8">服装</span>
                            <span className="text-xs text-ink-secondary truncate">{ch.clothing}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-muted">一致性</span>
                      <div className="flex-1 progress-track sm">
                        <div className="progress-fill" style={{ width: `${85 + Math.random() * 12}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600">{Math.round(85 + Math.random() * 10)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="w-[380px] flex-shrink-0 overflow-y-auto scrollbar-thin">
              <div className="card p-6 sticky top-0">
                {/* Large Avatar */}
                <div className={`w-full h-[120px] rounded-2xl bg-gradient-to-br ${colorMap[selected.colorScheme || ''] || 'from-stone-400 to-stone-600'} flex items-center justify-center mb-4`}>
                  <span className="text-5xl font-bold text-white opacity-80">{selected.name[0]}</span>
                </div>

                {/* Name Row */}
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-xl font-bold text-ink">{selected.name}</h2>
                  <span className="badge badge-emerald text-xs">
                    {selected.gender === '女' ? '女主角' : selected.gender === '男' ? '男主角' : '配角'}
                  </span>
                </div>

                <div className="divider mb-5" />

                {/* Attributes */}
                <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">角色属性</h3>
                <div className="space-y-2.5 mb-5">
                  {[
                    { label: '外貌', value: selected.appearance },
                    { label: '性格', value: selected.personality },
                    { label: '服装', value: selected.clothing },
                    { label: '标志动作', value: selected.signaturePose },
                    { label: '表情', value: selected.expressions },
                    { label: '主色调', value: selected.colorScheme },
                  ].map(attr => (
                    attr.value && (
                      <div key={attr.label} className="flex items-start gap-3">
                        <span className="text-xs text-ink-muted w-16 flex-shrink-0">{attr.label}</span>
                        <span className="text-xs font-medium text-ink-secondary">{attr.value}</span>
                      </div>
                    )
                  ))}
                </div>

                {/* Consistency Score */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-ink-secondary">一致性评分</span>
                  <span className="text-lg font-bold text-emerald-600">92%</span>
                </div>
                <div className="progress-track md mb-5">
                  <div className="progress-fill" style={{ width: '92%' }} />
                </div>

                {/* DNA 面板 */}
                <div className="mb-5">
                  <DNAPanel
                    characterId={selected.id}
                    projectId=""
                    initialDNA={{
                      dnaSummary: null,
                      dnaLocked: false,
                      referenceImg: null,
                    }}
                  />
                </div>

                <div className="divider mb-5" />

                {/* Relations */}
                <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">角色关系</h3>
                <div className="space-y-2.5 mb-5">
                  {[
                    { name: '顾北辰', rel: '搭档 / 互信' },
                    { name: '陆景琛', rel: '对手 / 对立' },
                    { name: '叶知秋', rel: '下属 / 师徒' },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{r.name}</span>
                      <span className={`text-xs ${getRelationColor(r.rel)}`}>{r.rel}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="flex-1 btn-primary btn-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    编辑
                  </button>
                  <button className="flex-1 btn-secondary btn-sm">
                    引用角色
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
