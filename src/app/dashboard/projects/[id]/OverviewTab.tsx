'use client';
import { Check } from 'lucide-react';
import { useProjectContext } from './ProjectContext';

const WORKFLOW_STEPS = [
  { key: 'script', label: '剧本' },
  { key: 'characters', label: '角色' },
  { key: 'storyboard', label: '分镜' },
  { key: 'voice', label: '配音' },
  { key: 'publish', label: '发布' },
] as const;

const RECENT_ACTIVITIES = [
  { text: '更新了剧本第三章', time: '2小时前', isNew: true },
  { text: '新增角色「林队长」', time: '5小时前', isNew: true },
  { text: '生成了 8 张分镜', time: '1天前', isNew: false },
  { text: '创建了项目', time: '5天前', isNew: false },
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function OverviewTab() {
  const { project, characters, storyboards, scripts, setActiveTab } = useProjectContext();

  if (!project) return null;

  const hasCompletedScript = scripts.some((s) => s.status === 'completed');
  const hasCharacters = characters.length > 0;
  const charsWithRef = characters.filter((c) => c.referenceImg).length;
  const hasStoryboards = storyboards.length > 0;
  const storyboardsWithImage = storyboards.filter((s) => s.imageUrls && s.imageUrls.length > 0).length;
  const storyboardsWithVideo = storyboards.filter((s) => s.videoUrl).length;

  const stepStatuses = [
    hasCompletedScript,
    hasCharacters,
    hasStoryboards && storyboardsWithImage > 0,
    false,
    false,
  ];

  let currentStep = 0;
  for (let i = 0; i < stepStatuses.length; i++) {
    if (!stepStatuses[i]) {
      currentStep = i;
      break;
    }
    if (i === stepStatuses.length - 1 && stepStatuses[i]) {
      currentStep = stepStatuses.length;
    }
  }

  const progressPercent = Math.round((currentStep / WORKFLOW_STEPS.length) * 100);
  const progressLabel = currentStep >= WORKFLOW_STEPS.length
    ? '已完成'
    : `${WORKFLOW_STEPS[currentStep].label}创作中`;

  return (
    <div className="pb-6 animate-fade-in">
      {/* Project Header Card */}
      <div
        className="mx-4 sm:mx-6 mt-4 sm:mt-6 rounded-2xl p-6"
        style={{
          background: 'white',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1
          className="text-xl font-bold"
          style={{
            color: 'var(--color-text)',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
          }}
        >
          {project.title}
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {characters.length} 角色 · {storyboards.length} 分镜 · {scripts.length} 剧本
        </p>
        <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {project.description || '一个精彩的漫剧故事，等待你的创作。'}
        </p>
      </div>

      {/* Progress Card */}
      <div
        className="mx-4 sm:mx-6 mt-4 rounded-2xl p-6"
        style={{
          background: 'white',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <p className="text-xs font-medium mb-4" style={{ color: 'var(--color-text-muted)' }}>
          创作进度
        </p>

        <div className="flex items-start justify-between relative" style={{ padding: '0 8px' }}>
          <div
            className="absolute top-4 left-8 right-8"
            style={{ height: '2px', background: 'var(--color-bg-subtle-2)', zIndex: 0 }}
          />
          <div
            className="absolute top-4 left-8 transition-all duration-500"
            style={{
              height: '2px',
              width: `calc(${(currentStep / WORKFLOW_STEPS.length) * 100}% - 8px)`,
              background: 'var(--gradient-primary)',
              zIndex: 1,
            }}
          />

          {WORKFLOW_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isFuture = idx > currentStep;

            return (
              <button
                key={step.key}
                onClick={() => setActiveTab(step.key as any)}
                className="flex flex-col items-center gap-1.5 relative cursor-pointer transition-transform hover:scale-105"
                style={{ zIndex: 2 }}
              >
                <div
                  className="flex items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    width: '32px',
                    height: '32px',
                    background: isCompleted
                      ? 'var(--gradient-primary)'
                      : isCurrent
                        ? 'white'
                        : 'var(--color-bg-subtle-2)',
                    border: isCurrent ? '2px solid var(--brand-primary)' : 'none',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(16,185,129,0.12)' : 'none',
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: isCurrent ? 'var(--brand-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span
                  className="text-xs"
                  style={{
                    color: isCurrent
                      ? 'var(--brand-primary)'
                      : isCompleted
                        ? 'var(--color-text)'
                        : 'var(--color-text-muted)',
                    fontWeight: isCurrent ? 500 : 400,
                  }}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="mt-4 rounded-full overflow-hidden"
          style={{ height: '8px', background: 'var(--color-bg-subtle-2)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%`, background: 'var(--gradient-primary)' }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {progressPercent}% — {progressLabel}
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="mx-4 sm:mx-6 mt-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Activities */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'white',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            最近动态
          </h3>

          {RECENT_ACTIVITIES.map((activity, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 py-3"
              style={{
                borderBottom:
                  idx < RECENT_ACTIVITIES.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}
            >
              <div
                className="rounded-full mt-1.5 flex-shrink-0"
                style={{
                  width: '8px',
                  height: '8px',
                  background: activity.isNew ? 'var(--brand-primary)' : '#94A3B8',
                }}
              />
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                  {activity.text}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Project Info */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'white',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            项目信息
          </h3>

          <div
            className="flex justify-between items-center py-3"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              创建时间
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>
              {formatDate(project.createdAt)}
            </span>
          </div>
          <div
            className="flex justify-between items-center py-3"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              最后更新
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>
              {formatDate(project.updatedAt)}
            </span>
          </div>
          <div
            className="flex justify-between items-center py-3"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              创作者
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>
              张明
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              状态
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--brand-primary)' }}>
              {project.status === 'completed' ? '已完成' : '进行中'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
