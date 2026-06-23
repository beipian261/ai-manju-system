'use client';
// ImageGridProgress — 图片批量生成进度网格组件
// 纯白极简主题

interface ImageSlot {
  id: string;
  status: 'completed' | 'generating' | 'pending';
  thumbnail?: string;
  label?: string;
}

interface ImageGridProgressProps {
  slots: ImageSlot[];
  totalSlots: number;
  className?: string;
}

export function ImageGridProgress({ slots, totalSlots, className = '' }: ImageGridProgressProps) {
  const completedCount = slots.filter(s => s.status === 'completed').length;
  const progress = totalSlots > 0 ? Math.round((completedCount / totalSlots) * 100) : 0;

  // Fill remaining slots as pending
  const displaySlots = [...slots];
  while (displaySlots.length < totalSlots) {
    displaySlots.push({ id: `pending-${displaySlots.length}`, status: 'pending' });
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {displaySlots.map((slot) => (
          <div
            key={slot.id}
            className={`aspect-square rounded-lg border flex items-center justify-center text-lg transition-all ${
              slot.status === 'completed'
                ? 'bg-emerald-50 border-emerald-200'
                : slot.status === 'generating'
                ? 'bg-emerald-50/50 border-emerald-200 border-dashed animate-pulse'
                : 'bg-gray-50 border-border border-dashed'
            }`}
          >
            {slot.status === 'completed' ? (
              <span className="text-2xl">🖼️</span>
            ) : slot.status === 'generating' ? (
              <span className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-500 rounded-full animate-spin" />
            ) : (
              <span className="text-ink-muted text-sm">+</span>
            )}
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between text-xs text-ink-muted mb-1">
          <span>生成进度</span>
          <span>
            {completedCount}/{totalSlots}
          </span>
        </div>
        <div className="progress-track md">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
