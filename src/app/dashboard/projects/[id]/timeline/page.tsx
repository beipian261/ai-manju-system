'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';
import { apiGet } from '@/lib/api-client';

interface StoryboardClip {
  id: string;
  sceneNum: number;
  title: string | null;
  description: string;
  dialogue: string | null;
  duration: number | null;
  videoUrl: string | null;
  videoStatus: string | null;
  imageUrls: string | null;
  emotion: string | null;
}

const CLIP_COLORS = ['#A16207', '#0369A0', '#14803C', '#7C3AED', '#DC2626', '#D97706'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimelinePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [clips, setClips] = useState<StoryboardClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(80);

  // 加载分镜数据
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiGet<StoryboardClip[]>(`/api/storyboards?projectId=${projectId}`)
      .then(data => {
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) => a.sceneNum - b.sceneNum);
        setClips(sorted);
        if (sorted.length > 0) setSelectedClipId(sorted[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  // 计算总时长
  const totalDuration = clips.reduce((sum, c) => sum + (c.duration || 5), 0);

  // 选中片段
  const selectedClip = clips.find(c => c.id === selectedClipId);
  const selectedIdx = clips.findIndex(c => c.id === selectedClipId);

  // 计算选中片段的入点
  const clipInPoint = clips.slice(0, selectedIdx).reduce((sum, c) => sum + (c.duration || 5), 0);

  // 生成时间刻度
  const timeMarks: number[] = [];
  for (let t = 0; t <= Math.max(totalDuration, 45); t += 5) {
    timeMarks.push(t);
  }

  // 音频波形（模拟）
  const audioBars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    height: 8 + Math.abs(Math.sin(i * 0.3) * Math.cos(i * 0.7)) * 35,
  }));

  // 字幕（从对话生成）
  const subtitles = clips
    .filter(c => c.dialogue)
    .map(c => {
      const idx = clips.indexOf(c);
      const inPoint = clips.slice(0, idx).reduce((sum, cl) => sum + (cl.duration || 5), 0);
      const dur = c.duration || 5;
      return {
        id: c.id,
        inPoint,
        duration: dur,
        text: c.dialogue!.slice(0, 20) + (c.dialogue!.length > 20 ? '...' : ''),
      };
    });

  // 转场标记（每个片段之间）
  const transitions = clips.slice(0, -1).map((c, i) => {
    const inPoint = clips.slice(0, i + 1).reduce((sum, cl) => sum + (cl.duration || 5), 0);
    return { id: `t-${i}`, inPoint };
  });

  const pxPerSecond = 20; // 1 second = 20px
  const timelineWidth = Math.max(totalDuration * pxPerSecond, 800);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1C1917', color: '#D6D3D1' }}>
      <Navbar />
      
      {/* Toolbar */}
      <div className="h-14 flex items-center justify-between px-6 border-b" style={{ borderColor: '#292524' }}>
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/projects/${projectId}`} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-emerald-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回项目
          </Link>
          <div className="w-px h-5" style={{ background: '#44403C' }} />
          {/* Play button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: '#A16207' }}
          >
            {isPlaying ? (
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="text-sm font-semibold text-white">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
          <div className="w-px h-5" style={{ background: '#44403C' }} />
          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-stone-700 transition-colors">
            <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        </div>

        <h1 className="text-sm font-bold text-stone-300">时间线编辑器</h1>

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">{clips.length} 个片段</span>
          <button
            className="btn-primary btn-sm"
            disabled={clips.filter(c => c.videoUrl).length === 0}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出视频
          </button>
        </div>
      </div>

      {/* Main Timeline Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track Labels */}
        <div className="w-[120px] flex-shrink-0 border-r" style={{ borderColor: '#292524', background: '#1C1917' }}>
          <div className="h-7 border-b flex items-center px-4" style={{ borderColor: '#292524' }}>
            <span className="text-[10px] font-semibold text-stone-500 uppercase">轨道</span>
          </div>
          {[
            { label: '画面', sub: `${clips.length} 个片段`, h: 60 },
            { label: '音频', sub: '1 条音轨', h: 50 },
            { label: '字幕', sub: `${subtitles.length} 段`, h: 36 },
            { label: '转场', sub: `${transitions.length} 处`, h: 32 },
          ].map(track => (
            <div key={track.label} className="flex flex-col justify-center px-4 border-b" style={{ height: track.h, borderColor: '#292524' }}>
              <span className="text-[11px] font-semibold text-stone-400">{track.label}</span>
              <span className="text-[9px] text-stone-600">{track.sub}</span>
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-stone-500 text-sm">加载中...</div>
            </div>
          ) : clips.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-12 h-12 text-stone-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-stone-500">暂无分镜数据</p>
                <p className="text-xs text-stone-600 mt-1">请先在项目工作台生成分镜</p>
              </div>
            </div>
          ) : (
            <div style={{ minWidth: timelineWidth + 'px' }}>
              {/* Time Ruler */}
              <div className="h-7 border-b flex items-center" style={{ borderColor: '#292524' }}>
                {timeMarks.map(t => (
                  <div key={t} className="text-[10px] text-stone-500 text-center" style={{ width: (5 * pxPerSecond) + 'px' }}>
                    {formatTime(t)}
                  </div>
                ))}
              </div>

              {/* Video Track */}
              <div className="border-b relative flex items-center px-1" style={{ height: 60, borderColor: '#292524', background: '#0D0B0A' }}>
                {clips.map((clip, idx) => {
                  const dur = clip.duration || 5;
                  const width = dur * pxPerSecond;
                  const color = CLIP_COLORS[idx % CLIP_COLORS.length];
                  const hasVideo = !!clip.videoUrl;
                  return (
                    <button
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className={`rounded-lg flex flex-col items-start px-2 mx-0.5 text-xs font-medium transition-all overflow-hidden ${
                        selectedClipId === clip.id ? 'ring-2 ring-white/30 scale-[1.02]' : ''
                      }`}
                      style={{ background: color, width: width - 4, height: 48, color: '#fff', opacity: hasVideo ? 1 : 0.5 }}
                    >
                      <span className="text-[10px] truncate w-full">{clip.title || `场景${clip.sceneNum}`}</span>
                      <span className="text-[9px] opacity-70">{formatTime(dur)}</span>
                      {!hasVideo && (
                        <span className="text-[8px] opacity-60 mt-0.5">
                          {clip.videoStatus === 'in_progress' ? '生成中...' : clip.videoStatus === 'failed' ? '失败' : '未生成'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Audio Track - Waveform bars */}
              <div className="border-b flex items-center gap-[2px] px-4" style={{ height: 50, borderColor: '#292524', background: '#0D0B0A' }}>
                {audioBars.map(bar => (
                  <div key={bar.id} className="rounded-sm" style={{ width: 4, height: bar.height, background: '#06B6D4', opacity: 0.7 }} />
                ))}
              </div>

              {/* Subtitle Track */}
              <div className="border-b flex items-center px-1 relative" style={{ height: 36, borderColor: '#292524', background: '#0D0B0A' }}>
                {subtitles.map(sub => (
                  <div
                    key={sub.id}
                    className="rounded-md flex items-center justify-center absolute"
                    style={{
                      left: sub.inPoint * pxPerSecond + 'px',
                      width: sub.duration * pxPerSecond - 4 + 'px',
                      height: 28,
                      background: '#292524',
                    }}
                  >
                    <span className="text-[10px] text-stone-400 truncate px-2">{sub.text}</span>
                  </div>
                ))}
              </div>

              {/* Transition Track */}
              <div className="flex items-center px-4 relative" style={{ height: 32, background: '#0D0B0A' }}>
                {transitions.map(t => (
                  <div
                    key={t.id}
                    className="absolute h-6 w-6 rounded flex items-center justify-center"
                    style={{ left: t.inPoint * pxPerSecond - 12 + 'px', background: '#A16207' }}
                  >
                    <span className="text-[10px] font-bold text-white">T</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        <div className="w-[280px] flex-shrink-0 border-l p-4 overflow-y-auto scrollbar-thin" style={{ borderColor: '#292524', background: '#1C1917' }}>
          {selectedClip ? (
            <>
              <h2 className="text-sm font-bold text-white mb-4">片段属性</h2>

              {/* Clip Info */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">片段名称</span>
                  <span className="text-stone-300 font-medium truncate ml-2">{selectedClip.title || `场景${selectedClip.sceneNum}`}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">时长</span>
                  <span className="text-stone-300 font-medium">{selectedClip.duration || 5}s</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">入点 / 出点</span>
                  <span className="text-stone-300 font-medium">{formatTime(clipInPoint)} / {formatTime(clipInPoint + (selectedClip.duration || 5))}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">视频状态</span>
                  <span className={`font-medium ${
                    selectedClip.videoStatus === 'completed' ? 'text-emerald-400' :
                    selectedClip.videoStatus === 'in_progress' ? 'text-amber-400' :
                    selectedClip.videoStatus === 'failed' ? 'text-red-400' :
                    'text-stone-500'
                  }`}>
                    {selectedClip.videoStatus === 'completed' ? '已生成' :
                     selectedClip.videoStatus === 'in_progress' ? '生成中' :
                     selectedClip.videoStatus === 'failed' ? '失败' :
                     '未生成'}
                  </span>
                </div>
                {selectedClip.emotion && (
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">情绪</span>
                    <span className="text-stone-300 font-medium">{selectedClip.emotion}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-4">
                <p className="text-[10px] text-stone-500 mb-1">场景描述</p>
                <p className="text-[11px] text-stone-400 leading-relaxed line-clamp-3">{selectedClip.description}</p>
              </div>

              <div className="my-4 border-t" style={{ borderColor: '#44403C' }} />

              {/* Settings */}
              <div className="space-y-4">
                {/* Speed */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-stone-500">播放速度</span>
                    <span className="text-stone-300 font-medium">{speed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-amber-600"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                  />
                </div>

                {/* Volume */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-stone-500">音量</span>
                    <span className="text-stone-300 font-medium">{volume}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-amber-600"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={e => setVolume(parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* Video preview link */}
              {selectedClip.videoUrl && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#44403C' }}>
                  <a
                    href={selectedClip.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    查看视频文件
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-stone-600">选择一个片段查看属性</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
