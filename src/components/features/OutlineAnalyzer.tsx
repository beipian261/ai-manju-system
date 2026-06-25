'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface AnalysisResult {
  characterCompleteness: number;
  conflictIntensity: number;
  pacingBalance: number;
  worldBuilding: number;
  creativity: number;
  overallScore: number;
  summary: string;
  suggestions: Array<{ priority: 'high' | 'medium' | 'low'; text: string }>;
  strengths: string[];
}

interface OutlineAnalyzerProps {
  outline: string;
  onOptimized: (optimizedOutline: string) => void;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ink-muted w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-base-bg overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-mono font-bold text-ink w-7 text-right">{score}</span>
    </div>
  );
}

export function OutlineAnalyzer({ outline, onOptimized }: OutlineAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/agnes/analyze-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline, mode: 'analyze' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '分析失败');
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleOptimize() {
    setOptimizing(true);
    setError('');
    try {
      const res = await fetch('/api/agnes/analyze-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline, mode: 'optimize' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '优化失败');
      if (data.optimizedOutline) {
        onOptimized(data.optimizedOutline);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '优化失败');
    } finally {
      setOptimizing(false);
    }
  }

  const priorityLabel: Record<string, string> = {
    high: '高优先',
    medium: '中优先',
    low: '低优先',
  };
  const priorityVariant: Record<string, 'red' | 'amber' | 'zinc'> = {
    high: 'red',
    medium: 'amber',
    low: 'zinc',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAnalyze}
          disabled={analyzing || outline.length < 20}
          loading={analyzing}
        >
          {analyzing ? '分析中...' : '🔍 分析大纲'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleOptimize}
          disabled={optimizing || outline.length < 20}
          loading={optimizing}
        >
          {optimizing ? '优化中...' : '✨ 一键优化'}
        </Button>
        {outline.length < 20 && (
          <span className="text-[10px] text-ink-muted">(需要至少 20 字)</span>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
          {error}
        </div>
      )}

      {analysis && (
        <div className="p-4 rounded-xl border border-border bg-white space-y-3 animate-fade-in">
          {/* Overall Score */}
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white ${
              analysis.overallScore >= 80 ? 'bg-emerald-500' :
              analysis.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-400'
            }`}>
              {analysis.overallScore}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink">大纲质量评分</div>
              <p className="text-xs text-ink-muted truncate">{analysis.summary}</p>
            </div>
          </div>

          {/* Dimension Scores */}
          <div className="space-y-1.5">
            <ScoreBar label="角色完整度" score={analysis.characterCompleteness} />
            <ScoreBar label="冲突强度" score={analysis.conflictIntensity} />
            <ScoreBar label="节奏合理性" score={analysis.pacingBalance} />
            <ScoreBar label="世界观" score={analysis.worldBuilding} />
            <ScoreBar label="创意指数" score={analysis.creativity} />
          </div>

          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-ink mb-1.5">🎯 已有亮点</div>
              <div className="flex flex-wrap gap-1">
                {analysis.strengths.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {s.slice(0, 60)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-ink mb-1.5">💡 改进建议</div>
              <div className="space-y-1">
                {analysis.suggestions.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <Badge variant={priorityVariant[s.priority] || 'zinc'}>{priorityLabel[s.priority] || s.priority}</Badge>
                    <span className="text-ink-secondary leading-relaxed">{s.text.slice(0, 120)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
