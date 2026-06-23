// TimelineTab — 专业视频编辑器式多轨道时间线
// 顶部工具栏 | 左侧素材库 | 中央时间线 | 右侧属性检查器
'use client';
import { useState, useMemo, useRef, useCallback } from 'react';
import { useProjectContext } from './ProjectContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Storyboard } from './types';

const TRACK_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6366F1'];
const PIXELS_PER_SECOND = 40;
const TRACK_HEIGHT = 56;

interface TimeMarker {
  label: string;
  seconds: number;
}

export default function TimelineTab() {
  const { storyboards, projectId } = useProjectContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(80);
  const [zoom, setZoom] = useState(1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const sortedSB = useMemo(
    () => [...storyboards].sort((a, b) => a.sceneNum - b.sceneNum),
    [storyboards]
  );

  const totalDuration = useMemo(
    () => sortedSB.reduce((sum, s) => sum + (s.duration ?? 5), 0),
    [sortedSB]
  );

  const selectedSB = sortedSB.find(s => s.id === selectedId) || sortedSB[0] || null;

  // 时间刻度
  const timeMarkers: TimeMarker[] = useMemo(() => {
    const markers: TimeMarker[] = [];
    for (let s = 0; s <= totalDuration; s += 5) {
      markers.push({ label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, seconds: s });
    }
    return markers;
  }, [totalDuration]);

  // 播放控制
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 一键预览作品（模拟播放全部分镜）
  const handlePreviewAll = () => {
    setShowPreviewModal(true);
    setPreviewPlaying(true);
    setPreviewProgress(0);
    
    // 模拟播放进度
    const totalDurationMs = totalDuration * 1000;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / totalDurationMs, 1);
      setPreviewProgress(progress);
      setCurrentTime(progress * totalDuration);
      
      if (progress < 1 && previewPlaying) {
        requestAnimationFrame(animate);
      } else {
        setPreviewPlaying(false);
        setIsPlaying(false);
      }
    };
    requestAnimationFrame(animate);
  };

  if (!projectId) return null;

  if (sortedSB.length === 0) {
    return (
      <div className="animate-fade-in">
        <Card variant="default" className="text-center py-20">
          <div className="text-6xl mb-4 opacity-40">🎞️</div>
          <h3 className="text-lg font-semibold text-ink mb-2">暂无分镜数据</h3>
          <p className="text-sm text-ink-muted">请先在「分镜」Tab 中生成分镜</p>
        </Card>
      </div>
    );
  }

  const hasVideos = sortedSB.some(s => s.videoUrl);
  const hasImages = sortedSB.some(s => s.imageUrls);

  return (
    <div className="animate-fade-in space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">时间线编辑器</p>
          <Badge variant="emerald">{sortedSB.length} 个片段</Badge>
          <Badge variant="sky">{totalDuration}s</Badge>
          {hasVideos && <Badge variant="emerald">{sortedSB.filter(s => s.videoUrl).length} 视频</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {/* 预览按钮 */}
          <Button size="sm" variant="primary" onClick={handlePreviewAll}>
            🎬 预览全部
          </Button>
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <span>缩放</span>
            <input type="range" className="w-20 accent-emerald-500" min="0.5" max="2" step="0.1"
              value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          </div>
          {/* 播放速度 */}
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <span>速度</span>
            <select className="px-2 py-1 text-xs border border-border rounded bg-white"
              value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))}>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
        </div>
      </div>

      {/* 三栏主体 */}
      <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: '480px' }}>
        {/* 左侧：素材库 */}
        <div className="col-span-2 flex flex-col">
          <Card variant="default" className="flex-1 p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-ink">素材库</h3>
              <Badge variant="zinc">{sortedSB.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {sortedSB.map((sb, idx) => {
                const hasVideo = !!sb.videoUrl;
                const hasImage = !!sb.imageUrls;
                const dur = (sb.duration ?? 5);
                const isActive = selectedSB?.id === sb.id;
                const color = TRACK_COLORS[idx % TRACK_COLORS.length];

                return (
                  <button
                    key={sb.id}
                    onClick={() => setSelectedId(sb.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                      isActive ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    {/* 颜色条 */}
                    <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
                    {/* 缩略图 */}
                    <div className="w-10 h-7 rounded overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                      {sb.imageUrls ? (
                        <img src={(sb.imageUrls as string).split(',')[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] opacity-40">🎬</span>
                      )}
                    </div>
                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-ink">#{sb.sceneNum}</span>
                        {hasVideo && <span className="text-[8px]">🎬</span>}
                        {hasImage && <span className="text-[8px]">🖼️</span>}
                      </div>
                      <span className="text-[9px] text-ink-muted">{dur}s</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* 中央：时间线 */}
        <div className="col-span-7 flex flex-col">
          <Card variant="default" className="flex-1 p-3 flex flex-col overflow-hidden">
            {/* 时间刻度尺 */}
            <div className="flex items-center mb-2 pl-4">
              <div className="w-12 flex-shrink-0" />
              <div className="flex-1 overflow-x-auto" ref={timelineRef}>
                <div className="relative" style={{ width: `${totalDuration * PIXELS_PER_SECOND * zoom}px` }}>
                  {/* 时间刻度 */}
                  <div className="flex relative h-5">
                    {timeMarkers.map((marker, idx) => (
                      <div key={idx} className="absolute flex flex-col items-center" style={{ left: `${marker.seconds * PIXELS_PER_SECOND * zoom}px` }}>
                        <div className="w-px h-2 bg-gray-300" />
                        <span className="text-[9px] text-ink-muted font-mono mt-0.5">{marker.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* 当前播放头 */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ left: `${currentTime * PIXELS_PER_SECOND * zoom}px` }}
                  />
                </div>
              </div>
            </div>

            {/* 播放进度条 */}
            <div className="flex items-center gap-3 mb-3 pl-4">
              <div className="w-12 flex-shrink-0 text-xs text-ink-muted font-mono">
                {formatTime(currentTime)}
              </div>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setCurrentTime(pct * totalDuration);
                }}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(currentTime / totalDuration) * 100}%` }} />
              </div>
              <div className="w-12 flex-shrink-0 text-xs text-ink-muted font-mono text-right">
                {formatTime(totalDuration)}
              </div>
            </div>

            {/* 轨道 */}
            <div className="flex-1 overflow-auto">
              <div className="flex" style={{ width: `${totalDuration * PIXELS_PER_SECOND * zoom + 48}px` }}>
                {/* 轨道标签列 */}
                <div className="w-12 flex-shrink-0 space-y-1 pt-1">
                  <div className="h-[56px] flex items-center justify-end pr-2">
                    <span className="text-[9px] text-ink-muted font-medium">视频</span>
                  </div>
                  <div className="h-[36px] flex items-center justify-end pr-2">
                    <span className="text-[9px] text-ink-muted font-medium">音频</span>
                  </div>
                  <div className="h-[36px] flex items-center justify-end pr-2">
                    <span className="text-[9px] text-ink-muted font-medium">字幕</span>
                  </div>
                </div>

                {/* 轨道内容 */}
                <div className="flex-1 space-y-1 pr-2">
                  {/* 视频轨道 */}
                  <div className="h-[56px] bg-gray-50 rounded-lg border border-border relative overflow-hidden">
                    {sortedSB.map((sb, idx) => {
                      const startSec = sortedSB.slice(0, idx).reduce((sum, s) => sum + (s.duration ?? 5), 0);
                      const dur = (sb.duration ?? 5);
                      const color = TRACK_COLORS[idx % TRACK_COLORS.length];
                      const isActive = selectedSB?.id === sb.id;
                      return (
                        <button
                          key={sb.id}
                          onClick={() => setSelectedId(sb.id)}
                          style={{
                            position: 'absolute',
                            left: `${startSec * PIXELS_PER_SECOND * zoom}px`,
                            width: `${dur * PIXELS_PER_SECOND * zoom}px`,
                            background: color,
                            opacity: sb.videoUrl ? 1 : sb.imageUrls ? 0.75 : 0.3,
                          }}
                          className={`top-1 bottom-1 rounded-lg p-1.5 text-left transition-all hover:brightness-110 ${
                            isActive ? 'ring-2 ring-offset-1 ring-emerald-500' : ''
                          }`}
                        >
                          <p className="text-[10px] font-semibold text-white truncate leading-tight">#{sb.sceneNum}</p>
                          <p className="text-[9px] text-white/80 truncate">{dur}s</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* 音频轨道 */}
                  <div className="h-[36px] bg-gray-50 rounded-lg border border-border relative overflow-hidden">
                    {sortedSB.filter(sb => sb.dialogue).map((sb, idx) => {
                      const sortedFiltered = sortedSB.filter(s => s.dialogue);
                      const filteredIdx = sortedFiltered.indexOf(sb);
                      const startSec = sortedFiltered.slice(0, filteredIdx).reduce((sum, s) => sum + (s.duration ?? 5), 0);
                      const dur = (sb.duration ?? 5);
                      return (
                        <div key={sb.id}
                          style={{
                            position: 'absolute',
                            left: `${startSec * PIXELS_PER_SECOND * zoom}px`,
                            width: `${dur * PIXELS_PER_SECOND * zoom}px`,
                          }}
                          className="top-1 bottom-1 rounded bg-amber-400/60 flex items-center px-1.5">
                          <span className="text-[9px] text-amber-800 font-medium truncate">🎤</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 字幕轨道 */}
                  <div className="h-[36px] bg-gray-50 rounded-lg border border-border relative overflow-hidden">
                    {sortedSB.filter(sb => sb.dialogue).map((sb) => {
                      const sortedFiltered = sortedSB.filter(s => s.dialogue);
                      const filteredIdx = sortedFiltered.indexOf(sb);
                      const startSec = sortedFiltered.slice(0, filteredIdx).reduce((sum, s) => sum + (s.duration ?? 5), 0);
                      const dur = (sb.duration ?? 5);
                      return (
                        <div key={sb.id}
                          style={{
                            position: 'absolute',
                            left: `${startSec * PIXELS_PER_SECOND * zoom}px`,
                            width: `${dur * PIXELS_PER_SECOND * zoom}px`,
                          }}
                          className="top-1 bottom-1 rounded bg-sky-100 border border-sky-200 flex items-center px-1.5">
                          <span className="text-[9px] text-sky-700 font-medium truncate">
                            「{sb.dialogue?.substring(0, 8)}...」
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 播放控制栏 */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Button size="sm" variant="secondary" onClick={() => setCurrentTime(0)}>⏮</Button>
              <Button size="sm" variant="secondary" onClick={togglePlay}>
                {isPlaying ? '⏸' : '▶️'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setCurrentTime(totalDuration)}>⏭</Button>
              <div className="flex-1" />
              {/* 音量 */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🔊</span>
                <input type="range" className="w-16 accent-emerald-500" min="0" max="100"
                  value={volume} onChange={e => setVolume(Number(e.target.value))} />
              </div>
              <span className="text-xs text-ink-muted font-mono">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
            </div>
          </Card>
        </div>

        {/* 右侧：属性检查器 */}
        <div className="col-span-3 flex flex-col">
          <Card variant="default" className="flex-1 p-4 overflow-y-auto">
            {selectedSB ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">片段属性</h3>
                  <Badge variant="emerald">#{selectedSB.sceneNum}</Badge>
                </div>

                {/* 预览图 */}
                <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {selectedSB.imageUrls ? (
                    <img src={(selectedSB.imageUrls as string).split(',')[0]}
                      className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-3xl opacity-30">🎬</span>
                  )}
                </div>

                {/* 基本信息 */}
                <div className="space-y-2.5">
                  {[
                    { label: '时长', value: `${(selectedSB.duration ?? 5)}s` },
                    { label: '镜头角度', value: selectedSB.cameraAngle || '默认' },
                    { label: '情绪', value: selectedSB.emotion || '中性' },
                    { label: '视频', value: selectedSB.videoUrl ? '已生成' : '待生成', highlight: !!selectedSB.videoUrl },
                    { label: '图片', value: selectedSB.imageUrls ? '已生成' : '待生成', highlight: !!selectedSB.imageUrls },
                    { label: '台词', value: selectedSB.dialogue ? '有' : '无' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-xs text-ink-muted">{item.label}</span>
                      {item.highlight !== undefined ? (
                        <Badge variant={item.highlight ? 'emerald' : 'zinc'}>{item.value}</Badge>
                      ) : (
                        <span className="text-xs font-medium text-ink">{item.value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 播放速度 */}
                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-ink-secondary">播放速度</span>
                    <span className="text-ink-muted font-mono">{playbackSpeed}x</span>
                  </div>
                  <input type="range" className="w-full accent-emerald-500" min="0.5" max="2" step="0.1"
                    value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))} />
                </div>

                {/* 描述 */}
                {selectedSB.description && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-ink-secondary mb-1.5">描述</p>
                    <p className="text-xs text-ink-muted leading-relaxed line-clamp-4">{selectedSB.description}</p>
                  </div>
                )}

                {/* 台词 */}
                {selectedSB.dialogue && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-ink-secondary mb-1.5">台词</p>
                    <p className="text-xs text-ink-muted italic leading-relaxed">「{selectedSB.dialogue}」</p>
                  </div>
                )}

                {/* 跳转操作 */}
                <div className="pt-3 border-t border-border space-y-2">
                  <Button size="sm" variant="secondary" className="w-full"
                    onClick={() => setCurrentTime(
                      sortedSB.slice(0, sortedSB.findIndex(s => s.id === selectedSB.id))
                        .reduce((sum, s) => sum + (s.duration ?? 5), 0)
                    )}>
                    📍 定位到时间线
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-ink-muted">
                <div className="text-center">
                  <div className="text-4xl mb-2 opacity-30">⚙️</div>
                  <p className="text-xs">选择一个片段</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: '🎬', label: '分镜数', value: sortedSB.length },
          { icon: '⏱️', label: '总时长', value: `${totalDuration}s` },
          { icon: '🎤', label: '字幕数', value: sortedSB.filter(s => s.dialogue).length },
          { icon: '🔗', label: '转场数', value: sortedSB.length - 1 },
        ].map(stat => (
          <Card key={stat.label} variant="default" className="p-3 text-center">
            <p className="text-lg">{stat.icon}</p>
            <p className="text-lg font-bold text-ink">{stat.value}</p>
            <p className="text-[10px] text-ink-muted">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* 预览作品弹窗 */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* 预览区域 */}
            <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
              {/* 当前分镜 */}
              {(() => {
                const currentIdx = Math.floor(previewProgress * sortedSB.length);
                const currentSB = sortedSB[currentIdx];
                if (!currentSB) return <span className="text-white/50">🎬</span>;
                const imageUrl = currentSB.imageUrls 
                  ? (typeof currentSB.imageUrls === 'string' ? currentSB.imageUrls.split(',')[0] : currentSB.imageUrls)
                  : null;
                return imageUrl 
                  ? <img src={imageUrl} className="w-full h-full object-contain" alt="" />
                  : <div className="text-center text-white/50">
                      <div className="text-6xl mb-3">🎬</div>
                      <p className="text-sm">#{currentSB.sceneNum} · {currentSB.description?.substring(0, 30) || '暂无画面'}</p>
                    </div>;
              })()}
              {/* 进度条 */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${previewProgress * 100}%` }} />
              </div>
              {/* 场景编号 */}
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 text-white text-sm font-bold rounded-lg backdrop-blur-sm">
                #{Math.floor(previewProgress * sortedSB.length) + 1} / {sortedSB.length}
              </div>
              {/* 时间 */}
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 text-white text-sm font-mono rounded-lg backdrop-blur-sm">
                {formatTime(previewProgress * totalDuration)} / {formatTime(totalDuration)}
              </div>
            </div>
            {/* 控制栏 */}
            <div className="p-4 bg-white flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={() => setPreviewProgress(0)}>⏮</Button>
              <Button size="sm" variant="secondary" onClick={() => setPreviewPlaying(!previewPlaying)}>
                {previewPlaying ? '⏸' : '▶️'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPreviewProgress(1)}>⏭</Button>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setPreviewProgress(pct);
                  setCurrentTime(pct * totalDuration);
                }}>
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${previewProgress * 100}%` }} />
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowPreviewModal(false)}>
                ✕ 关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
