// Stepper — 线性流程步骤引导
// 纯白极简主题
'use client';

export type StepStatus = 'completed' | 'current' | 'upcoming';

export interface Step {
  id: string;
  label: string;
  subtitle?: string;
  icon?: string;
  status: StepStatus;
  onClick?: () => void;
}

export interface StepperProps {
  steps: Step[];
  title?: string;
  description?: string;
  className?: string;
}

const STATUS_STYLES = {
  completed: {
    circle: 'bg-emerald-500 text-white border border-emerald-400',
    title: 'text-ink',
    subtitle: 'text-ink-muted',
    icon: '✓',
  },
  current: {
    circle: 'bg-emerald-500 text-white border border-emerald-400 shadow-glow-emerald',
    title: 'text-ink font-semibold',
    subtitle: 'text-ink-muted',
  },
  upcoming: {
    circle: 'bg-gray-50 text-ink-muted border border-border',
    title: 'text-ink-muted',
    subtitle: 'text-ink-muted/60',
  },
};

export function Stepper({ steps, title, description, className = '' }: StepperProps) {
  const totalSteps = steps.length;
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div className={`card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          {title && <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>}
          {description && <p className="text-sm text-ink-muted">{description}</p>}
          <p className="text-xs text-ink-muted mt-2">
            <span className="text-emerald-600">{completedCount}</span> / {totalSteps} 步骤已完成
          </p>
        </div>

        {/* Progress Ring */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F0F0F0" strokeWidth="2.5" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke="#10b981" strokeWidth="2.5"
              strokeDasharray={`${progress}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-ink">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((step, idx) => {
          const style = STATUS_STYLES[step.status];
          const isClickable = !!step.onClick;

          return (
            <div
              key={step.id}
              onClick={isClickable ? step.onClick : undefined}
              className={`relative p-4 rounded-xl border transition-all duration-300 cursor-pointer group animate-slide-up ${
                step.status === 'completed' ? 'border-emerald-100 bg-emerald-50/30' :
                step.status === 'current' ? 'border-emerald-200 bg-white' :
                'border-border bg-white'
              }`}
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              {/* Connecting line */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-3 h-0.5 bg-gradient-to-r from-emerald-200 to-transparent" />
              )}

              {/* Step circle */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mb-3 mx-auto ${style.circle}`}>
                {step.status === 'completed' ? '✓' : step.icon || (idx + 1)}
              </div>

              {/* Step info */}
              <div className="text-center">
                <p className={`text-sm ${style.title}`}>{step.label}</p>
                {step.subtitle && (
                  <p className={`text-xs mt-1 ${style.subtitle} line-clamp-2`}>{step.subtitle}</p>
                )}
              </div>

              {/* Status indicator */}
              {step.status === 'current' && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}

              {/* Hover effect */}
              {isClickable && (
                <div className="absolute inset-0 rounded-xl bg-emerald-50/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
