'use client';
// StreamingContent — AI 流式内容展示组件
// 纯白极简主题

interface StreamingContentProps {
  content: string;
  status: 'idle' | 'streaming' | 'completed';
  placeholder?: string;
  wordCount?: number;
  className?: string;
  onRegenerate?: () => void;
  onSave?: () => void;
}

export function StreamingContent({
  content,
  status,
  placeholder = '等待 AI 生成...',
  wordCount,
  className = '',
  onRegenerate,
  onSave,
}: StreamingContentProps) {
  if (status === 'idle') {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <div className="text-4xl mb-3 opacity-40">✨</div>
        <p className="text-sm text-ink-muted">{placeholder}</p>
      </div>
    );
  }

  return (
    <div className={`border border-border rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-base-bg">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'streaming' ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
          }`}
        />
        <span className="text-sm font-medium text-ink">
          {status === 'streaming' ? 'AI 正在创作...' : '生成完成'}
        </span>
        {wordCount !== undefined && (
          <span className="text-xs text-ink-muted ml-auto">共 {wordCount} 字</span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 min-h-[120px] max-h-96 overflow-y-auto">
        {content ? (
          <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
            {content}
            {status === 'streaming' && (
              <span className="inline-block w-0.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-ink-muted text-sm">
            <span className="w-4 h-4 border-2 border-border-strong border-t-emerald-500 rounded-full animate-spin" />
            等待响应...
          </div>
        )}
      </div>

      {/* Actions (completed only) */}
      {status === 'completed' && (onRegenerate || onSave) && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-base-bg">
          {onRegenerate && (
            <button onClick={onRegenerate} className="btn-ghost text-xs px-3 py-1.5">
              🔄 重新生成
            </button>
          )}
          {onSave && (
            <button onClick={onSave} className="btn-primary btn-sm text-xs px-3 py-1.5 ml-auto">
              💾 保存内容
            </button>
          )}
        </div>
      )}
    </div>
  );
}
