'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-client';

interface Platform {
  id: string;
  name: string;
  ratio: string;
  ratioW: number;
  ratioH: number;
  enabled: boolean;
  resolution: string;
}

const PLATFORMS: Platform[] = [
  { id: 'douyin', name: '抖音', ratio: '9:16', ratioW: 9, ratioH: 16, enabled: true, resolution: '1080x1920' },
  { id: 'bilibili', name: 'Bilibili', ratio: '16:9', ratioW: 16, ratioH: 9, enabled: true, resolution: '1920x1080' },
  { id: 'youtube', name: 'YouTube', ratio: '16:9', ratioW: 16, ratioH: 9, enabled: false, resolution: '1920x1080' },
  { id: 'xhs', name: '小红书', ratio: '1:1', ratioW: 1, ratioH: 1, enabled: false, resolution: '1080x1080' },
];

const FORMATS = [
  { id: 'mp4', label: 'MP4', multiplier: 1.0 },
  { id: 'mov', label: 'MOV', multiplier: 2.5 },
  { id: 'gif', label: 'GIF', multiplier: 0.7 },
];

interface VideoInfo {
  storyboardId: string;
  sceneNum: number;
  title: string | null;
  url: string;
  duration: number | null;
}

export default function PublishPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [platforms, setPlatforms] = useState(PLATFORMS);
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState(85);
  const [watermark, setWatermark] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState('');
  const [error, setError] = useState('');
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [stats, setStats] = useState({ total: 0, videosReady: 0, imagesReady: 0, totalDuration: 0, allReady: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiGet<{ videoUrls: VideoInfo[]; stats: typeof stats }>(`/api/publish/export?projectId=${projectId}`)
      .then(data => {
        if (data.videoUrls) setVideos(data.videoUrls);
        if (data.stats) setStats(data.stats);
      })
      .catch(() => setError('加载项目数据失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const togglePlatform = (id: string) => {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const enabledPlatforms = platforms.filter(p => p.enabled);
  const selectedFormat = FORMATS.find(f => f.id === format);

  const estimatedSize = (() => {
    const baseMBPerSec = 1.2;
    const sizeMB = stats.totalDuration * baseMBPerSec * (quality / 100) * (selectedFormat?.multiplier || 1);
    if (sizeMB > 1024) return `${(sizeMB / 1024).toFixed(1)} GB`;
    return `~${Math.round(sizeMB)} MB`;
  })();

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    setPublishResult('');
    try {
      const data = await apiPost<{ message?: string; error?: string }>('/api/publish/export', {
        projectId,
        platforms: enabledPlatforms.map(p => ({ id: p.id, name: p.name, ratio: p.ratio, resolution: p.resolution })),
        format,
        quality,
        watermark,
      });
      setPublishResult(data.message || '导出成功');
      if (videos.length > 0) {
        videos.forEach((video, idx) => {
          setTimeout(() => {
            const a = document.createElement('a');
            a.href = video.url;
            a.download = `${video.sceneNum}_${video.title || 'scene'}.${format}`;
            a.target = '_blank';
            a.click();
          }, idx * 500);
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/projects/${projectId}`} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-emerald-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回项目
          </Link>
          <div className="w-px h-5 bg-border" />
          <div>
            <h1 className="text-2xl font-bold text-ink">多平台发布中心</h1>
            <p className="text-sm text-ink-secondary">导出并发布你的漫剧作品</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className={`text-xs font-semibold ${stats.allReady ? 'text-emerald-600' : 'text-ink-muted'}`}>
              {stats.videosReady}/{stats.total} 视频就绪
            </span>
          )}
          <button className="btn-primary" onClick={handlePublish} disabled={publishing || enabledPlatforms.length === 0 || stats.videosReady === 0}>
            {publishing ? '⏳ 导出中...' : '📤 开始导出'}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      {publishResult && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-center gap-2">
            <span className="text-emerald-600">✅</span>
            <p className="text-sm text-emerald-700 font-medium">{publishResult}</p>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-[320px] flex-shrink-0 bg-white border-r border-border p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">目标平台</h3>
          <div className="space-y-2">
            {platforms.map(platform => (
              <div key={platform.id} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${platform.enabled ? 'bg-emerald-50/60 border border-emerald-200' : 'bg-white'}`}>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${platform.enabled ? 'text-emerald-700' : 'text-ink-secondary'}`}>{platform.name}</p>
                  <p className="text-[11px] text-ink-muted">{platform.ratio} | {platform.resolution}</p>
                </div>
                <button onClick={() => togglePlatform(platform.id)} className={`w-10 h-5 rounded-full transition-colors ${platform.enabled ? 'bg-emerald-500' : 'bg-border-strong'} relative`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${platform.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          {!loading && videos.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">视频列表 ({videos.length})</h3>
              <div className="space-y-2">
                {videos.map(video => (
                  <a key={video.storyboardId} href={video.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-emerald-50/40 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">🎬</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">第{video.sceneNum}场</p>
                      <p className="text-[10px] text-ink-muted">{video.duration || 5}s</p>
                    </div>
                    <span className="text-ink-muted group-hover:text-emerald-600 transition-colors">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="mt-6 text-center py-8">
              <div className="text-4xl mb-2 opacity-40">🎬</div>
              <p className="text-xs text-ink-muted">暂无已完成的视频</p>
              <p className="text-[10px] text-ink-muted mt-1">请先在项目工作台生成视频</p>
            </div>
          )}
        </div>

        <div className="flex-1 bg-white border-r border-border p-6 overflow-y-auto scrollbar-thin">
          <h2 className="text-base font-bold text-ink mb-4">平台预览</h2>
          {enabledPlatforms.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-ink-muted text-sm">请在左侧选择目标平台</div>
          ) : (
            <div className="flex flex-wrap items-start gap-6">
              {enabledPlatforms.map(platform => {
                const maxDim = 300;
                const isVertical = platform.ratioH > platform.ratioW;
                const w = isVertical ? (platform.ratioW / platform.ratioH) * maxDim : maxDim;
                const h = isVertical ? maxDim : (platform.ratioH / platform.ratioW) * maxDim;
                return (
                  <div key={platform.id} className="text-center">
                    <div className="rounded-2xl border-2 border-emerald-200 bg-gray-50 flex items-center justify-center mb-2 relative overflow-hidden"
                      style={{ width: w, height: h }}>
                      {videos[0]?.url ? (
                        <video src={videos[0].url} className="w-full h-full object-contain" muted loop
                          onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={e => (e.target as HTMLVideoElement).pause()} />
                      ) : (
                        <span className="text-ink-muted text-xs">{platform.ratio}</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-ink">{platform.name}</p>
                    <p className="text-[10px] text-ink-muted">{platform.resolution}</p>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && (
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="card-flat p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.videosReady}</p>
                <p className="text-[10px] text-ink-muted mt-1">视频就绪</p>
              </div>
              <div className="card-flat p-4 text-center">
                <p className="text-2xl font-bold text-ink-secondary">{stats.totalDuration}s</p>
                <p className="text-[10px] text-ink-muted mt-1">总时长</p>
              </div>
              <div className="card-flat p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.imagesReady}</p>
                <p className="text-[10px] text-ink-muted mt-1">图片就绪</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-[300px] flex-shrink-0 bg-white p-4 overflow-y-auto scrollbar-thin">
          <h2 className="text-base font-bold text-ink mb-4">导出设置</h2>
          <div className="mb-5">
            <label className="block text-xs font-semibold text-ink-secondary mb-2">视频格式</label>
            <div className="flex gap-2">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${format === f.id ? 'bg-ink text-white' : 'card-flat text-ink-secondary'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-semibold text-ink-secondary">画质</span>
              <span className="text-ink-muted">{quality}%</span>
            </div>
            <input type="range" className="w-full accent-emerald-500" min="10" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))} />
            <div className="progress-track mt-2">
              <div className="progress-fill" style={{ width: `${quality}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between mb-5 p-3 rounded-xl bg-white border border-border">
            <span className="text-xs text-ink-secondary">添加水印</span>
            <button onClick={() => setWatermark(!watermark)}
              className={`w-10 h-5 rounded-full transition-colors ${watermark ? 'bg-emerald-500' : 'bg-border-strong'} relative`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${watermark ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="card-flat p-4 flex items-center justify-between mb-4">
            <span className="text-xs text-ink-secondary">预计文件大小</span>
            <span className="text-base font-bold text-emerald-600">{estimatedSize}</span>
          </div>
          <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 flex-shrink-0 mt-0.5">💡</span>
              <div className="text-[11px] text-emerald-700 leading-relaxed">
                <p className="font-semibold mb-1">导出说明</p>
                <p>点击「开始导出」将生成下载清单并下载所有已完成的视频文件。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
