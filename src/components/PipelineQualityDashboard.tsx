'use client';
// PipelineQualityDashboard — 全管线质量看板
// 展示从剧本→分镜→图片→视频的完整质量链路

interface PipelineStage {
  key: string;
  label: string;
  icon: string;
  status: 'completed' | 'active' | 'pending' | 'failed';
  metrics: Array<{
    label: string;
    value: string | number;
    status?: 'good' | 'warning' | 'bad';
  }>;
}

interface PipelineQualityDashboardProps {
  stages: PipelineStage[];
  className?: string;
}

export function PipelineQualityDashboard({
  stages,
  className = '',
}: PipelineQualityDashboardProps) {
  const stageIcons: Record<string, string> = {
    script: '📝',
    storyboard: '🎬',
    image: '🖼️',
    video: '🎞️',
    publish: '🚀',
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">管线质量总览</h3>
          <p className="text-xs text-ink-muted">各环节质量指标一览</p>
        </div>
        <div className="flex items-center gap-1">
          {stages.map(s => (
            <div
              key={s.key}
              className={`w-2.5 h-2.5 rounded-full ${
                s.status === 'completed' ? 'bg-emerald-500' :
                s.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                s.status === 'failed' ? 'bg-red-500' :
                'bg-border'
              }`}
              title={s.label}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stages.map(stage => {
          const allGood = stage.metrics.every(m => m.status === 'good' || !m.status);
          const hasWarning = stage.metrics.some(m => m.status === 'warning');

          return (
            <div
              key={stage.key}
              className={`card p-4 ${
                stage.status === 'active' ? 'border-emerald-200 bg-emerald-50/20' :
                stage.status === 'failed' ? 'border-red-200' :
                ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{stage.icon || stageIcons[stage.key] || '📋'}</span>
                <span className="text-sm font-semibold text-ink">{stage.label}</span>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                  stage.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                  stage.status === 'active' ? 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse' :
                  stage.status === 'failed' ? 'bg-red-50 text-red-600 border border-red-200' :
                  'bg-gray-50 text-ink-muted border border-border'
                }`}>
                  {stage.status === 'completed' ? '已完成' :
                   stage.status === 'active' ? '进行中' :
                   stage.status === 'failed' ? '失败' : '待开始'}
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-1.5">
                {stage.metrics.map(metric => (
                  <div key={metric.label} className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{metric.label}</span>
                    <span className={`font-medium ${
                      metric.status === 'good' ? 'text-emerald-600' :
                      metric.status === 'warning' ? 'text-amber-600' :
                      metric.status === 'bad' ? 'text-red-600' :
                      'text-ink'
                    }`}>
                      {metric.status === 'good' ? '✓ ' : metric.status === 'warning' ? '⚠ ' : metric.status === 'bad' ? '✗ ' : ''}
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Status indicator */}
              <div className={`mt-2 h-0.5 rounded-full ${
                stage.status === 'completed' ? 'bg-emerald-200' :
                stage.status === 'active' ? 'bg-emerald-200' :
                stage.status === 'failed' ? 'bg-red-200' :
                'bg-border'
              }`}>
                {stage.status === 'active' && (
                  <div className="h-full rounded-full bg-emerald-500 w-1/3 animate-pulse" />
                )}
                {stage.status === 'completed' && (
                  <div className="h-full rounded-full bg-emerald-500 w-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
