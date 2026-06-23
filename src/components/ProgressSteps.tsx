'use client';
// ProgressSteps — 步骤化进度条组件
// 纯白极简主题

export interface ProgressStep {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  className?: string;
}

export function ProgressSteps({ steps, className = '' }: ProgressStepsProps) {
  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 min-w-0">
          {/* Step indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                step.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : step.status === 'active'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-gray-50 text-ink-muted border border-border'
              }`}
            >
              {step.status === 'completed' ? '✓' : idx + 1}
            </div>
            <span
              className={`text-xs truncate ${
                step.status === 'completed'
                  ? 'text-emerald-600 font-medium'
                  : step.status === 'active'
                  ? 'text-ink font-medium'
                  : 'text-ink-muted'
              }`}
            >
              {step.label}
            </span>
          </div>
          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div
              className={`flex-1 h-px mx-2 ${
                step.status === 'completed' ? 'bg-emerald-300' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
