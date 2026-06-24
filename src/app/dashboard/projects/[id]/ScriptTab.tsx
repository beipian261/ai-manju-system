'use client';
// ScriptTab — 剧本管理
// 纯白极简主题
import { useState } from 'react';
import { useProjectContext } from './ProjectContext';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { StreamingContent } from '@/components/StreamingContent';
import { ProgressSteps } from '@/components/ProgressSteps';
import { ScriptRenderer } from '@/components/ScriptRenderer';
import { ScriptVersionPanel } from '@/components/ScriptVersionPanel';
import { OutlineAnalyzer } from '@/components/OutlineAnalyzer';
import type { Script } from './types';

export default function ScriptTab() {
  const { scripts, storyboards, generateScript, deleteScript, generatingScript, setActiveTab, generatingStoryboard, streamingContent, streamingStatus } = useProjectContext();
  const [showForm, setShowForm] = useState(false);
  const [outline, setOutline] = useState('');
  const [generatingLocal, setGeneratingLocal] = useState(false);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  // Find active streaming session
  const activeStreamEntry = Object.entries(streamingStatus).find(([_, status]) => status === 'streaming');
  const activeStreamId = activeStreamEntry?.[0];
  const activeContent = activeStreamId ? (streamingContent[activeStreamId] || '') : '';

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!outline.trim()) return;
    setGeneratingLocal(true);
    try {
      await generateScript(outline);
      setOutline('');
      setShowForm(false);
    } finally {
      setGeneratingLocal(false);
    }
  }

  const completedScripts = scripts.filter(s => s.status === 'completed');

  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        title="剧本管理"
        subtitle="AI 生成的剧本内容"
        icon="📝"
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm(v => !v)}>
            {showForm ? '✖️ 取消' : '✨ AI 生成剧本'}
          </Button>
        }
      >
        {showForm && (
          <Card variant="default" className="mb-6 p-6 border border-emerald-100">
            <h3 className="font-semibold text-ink mb-2">生成新剧本</h3>
            <p className="text-sm text-ink-muted mb-4">提供故事大纲，AI 将为你生成完整剧本</p>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">故事大纲</label>
                <textarea
                  className="textarea-field min-h-[120px]"
                  placeholder="描述你的故事梗概..."
                  value={outline}
                  onChange={e => setOutline(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={generatingScript || generatingLocal || !outline.trim()} loading={!!(generatingScript || generatingLocal)}>
                  {generatingScript || generatingLocal ? '生成中...' : '✨ 开始生成剧本'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
              </div>

              {/* Outline Analyzer */}
              {outline.trim().length >= 20 && (
                <div className="pt-2 border-t border-border">
                  <OutlineAnalyzer
                    outline={outline}
                    onOptimized={(optimized) => setOutline(optimized)}
                  />
                </div>
              )}
            </form>
          </Card>
        )}

        {/* Streaming content display */}
        {activeStreamId && (
          <div className="mb-6">
            <StreamingContent
              content={activeContent}
              status="streaming"
              wordCount={activeContent.length}
            />
            <div className="mt-3 px-1">
              <ProgressSteps
                steps={[
                  { id: 'loading', label: '加载角色', status: activeContent.length > 0 ? 'completed' : 'active' },
                  { id: 'writing', label: 'AI 创作', status: activeContent.length > 0 ? 'active' : 'pending' },
                  { id: 'verify', label: '验证整理', status: 'pending' },
                  { id: 'done', label: '完成', status: 'pending' },
                ]}
              />
            </div>
          </div>
        )}

        {scripts.length === 0 && !activeStreamId ? (
          <Card variant="default" className="text-center py-16">
            <div className="text-6xl mb-4 opacity-50">📝</div>
            <h3 className="text-lg font-semibold text-ink mb-2">暂无剧本</h3>
            <p className="text-sm text-ink-muted mb-6">点击上方按钮使用 AI 生成剧本</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {scripts.map((s, idx) => (
              <ScriptCard
                key={s.id}
                script={s}
                index={idx}
                isActive={activeStream === s.id}
                hasStoryboards={storyboards.some(st => st.scriptId === s.id)}
                onOpen={() => setActiveStream(activeStream === s.id ? null : s.id)}
                onDelete={() => deleteScript(s.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {completedScripts.length > 0 && (
        <Section title="下一步" subtitle="从剧本提取分镜" icon="🎬">
          <Card variant="default" className="p-5 border border-emerald-100">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl flex-shrink-0">🎉</div>
                <div>
                  <h3 className="font-semibold text-ink">已生成 {completedScripts.length} 个剧本</h3>
                  <p className="text-sm text-ink-muted mt-1">前往「分镜」页面，让 AI 从剧本中提取分镜场景</p>
                </div>
              </div>
              <Button onClick={() => setActiveTab('storyboard')} loading={!!generatingStoryboard}>
                🎬 生成分镜
              </Button>
            </div>
          </Card>
        </Section>
      )}
    </div>
  );
}

function ScriptCard({ script: s, index, isActive, hasStoryboards, onOpen, onDelete }: {
  script: Script; index: number; isActive: boolean; hasStoryboards: boolean; onOpen: () => void; onDelete: () => void;
}) {
  const cfg: Record<string, { label: string; variant: 'amber' | 'emerald' | 'zinc' | 'purple' | 'pink' | 'sky' | 'red' }> = {
    draft: { label: '草稿', variant: 'zinc' },
    generating: { label: '生成中', variant: 'amber' },
    completed: { label: '已完成', variant: 'emerald' },
    failed: { label: '失败', variant: 'red' },
  };
  const statusCfg = cfg[s.status] || cfg.draft;

  return (
    <Card variant="default" className="p-0 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-600 flex-shrink-0">
              #{index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                {hasStoryboards && <Badge variant="emerald">已有分镜</Badge>}
              </div>
              {s.outline && (
                <p className="text-sm text-ink-muted truncate max-w-2xl">
                  <span className="text-ink-secondary">大纲: </span>{s.outline}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onDelete} className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:text-red-600">🗑️</button>
          </div>
        </div>

        {s.status === 'generating' && (
          <div className="space-y-2 mb-3">
            <Skeleton className="w-full h-3" rounded="lg" />
            <Skeleton className="w-5/6 h-3" rounded="lg" />
            <p className="text-sm text-amber-600">AI 正在创作中...</p>
          </div>
        )}

        {s.status === 'completed' && s.content && (
          <>
            <details open={isActive}>
              <summary className="text-sm text-ink-muted cursor-pointer hover:text-ink-secondary mt-2 select-none font-medium">
                📖 剧本内容 ({s.content.length} 字)
              </summary>
              <div className="mt-3 max-h-[600px] overflow-y-auto rounded-xl border border-border">
                <ScriptRenderer content={s.content} />
              </div>
            </details>

            {/* 版本历史 */}
            <details className="mt-3">
              <summary className="text-xs text-ink-muted cursor-pointer hover:text-ink-secondary select-none">
                📜 版本历史
              </summary>
              <div className="mt-2 p-3 rounded-xl border border-border bg-gray-50/50">
                <ScriptVersionPanel
                  scriptId={s.id}
                  currentContent={s.content}
                  onRestored={() => {
                    // Trigger reload via context
                    window.location.reload();
                  }}
                />
              </div>
            </details>
          </>
        )}
      </div>
    </Card>
  );
}
