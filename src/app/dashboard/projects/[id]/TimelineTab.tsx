// TimelineTab — 专业视频编辑器式多轨道时间线 + 实时预览播放器
// 顶部工具栏 | 左侧素材库 | 中央时间线 | 右侧属性检查器
'use client';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useProjectContext } from './ProjectContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Storyboard } from './types';

const TRACK_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6366F1'];
const PIXELS_PER_SECOND = 40;
const TRACK_HEIGHT = 56;

type AspectRatio = '16:9' | '9:16' | '1:1';
const ASPECT_RATIOS: { key: AspectRatio; label: string; w: number; h: number }[] = [
  { key: '16:9', label: '横屏 16:9', w: 16, h: 9 },
  { key: '9:16', label: '竖屏 9:16', w: 9, h: 16 },
  { key: '1:1', label: '方形 1:1', w: 1, h: 1 },
];

interface TimeMarker {
  label: string;
  seconds: number;
}

export default function TimelineTab() {
  const { storyboards, projectId } = useProjectContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const previewPlayingRef = useRef(false);
  const rafRef = useRef<number>(0);

  const [selectedId, setSelectedId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(80);
  const [zoom, setZoom] = useState(1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewAspect, setPreviewAspect] = useState<AspectRatio>('16:9');
  const [showSubtitles, setShowSubtitles] = useState(true);

  const sortedSB = useMemo(
    () => [...storyboards].sort((a, b) => a.sceneNum - b.sceneNum),
    [storyboards]
  );

  // 计算每个分镜的开始时间
  const storyboardTimings = useMemo(() => {
    const timings: Array<{ sb: Storyboard; startSec: number; endSec: number }> = [];
    let acc = 0;
    for (const sb of sortedSB) {
      const dur = sb.duration ?? 5;
      timings.push({ sb, startSec: acc, endSec: acc + dur });
      acc += dur;
    }
    return timings;
  }, [sortedSB]);

  const totalDuration = useMemo(
    () => sortedSB.reduce((sum, s) => sum + (s.duration ?? 5), 0),
    [sortedSB]
  );

  const selectedSB = sortedSB.find(s => s.id === selectedId) || sortedSB[0] || null;

  // 当前播放位置对应的分镜索引
  const currentStoryboardIndex = useMemo(() => {
    for (let i = 0; i < storyboardTimings.length; i++) {
      const t = storyboardTimings[i];
      if (currentTime >= t.startSec && currentTime < t.endSec) return i;
    }
    return storyboardTimings.length - 1;
  }, [currentTime, storyboardTimings]);

  const currentStoryboard = storyboardTimings[currentStoryboardIndex]?.sb || null;

  // 时间刻度
  const timeMarkers: TimeMarker[] = useMemo(() => {
    const markers: TimeMarker[] = [];
    for (let s = 0; s <= totalDuration; s += 5) {
      markers.push({ label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, seconds: s });
    }
    return markers;
  }, [totalDuration]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // 主时间线播放逻辑
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = performance.now();
    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000 * playbackSpeed;
      lastTime = now;
      setCurrentTime(prev => {
        const next = prev + delta;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDuration]);

  // 预览弹窗播放逻辑
  useEffect(() => {
    previewPlayingRef.current = previewPlaying;
    if (!previewPlaying) {
      return;
    }

    let lastTime = performance.now();
    const tick = (now: number) => {
      if (!previewPlayingRef.current) return;
      const delta = (now - lastTime) / 1000 * playbackSpeed;
      lastTime = now;
      setPreviewProgress(prev => {
        const next = prev + delta / totalDuration;
        if (next >= 1) {
          setPreviewPlaying(false);
          return 1;
        }
        return next;
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [previewPlaying, playbackSpeed, totalDuration]);

  // 键盘快捷键
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (showPreviewModal) {
          setPreviewPlaying(p => !p);
        } else {
          setIsPlaying(p => !p);
        }
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime(t => Math.max(0, t - 1));
        setPreviewProgress(p => Math.max(0, p - 1/totalDuration));
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime(t => Math.min(totalDuration, t + 1));
        setPreviewProgress(p => Math.min(1, p + 1/totalDuration));
      }
      if (e.code === 'KeyM') {
        setShowPreviewModal(true);
      }
      if (e.code === 'Escape' && showPreviewModal) {
        setShowPreviewModal(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showPreviewModal, totalDuration]);

  // 同步currentTime到previewProgress，反之亦然
  useEffect(() => {
    if (showPreviewModal) {
      setPreviewProgress(currentTime / totalDuration);
    }
  }, [currentTime, showPreviewModal, totalDuration]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(Math.max(0, Math.min(totalDuration, time)));
  }, [totalDuration]);

  const handlePreviewAll = () => {
    setShowPreviewModal(true);
    setPreviewPlaying(true);
    setPreviewProgress(currentTime / totalDuration);
  };

  // 跳转到指定分镜
  const jumpToStoryboard = (index: number) => {
    if (storyboardTimings[index]) {
      seekTo(storyboardTimings[index].startSec);
    }
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
          <Badge variant="zinc">空格播放/暂停 · M预览</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* 预览按钮 */}
          <Button size="sm" variant="primary" onClick={handlePreviewAll}>
            🎬 预览全部
          </Button>
          {/* 字幕开关 */}
          <Button
            size="sm"
            variant={showSubtitles ? 'primary' : 'secondary'}
            onClick={() => setShowSubtitles(s => !s)}
          >
            💬 字幕 {showSubtitles ? '开' : '关'}
          </Button>
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <span>缩放</span>
            <input type="range" className="w-20 accent-emerald-500" min="0.5" max="3" step="0.1"
              value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          </div>
          {/* 播放速度 */}
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <span>速度</span>
            <select className="px-2 py-1 text-xs border border-border rounded bg-white"
              value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))}>
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
        </div>
      </div>

      {/* 小预览窗 - 始终显示在顶部 */}
      {hasImages && (
        <Card variant="default" className="p-3">
          <div className="flex gap-4">
            {/* 预览画面 */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-shrink-0" style={{ width: '240px', aspectRatio: '16/9' }}>
              {currentStoryboard?.imageUrls ? (
                <img
                  src={(currentStoryboard.imageUrls as string).split(',')[0]}
                  className="w-full h-full object-contain"
                  alt=""
                />
              ) : currentStoryboard?.videoUrl ? (
                <video src={currentStoryboard.videoUrl} className="w-full h-full object-contain" autoPlay muted loop />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50">
                  <span className="text-4xl">🎬</span>
                </div>
              )}
              {/* 字幕 */}
              {showSubtitles && currentStoryboard?.dialogue && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded text-center">
                    {currentStoryboard.dialogue}
                  </div>
                </div>
              )}
              {/* 分镜号 */}
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] font-bold rounded backdrop-blur-sm">
                #{currentStoryboardIndex + 1} / {sortedSB.length}
              </div>
            </div>

            {/* 信息和控制 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-ink text-sm truncate">
                  {currentStoryboard?.title || `分镜 #${currentStoryboardIndex + 1}`}
                </h4>
                {currentStoryboard?.emotion && (
                  <Badge variant="sky">{currentStoryboard.emotion}</Badge>
                )}
              </div>
              {currentStoryboard?.description && (
                <p className="text-xs text-ink-muted line-clamp-2 mb-3">{currentStoryboard.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => seekTo(0)}>⏮</Button>
                <Button size="sm" variant="primary" onClick={togglePlay}>
                  {isPlaying ? '⏸ 暂停' : '▶️ 播放'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => seekTo(totalDuration)}>⏭</Button>
                <span className="text-xs font-mono text-ink-muted ml-2">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 三栏主体 */}
      <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 420px)', minHeight: '400px' }}>
        {/* 左侧：素材库 */}
        <div className="col-span-2 flex flex-col">
          <Card variant="default" className="flex-1 p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-ink">素材库</h3>
              <Badge variant="zinc">{sortedSB.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {storyboardTimings.map(({ sb, startSec }, idx) => {
                const hasVideo = !!sb.videoUrl;
                const hasImage = !!sb.imageUrls;
                const dur = (sb.duration ?? 5);
                const isActive = currentStoryboardIndex === idx;
                const isSelected = selectedSB?.id === sb.id;
                const color = TRACK_COLORS[idx % TRACK_COLORS.length];

                return (
                  <button
                    key={sb.id}
                    onClick={() => {
                      setSelectedId(sb.id);
                      jumpToStoryboard(idx);
                    }}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-emerald-50 border border-emerald-300 ring-1 ring-emerald-200'
                        : isSelected
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'hover:bg-gray-50 border border-transparent'
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
                        <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-700' : 'text-ink'}`}>#{sb.sceneNum}</span>
                        {hasVideo && <span className="text-[8px]">🎬</span>}
                        {hasImage && <span className="text-[8px]">🖼️</span>}
                      </div>
                      <span className="text-[9px] text-ink-muted">{formatTime(startSec)} · {dur}s</span>
                    </div>
                    {isActive && isPlaying && (
                      <span className="text-[10px] animate-pulse">▶</span>
                    )}
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
                  >
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45" />
                  </div>
                </div>
              </div>
            </div>

            {/* 播放进度条 */}
            <div className="flex items-center gap-3 mb-3 pl-4">
              <div className="w-12 flex-shrink-0 text-xs text-ink-muted font-mono">
                {formatTime(currentTime)}
              </div>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden cursor-pointer group relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  seekTo(pct * totalDuration);
                }}>
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all" style={{ width: `${(currentTime / totalDuration) * 100}%` }} />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${(currentTime / totalDuration) * 100}% - 6px)` }}
                />
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
                    {storyboardTimings.map(({ sb, startSec }, idx) => {
                      const dur = (sb.duration ?? 5);
                      const color = TRACK_COLORS[idx % TRACK_COLORS.length];
                      const isActive = currentStoryboardIndex === idx;
                      const isSelected = selectedSB?.id === sb.id;
                      return (
                        <button
                          key={sb.id}
                          onClick={() => {
                            setSelectedId(sb.id);
                            jumpToStoryboard(idx);
                          }}
                          style={{
                            position: 'absolute',
                            left: `${startSec * PIXELS_PER_SECOND * zoom}px`,
                            width: `${dur * PIXELS_PER_SECOND * zoom}px`,
                            background: color,
                            opacity: sb.videoUrl ? 1 : sb.imageUrls ? 0.8 : 0.4,
                          }}
                          className={`top-1 bottom-1 rounded-lg p-1.5 text-left transition-all hover:brightness-110 overflow-hidden ${
                            isActive ? 'ring-2 ring-offset-1 ring-red-500 z-10' : isSelected ? 'ring-2 ring-offset-1 ring-emerald-500' : ''
                          }`}
                        >
                          {sb.imageUrls && (
                            <img
                              src={(sb.imageUrls as string).split(',')[0]}
                              className="absolute inset-0 w-full h-full object-cover opacity-60"
                              alt=""
                            />
                          )}
                          <div className="relative">
                            <p className="text-[10px] font-semibold text-white truncate leading-tight drop-shadow">#{sb.sceneNum}</p>
                            <p className="text-[9px] text-white/90 truncate drop-shadow">{dur}s</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 音频轨道 */}
                  <div className="h-[36px] bg-gray-50 rounded-lg border border-border relative overflow-hidden">
                    {storyboardTimings.filter(({ sb }) => sb.dialogue).map(({ sb, startSec }, idx) => {
                      const dur = (sb.duration ?? 5);
                      return (
                        <div key={sb.id}
                          style={{
                            position: 'absolute',
                            left: `${startSec * PIXELS_PER_SECOND * zoom}px`,
                            width: `${dur * PIXELS_PER_SECOND * zoom}px`,
                          }}
                          className="top-1 bottom-1 rounded bg-amber-400/60 flex items-center px-1.5">
                          <span className="text-[9px] text-amber-800 font-medium truncate">🎤 {(sb.dialogue || '').substring(0, 6)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 字幕轨道 */}
                  <div className="h-[36px] bg-gray-50 rounded-lg border border-border relative overflow-hidden">
                    {storyboardTimings.filter(({ sb }) => sb.dialogue).map(({ sb, startSec }, idx) => {
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
                            「{(sb.dialogue || '').substring(0, 8)}...」
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
              <Button size="sm" variant="secondary" onClick={() => seekTo(0)}>⏮</Button>
              <Button size="sm" variant="secondary" onClick={() => jumpToStoryboard(Math.max(0, currentStoryboardIndex - 1))}>
                ⏪
              </Button>
              <Button size="sm" variant="primary" onClick={togglePlay}>
                {isPlaying ? '⏸ 暂停' : '▶️ 播放'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => jumpToStoryboard(Math.min(storyboardTimings.length - 1, currentStoryboardIndex + 1))}>
                ⏩
              </Button>
              <Button size="sm" variant="secondary" onClick={() => seekTo(totalDuration)}>⏭</Button>
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
                <div className="w-full h-36 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {selectedSB.imageUrls ? (
                    <img src={(selectedSB.imageUrls as string).split(',')[0]}
                      className="w-full h-full object-cover" alt="" />
                  ) : selectedSB.videoUrl ? (
                    <video src={selectedSB.videoUrl} className="w-full h-full object-cover" autoPlay muted loop />
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
                    { label: '场景', value: selectedSB.location || '未设置' },
                    { label: '时间', value: selectedSB.timeOfDay || '未设置' },
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

                {/* 时长调整 */}
                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-ink-secondary">片段时长</span>
                    <span className="text-ink-muted font-mono">{selectedSB.duration ?? 5}s</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={selectedSB.duration ?? 5}
                    className="w-full accent-emerald-500"
                    readOnly
                  />
                </div>

                {/* 描述 */}
                {selectedSB.description && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-ink-secondary mb-1.5">画面描述</p>
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
                    onClick={() => jumpToStoryboard(sortedSB.findIndex(s => s.id === selectedSB.id))}>
                    📍 定位并播放
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
      <div className="grid grid-cols-6 gap-3">
        {[
          { icon: '🎬', label: '分镜数', value: sortedSB.length },
          { icon: '⏱️', label: '总时长', value: `${totalDuration}s` },
          { icon: '🎤', label: '字幕数', value: sortedSB.filter(s => s.dialogue).length },
          { icon: '🖼️', label: '图片', value: sortedSB.filter(s => s.imageUrls).length },
          { icon: '🎞️', label: '视频', value: sortedSB.filter(s => s.videoUrl).length },
          { icon: '🔗', label: '转场数', value: sortedSB.length - 1 },
        ].map(stat => (
          <Card key={stat.label} variant="default" className="p-3 text-center">
            <p className="text-lg">{stat.icon}</p>
            <p className="text-lg font-bold text-ink">{stat.value}</p>
            <p className="text-[10px] text-ink-muted">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* 全屏预览弹窗 - 增强版 */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <div className="absolute inset-0" onClick={() => setShowPreviewModal(false)} />
          <div className="relative w-full max-w-5xl">
            {/* 顶部控制栏 */}
            <div className="flex items-center justify-between mb-4 text-white">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">作品预览</h3>
                <Badge variant="emerald">{currentStoryboardIndex + 1}/{sortedSB.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {/* 比例切换 */}
                <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                  {ASPECT_RATIOS.map(ar => (
                    <button
                      key={ar.key}
                      onClick={() => setPreviewAspect(ar.key)}
                      className={`px-2 py-1 text-xs rounded transition-all ${
                        previewAspect === ar.key ? 'bg-white text-black font-medium' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowSubtitles(s => !s)}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    showSubtitles ? 'bg-white text-black' : 'bg-white/10 text-white/70'
                  }`}
                >
                  💬 字幕
                </button>
                <Button size="sm" variant="secondary" onClick={() => setShowPreviewModal(false)}>
                  ✕ 关闭 (Esc)
                </Button>
              </div>
            </div>

            {/* 预览区域 */}
            <div className="flex justify-center">
              <div
                className="relative bg-black rounded-xl overflow-hidden shadow-2xl"
                style={{
                  aspectRatio: ASPECT_RATIOS.find(a => a.key === previewAspect) ? `${ASPECT_RATIOS.find(a => a.key === previewAspect)!.w}/${ASPECT_RATIOS.find(a => a.key === previewAspect)!.h}` : '16/9',
                  maxHeight: '70vh',
                  maxWidth: '100%',
                  width: previewAspect === '9:16' ? 'auto' : '100%',
                  height: previewAspect === '9:16' ? '70vh' : 'auto',
                }}
              >
                {(() => {
                  const previewTime = previewProgress * totalDuration;
                  let previewIdx = 0;
                  for (let i = 0; i < storyboardTimings.length; i++) {
                    if (previewTime >= storyboardTimings[i].startSec && previewTime < storyboardTimings[i].endSec) {
                      previewIdx = i;
                      break;
                    }
                    if (i === storyboardTimings.length - 1) previewIdx = i;
                  }
                  const previewSB = storyboardTimings[previewIdx]?.sb;
                  const imageUrl = previewSB?.imageUrls
                    ? (typeof previewSB.imageUrls === 'string' ? previewSB.imageUrls.split(',')[0] : previewSB.imageUrls)
                    : null;
                  return (
                    <>
                      {imageUrl ? (
                        <img src={imageUrl} className="w-full h-full object-contain" alt="" />
                      ) : previewSB?.videoUrl ? (
                        <video src={previewSB.videoUrl} className="w-full h-full object-contain" autoPlay muted loop />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/50">
                          <div className="text-6xl mb-3">🎬</div>
                          <p className="text-sm">#{previewIdx + 1} · {(previewSB?.description || '暂无画面').substring(0, 30)}</p>
                        </div>
                      )}

                      {/* 字幕 */}
                      {showSubtitles && previewSB?.dialogue && (
                        <div className="absolute bottom-6 left-6 right-6 flex justify-center">
                          <div className="bg-black/80 backdrop-blur-sm text-white text-base md:text-lg px-4 py-2 rounded-lg text-center max-w-[80%]">
                            {previewSB.dialogue}
                          </div>
                        </div>
                      )}

                      {/* 场景信息 */}
                      <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 text-white text-sm font-bold rounded-lg backdrop-blur-sm">
                        #{previewIdx + 1} / {sortedSB.length}
                      </div>

                      {/* 时间 */}
                      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 text-white text-sm font-mono rounded-lg backdrop-blur-sm">
                        {formatTime(previewTime)} / {formatTime(totalDuration)}
                      </div>

                      {/* 渐变遮罩 */}
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 底部控制栏 */}
            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={() => setPreviewProgress(0)}>⏮</Button>
              <Button size="sm" variant="primary" onClick={() => setPreviewPlaying(!previewPlaying)}>
                {previewPlaying ? '⏸ 暂停' : '▶️ 播放'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPreviewProgress(1)}>⏭</Button>
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer group relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setPreviewProgress(pct);
                }}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${previewProgress * 100}%` }} />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                  style={{ left: `calc(${previewProgress * 100}% - 8px)` }}
                />
              </div>
              <span className="text-white text-sm font-mono min-w-[100px] text-right">
                {formatTime(previewProgress * totalDuration)}
              </span>
            </div>

            {/* 分镜缩略图导航 */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {storyboardTimings.map(({ sb, startSec }, idx) => {
                const isActive = Math.abs(previewProgress * totalDuration - startSec) < (sb.duration ?? 5);
                return (
                  <button
                    key={sb.id}
                    onClick={() => setPreviewProgress(startSec / totalDuration)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      isActive ? 'border-emerald-500 scale-110' : 'border-white/20 hover:border-white/50 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {sb.imageUrls ? (
                      <img src={(sb.imageUrls as string).split(',')[0]} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 text-xs">#{idx + 1}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
