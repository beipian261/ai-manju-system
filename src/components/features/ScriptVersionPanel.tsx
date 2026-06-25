'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/utils/api-client';

interface ScriptVersion {
  id: string;
  versionNumber: number;
  outline: string;
  content: string;
  source: string;
  createdAt: string;
}

interface ScriptVersionPanelProps {
  scriptId: string;
  currentContent: string;
  onRestored?: (content: string) => void;
}

const SOURCE_LABELS: Record<string, { label: string; variant: 'emerald' | 'amber' | 'sky' }> = {
  ai_generated: { label: 'AI 生成', variant: 'emerald' },
  manual_edit: { label: '手动编辑', variant: 'amber' },
  restore: { label: '版本恢复', variant: 'sky' },
};

export function ScriptVersionPanel({ scriptId, currentContent, onRestored }: ScriptVersionPanelProps) {
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState(false);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<ScriptVersion[]>(`/api/scripts/${scriptId}/versions`);
      setVersions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [scriptId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleSaveCurrent = async () => {
    try {
      const data = await apiPost<{ skipped?: boolean }>(`/api/scripts/${scriptId}/versions`, { source: 'manual_edit' });
      if (data.skipped) return;
      await loadVersions();
    } catch {
      // ignore
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const data = await apiPost<{ content: string }>(`/api/scripts/${scriptId}/versions/${versionId}/restore`, {});
      onRestored?.(data.content);
      await loadVersions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败');
    } finally {
      setRestoring(null);
    }
  };

  // Simple diff: compute line-level diff between version and current
  const computeDiff = (versionContent: string): { added: number[]; removed: number[] } => {
    const vLines = versionContent.split('\n');
    const cLines = currentContent.split('\n');
    const added: number[] = [];
    const removed: number[] = [];

    // Simple line mapping
    const maxLen = Math.max(vLines.length, cLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < cLines.length && i >= vLines.length) added.push(i);
      else if (i < vLines.length && i >= cLines.length) removed.push(i);
      else if (vLines[i] !== cLines[i]) {
        removed.push(i);
        added.push(i);
      }
    }

    return { added, removed };
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="w-full h-8" rounded="lg" />
        <Skeleton className="w-full h-8" rounded="lg" />
        <Skeleton className="w-full h-8" rounded="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">
          📜 版本历史
          {versions.length > 0 && (
            <span className="ml-2 text-xs text-ink-muted font-normal">({versions.length} 个版本)</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiffMode(!diffMode)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              diffMode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'
            }`}
          >
            {diffMode ? '差异视图' : '普通视图'}
          </button>
          <button
            onClick={handleSaveCurrent}
            className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
          >
            💾 保存当前版本
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {versions.length === 0 && !loading ? (
        <p className="text-xs text-ink-muted py-4 text-center">暂无历史版本</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {versions.map((v) => {
            const sourceCfg = SOURCE_LABELS[v.source] || SOURCE_LABELS.ai_generated;
            const isExpanded = expandedVersion === v.id;
            const { added, removed } = diffMode ? computeDiff(v.content) : { added: [], removed: [] };

            return (
              <div key={v.id} className="rounded-xl border border-border bg-white overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <button
                    onClick={() => setExpandedVersion(isExpanded ? null : v.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className="text-xs font-mono font-bold text-ink w-12 flex-shrink-0">
                      v{v.versionNumber}
                    </span>
                    <Badge variant={sourceCfg.variant}>{sourceCfg.label}</Badge>
                    <span className="text-xs text-ink-muted truncate max-w-[160px]">
                      {v.outline?.slice(0, 40) || '(无大纲)'}
                    </span>
                    <span className="text-[10px] text-ink-muted flex-shrink-0 ml-auto">
                      {formatDate(v.createdAt)}
                    </span>
                  </button>
                  <button
                    onClick={() => handleRestore(v.id)}
                    disabled={restoring === v.id}
                    className="ml-2 text-xs px-2 py-1 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {restoring === v.id ? '⏳' : '↩️ 恢复'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-3 bg-gray-50/50">
                    {diffMode ? (
                      <div className="text-xs font-mono space-y-0.5 max-h-[300px] overflow-y-auto">
                        {v.content.split('\n').map((line, i) => {
                          const isRemoved = removed.includes(i);
                          const isAdded = added.includes(i);
                          let cls = 'text-ink-muted';
                          if (isRemoved && isAdded) cls = 'text-amber-700 bg-amber-50';
                          else if (isRemoved) cls = 'text-red-600 bg-red-50 line-through';
                          else if (isAdded) cls = 'text-emerald-600 bg-emerald-50';
                          return (
                            <div key={i} className={`px-1 ${cls}`}>
                              {isRemoved ? '- ' : isAdded ? '+ ' : '  '}{line || '\u00A0'}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <pre className="text-xs text-ink-muted whitespace-pre-wrap max-h-[300px] overflow-y-auto font-sans leading-relaxed">
                        {v.content}
                      </pre>
                    )}
                    <div className="mt-2 text-[10px] text-ink-muted">
                      共 {v.content.length} 字符
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
