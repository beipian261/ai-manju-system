'use client';
import { useProjectContext } from './ProjectContext';
import { Stepper } from '@/components/ui/Stepper';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Step } from '@/components/ui/Stepper';
import { ConsistencyDashboard } from '@/components/ConsistencyDashboard';
import { PipelineQualityDashboard } from '@/components/PipelineQualityDashboard';

const STYLE_OPTIONS = [
  { value: 'anime', label: '日系动漫' },
  { value: 'realistic', label: '写实照片' },
  { value: 'cinematic_photo', label: '电影级摄影' },
  { value: 'comic_book', label: '美式漫画' },
  { value: 'manga_bw', label: '日式黑白漫画' },
  { value: 'pixar_3d', label: '皮克斯 3D' },
  { value: 'watercolor', label: '水彩画' },
  { value: 'oil_painting', label: '油画' },
  { value: 'cyberpunk', label: '赛博朋克' },
  { value: 'fantasy', label: '奇幻插画' },
  { value: 'ghibli', label: '吉卜力风格' },
  { value: 'webtoon', label: '韩漫条漫' },
  { value: 'noir', label: '黑色电影' },
  { value: 'cartoon_2d', label: '2D 卡通' },
  { value: 'ink_wash', label: '中国水墨画' },
];

export default function OverviewTab() {
  const {
    project, characters, storyboards, scripts, projectId,
    setActiveTab, updateProject,
  } = useProjectContext();

  if (!project) return null;

  const charsWithRef = characters.filter(c => c.referenceImg).length;
  const hasCompletedScript = scripts.some(s => s.status === 'completed');
  const storyboardsWithImage = storyboards.filter(s => s.imageUrls).length;
  const storyboardsWithVideo = storyboards.filter(s => s.videoUrl).length;
  const hasStoryboards = storyboards.length > 0;
  const hasImages = storyboardsWithImage > 0;
  const hasVideos = storyboardsWithVideo > 0;

  // 8 步线性工作流
  const pipelineSteps: Step[] = [
    {
      id: 'script',
      label: 'AI 生成剧本',
      subtitle: hasCompletedScript ? '已完成' : '待生成',
      icon: '📝',
      status: hasCompletedScript ? 'completed' : 'current',
      onClick: () => setActiveTab('script'),
    },
    {
      id: 'characters',
      label: '创建角色',
      subtitle: characters.length > 0 ? `${characters.length} 个角色` : '待创建',
      icon: '🎭',
      status: characters.length > 0 ? 'completed' : hasCompletedScript ? 'current' : 'current',
      onClick: () => setActiveTab('characters'),
    },
    {
      id: 'refImages',
      label: '角色定妆照',
      subtitle: charsWithRef === characters.length && characters.length > 0 ? '已完成' : `${charsWithRef}/${characters.length}`,
      icon: '📸',
      status: characters.length > 0 && charsWithRef === characters.length ? 'completed' : 'current',
      onClick: () => setActiveTab('characters'),
    },
    {
      id: 'storyboard',
      label: '分镜与图片',
      subtitle: hasStoryboards ? `${storyboardsWithImage}/${storyboards.length} 图` : '待生成',
      icon: '🎬',
      status: hasStoryboards && storyboardsWithImage === storyboards.length ? 'completed' : hasStoryboards ? 'current' : 'current',
      onClick: () => setActiveTab('storyboard'),
    },
    {
      id: 'voice',
      label: '角色配音',
      subtitle: '台词与 BGM',
      icon: '🎙️',
      status: hasImages ? 'current' : 'current',
      onClick: () => setActiveTab('voice'),
    },
    {
      id: 'timeline',
      label: '时间线剪辑',
      subtitle: '编排分镜顺序',
      icon: '🎞️',
      status: hasStoryboards ? 'current' : 'current',
      onClick: () => setActiveTab('timeline'),
    },
    {
      id: 'review',
      label: '评审修改',
      subtitle: '质量审核',
      icon: '✅',
      status: hasImages ? 'current' : 'current',
      onClick: () => setActiveTab('review'),
    },
    {
      id: 'publish',
      label: '发布导出',
      subtitle: '多平台导出',
      icon: '🚀',
      status: hasImages || hasVideos ? 'current' : 'current',
      onClick: () => setActiveTab('publish'),
    },
  ];

  const completedCount = pipelineSteps.filter((_, idx) => {
    if (idx === 0) return hasCompletedScript;
    if (idx === 1) return characters.length > 0;
    if (idx === 2) return characters.length > 0 && charsWithRef === characters.length;
    if (idx === 3) return hasStoryboards && storyboardsWithImage === storyboards.length;
    return false;
  }).length;
  const totalSteps = pipelineSteps.length;
  const percent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 工作流总览 */}
      <Stepper
        title="创作流程"
        description="按顺序完成 8 个步骤，完成你的漫剧作品"
        steps={pipelineSteps}
      />

      {/* 作品数据 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📝" label="剧本" value={scripts.length} sub={hasCompletedScript ? '已完成' : '待生成'} gradient="from-sky-500/10 to-blue-500/5" />
        <StatCard icon="🎭" label="角色" value={characters.length} sub={`${charsWithRef} 张定妆照`} gradient="from-emerald-500/10 to-emerald-500/5" />
        <StatCard icon="🎬" label="分镜" value={storyboards.length} sub={`${storyboardsWithImage} 张图片 · ${storyboardsWithVideo} 个视频`} gradient="from-amber-500/10 to-orange-500/5" />
        <StatCard icon="⚡" label="完成度" value={`${percent}%`} sub={`${completedCount}/${totalSteps} 步`} gradient="from-purple-500/10 to-pink-500/5" />
      </div>

      {/* 项目设置 */}
      <Section title="项目设置" subtitle="统一视觉风格" icon="🎨">
        <Card variant="default" className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">艺术风格</label>
              <select
                value={project.style || 'anime'}
                onChange={async (e) => await updateProject({ style: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white"
              >
                {STYLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">项目类型</label>
              <input
                type="text"
                value={project.genre || ''}
                onChange={async (e) => await updateProject({ genre: e.target.value })}
                placeholder="例如：奇幻 / 言情 / 科幻"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white"
              />
            </div>
          </div>
        </Card>
      </Section>

      {/* 快捷操作 — 引导用户按流程前进 */}
      <Section title="快捷操作" subtitle="点击卡片快速跳转到对应步骤" icon="🚀">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <QuickAction icon="📝" label="生成剧本" desc={`${scripts.filter(s => s.status === 'completed').length}/${scripts.length} 已完成`} onClick={() => setActiveTab('script')} active={!hasCompletedScript} />
          <QuickAction icon="🎭" label="角色管理" desc={`${characters.length} 个角色 · ${charsWithRef} 张定妆照`} onClick={() => setActiveTab('characters')} disabled={!hasCompletedScript} disabledHint="需先生成剧本" />
          <QuickAction icon="🎬" label="生成分镜" desc={`${storyboards.length} 个分镜 · ${storyboardsWithImage} 张图片`} onClick={() => setActiveTab('storyboard')} disabled={!hasCompletedScript} disabledHint="需先生成剧本" />
          <QuickAction icon="🎙️" label="角色配音" desc="为分镜添加配音" onClick={() => setActiveTab('voice')} disabled={!hasStoryboards} disabledHint="需先生成分镜" />
          <QuickAction icon="🎞️" label="时间线" desc="剪辑编排" onClick={() => setActiveTab('timeline')} disabled={!hasStoryboards} disabledHint="需先生成分镜" />
          <QuickAction icon="✅" label="评审修改" desc="质量把控" onClick={() => setActiveTab('review')} disabled={!hasImages} disabledHint="需先生成图片" />
          <QuickAction icon="🚀" label="发布导出" desc="多平台分发" onClick={() => setActiveTab('publish')} disabled={!hasImages && !hasVideos} disabledHint="需先生成素材" />
          <QuickAction icon="📊" label="作品总览" desc="查看完整数据" onClick={() => setActiveTab('overview')} />
        </div>
      </Section>

      {/* 质量仪表盘 */}
      {characters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="角色一致性" subtitle="各角色在分镜中的表现" icon="🎭">
            <ConsistencyDashboard characters={characters} storyboards={storyboards} />
          </Section>
          <Section title="管线质量" subtitle="各环节完成状态" icon="📊">
            <PipelineQualityDashboard
              stages={[
                { key: 'script', label: '剧本', icon: '📝', status: scripts.some(s => s.status === 'completed') ? 'completed' : scripts.length > 0 ? 'active' : 'pending',
                  metrics: [{ label: '剧本数', value: scripts.length }, { label: '已完成', value: scripts.filter(s => s.status === 'completed').length }] },
                { key: 'character', label: '角色', icon: '🎭', status: characters.length > 0 ? 'completed' : 'pending',
                  metrics: [{ label: '角色数', value: characters.length }, { label: '定妆照', value: charsWithRef }] },
                { key: 'storyboard', label: '分镜', icon: '🎬', status: hasStoryboards ? 'completed' : hasCompletedScript ? 'active' : 'pending',
                  metrics: [{ label: '分镜数', value: storyboards.length }] },
                { key: 'image', label: '图片', icon: '🖼️', status: hasImages ? 'completed' : hasStoryboards ? 'active' : 'pending',
                  metrics: [{ label: '已生成', value: storyboardsWithImage }, { label: '总数', value: storyboards.length }] },
                { key: 'video', label: '视频', icon: '🎞️', status: hasVideos ? 'completed' : hasImages ? 'active' : 'pending',
                  metrics: [{ label: '已合成', value: storyboardsWithVideo }] },
                { key: 'voice', label: '配音', icon: '🎙️', status: 'pending', metrics: [{ label: '待配置', value: storyboards.filter(s => s.dialogue).length }] },
              ]}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, gradient }: {
  icon: string; label: string; value: string | number; sub?: string; gradient: string;
}) {
  return (
    <Card variant="default" className="p-5 relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-ink-muted font-medium">{label}</span>
          <span className="text-2xl">{icon}</span>
        </div>
        <p className="text-3xl font-bold text-ink">{value}</p>
        {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
      </div>
    </Card>
  );
}

function QuickAction({ icon, label, desc, onClick, disabled, disabledHint, active }: {
  icon: string; label: string; desc: string; onClick: () => void; disabled?: boolean; disabledHint?: string; active?: boolean;
}) {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`card p-4 transition-all duration-300 group ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : active
            ? 'border-emerald-300 bg-emerald-50/40 cursor-pointer hover:scale-[1.02]'
            : 'hover:border-emerald-100 cursor-pointer hover:scale-[1.02]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl group-hover:scale-110 transition-transform ${
          active ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-emerald-50 border-emerald-100'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm">{label}</p>
          <p className="text-xs text-ink-muted mt-0.5">{disabled ? (disabledHint || desc) : desc}</p>
        </div>
        <Badge variant={disabled ? 'zinc' : active ? 'emerald' : 'sky'}>
          {disabled ? '锁定' : active ? '建议 ↗' : '前往 →'}
        </Badge>
      </div>
    </div>
  );
}
