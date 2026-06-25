'use client';
// ConsistencyDashboard — 角色一致性追踪仪表盘
// 显示每个角色在所有分镜中的一致性评分 + 问题列表

interface CharacterConsistencyProps {
  characters: Array<{
    id: string;
    name: string;
    referenceImg?: string | null;
  }>;
  storyboards: Array<{
    id: string;
    sceneNum: number;
    title?: string | null;
    imageUrls?: string | null;
    qualityScore?: number | null;
    characterIds?: string[];
  }>;
  className?: string;
}

export function ConsistencyDashboard({
  characters,
  storyboards,
  className = '',
}: CharacterConsistencyProps) {
  // 计算每个角色在所有分镜中的统计数据
  const charStats = characters.map(char => {
    const charStoryboards = storyboards.filter(sb => {
      if (!char.id) return false;
      return sb.characterIds?.includes(char.id) ?? false;
    });

    const withImages = charStoryboards.filter(sb => !!sb.imageUrls);
    const avgScore = withImages.length > 0
      ? Math.round(withImages.reduce((sum, sb) => sum + (sb.qualityScore || 0), 0) / withImages.length)
      : 0;

    return {
      ...char,
      totalScenes: charStoryboards.length,
      withImages: withImages.length,
      avgScore,
      hasIssue: avgScore > 0 && avgScore < 70,
    };
  });

  const overallAvg = charStats.length > 0
    ? Math.round(charStats.reduce((sum, c) => sum + c.avgScore, 0) / charStats.length)
    : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall score */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">角色一致性</h3>
          <p className="text-xs text-ink-muted">所有角色在分镜中的平均一致性</p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${overallAvg >= 75 ? 'text-emerald-600' : overallAvg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {overallAvg}%
          </span>
          <p className="text-[10px] text-ink-muted">综合评分</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-track lg">
        <div
          className="progress-fill"
          style={{ width: `${overallAvg}%` }}
        />
      </div>

      {/* Per-character breakdown */}
      <div className="space-y-2">
        {charStats.map(char => (
          <div
            key={char.id}
            className="card-flat p-3 flex items-center gap-3"
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              char.hasIssue
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {char.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink truncate">{char.name}</p>
              <p className="text-[10px] text-ink-muted">
                {char.withImages}/{char.totalScenes} 分镜有图
              </p>
            </div>

            {/* Score bar */}
            <div className="w-24">
              <div className="flex justify-between text-[10px] text-ink-muted mb-0.5">
                <span>一致性</span>
                <span>{char.avgScore}%</span>
              </div>
              <div className="progress-track sm">
                <div
                  className={`progress-fill ${char.avgScore >= 75 ? '' : char.avgScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${char.avgScore}%` }}
                />
              </div>
            </div>

            {/* Status icon */}
            {char.avgScore === 0 ? (
              <span className="text-ink-muted text-xs" title="暂无数据">—</span>
            ) : char.avgScore >= 75 ? (
              <span className="text-emerald-500 text-sm" title="一致性好">✓</span>
            ) : (
              <span className="text-amber-500 text-sm" title="需要关注">⚠</span>
            )}
          </div>
        ))}
      </div>

      {charStats.length === 0 && (
        <p className="text-xs text-ink-muted text-center py-4">暂无角色数据</p>
      )}
    </div>
  );
}
