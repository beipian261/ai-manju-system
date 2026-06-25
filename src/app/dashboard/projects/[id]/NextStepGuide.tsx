'use client';
import { analyzeWorkflow } from '@/lib/utils/workflow-guidance';
import { useProjectContext } from './ProjectContext';
import type { TabKey } from './types';

interface NextStepGuideProps {
  onNavigate: (tab: TabKey) => void;
}

export default function NextStepGuide({ onNavigate }: NextStepGuideProps) {
  const { project, characters, scripts, storyboards } = useProjectContext();

  if (!project) return null;

  const guidance = analyzeWorkflow(project, characters, scripts, storyboards);
  const { overallPercent, recommendationReason, recommendedAction, actionButtonText, recommendedNextStep, quickActions, steps } = guidance;

  return (
    <div className="space-y-4">
      {/* 主推荐卡片 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-200">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl animate-bounce">✨</span>
            <span className="text-sm font-medium text-emerald-100">AI 制作助理建议</span>
          </div>
          
          <h3 className="text-xl font-bold mb-2 leading-tight">
            {overallPercent === 100 ? '🎉 项目已完成！' : recommendationReason}
          </h3>
          
          {recommendedAction && (
            <p className="text-emerald-100 text-sm mb-4">{recommendedAction}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate(recommendedNextStep)}
              className="px-5 py-2.5 bg-white text-emerald-700 rounded-xl font-semibold text-sm hover:bg-emerald-50 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              {actionButtonText} →
            </button>
            
            <div className="flex items-center gap-2 text-emerald-100 text-sm">
              <span>总进度</span>
              <span className="font-bold text-white text-lg">{overallPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 快捷操作按钮 */}
      {quickActions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">快捷操作</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate(action.tab)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  action.primary
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                    : 'bg-gray-50 text-ink-secondary border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 各步骤详细进度 */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">各阶段进度</p>
        <div className="space-y-3">
          {steps.map(step => (
            <div key={step.key} className="group">
              <button
                onClick={() => step.status !== 'locked' && onNavigate(step.key)}
                disabled={step.status === 'locked'}
                className={`w-full flex items-center gap-3 p-2 -mx-2 rounded-lg transition-all ${
                  step.status === 'locked' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                  step.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                  step.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                  step.status === 'locked' ? 'bg-gray-100 text-gray-400' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {step.status === 'completed' ? '✓' : step.icon}
                </span>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      step.status === 'completed' ? 'text-emerald-700' :
                      step.status === 'in_progress' ? 'text-blue-700' :
                      step.status === 'locked' ? 'text-gray-400' :
                      'text-ink'
                    }`}>
                      {step.label}
                      {step.status === 'in_progress' && <span className="ml-2 text-xs text-blue-500 animate-pulse">进行中</span>}
                    </span>
                    <span className={`text-xs font-semibold ${
                      step.status === 'completed' ? 'text-emerald-600' :
                      step.status === 'in_progress' ? 'text-blue-600' :
                      'text-gray-400'
                    }`}>
                      {step.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        step.status === 'completed' ? 'bg-emerald-500' :
                        step.status === 'in_progress' ? 'bg-blue-500' :
                        'bg-gray-300'
                      }`}
                      style={{ width: `${step.percent}%` }}
                    />
                  </div>
                  {step.issues.length > 0 && step.status !== 'completed' && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <span>⚠️</span>
                      {step.issues[0]}
                    </p>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
