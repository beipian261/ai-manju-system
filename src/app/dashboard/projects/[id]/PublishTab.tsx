'use client';
import { useState, useMemo } from 'react';
import { useProjectContext } from './ProjectContext';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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

export default function PublishTab() {
  const { project, storyboards, projectId } = useProjectContext();
  const [platforms, setPlatforms] = useState<Platform[]>(PLATFORMS);
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState(85);
  const [watermark, setWatermark] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');

  const sortedSB = useMemo(() => [...storyboards].sort((a, b) => a.sceneNum - b.sceneNum), [storyboards]);
  const videosReady = sortedSB.filter(s => s.videoUrl || s.imageUrls).length;
  const totalDuration = sortedSB.reduce((sum, s) => sum + (s.duration ?? 5), 0);
  const enabledPlatforms = platforms.filter(p => p.enabled);
  const selectedFormat = FORMATS.find(f => f.id === format)!;

  const estimatedSize = `${Math.round(totalDuration * 1.2 * (quality / 100) * selectedFormat.multiplier)} MB`;

  const togglePlatform = (id: string) => {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleExport = () => {
    if (enabledPlatforms.length === 0 || videosReady === 0) return;
    setPublishing(true);
    setMessage('');
    setTimeout(() => {
      setMessage(`✅ 导出成功！${videosReady} 个分镜已为 ${enabledPlatforms.map(p => p.name).join('、')} 准备就绪（${format.toUpperCase()} · ${quality}% 画质）`);
      setPublishing(false);
    }, 1500);
  };

  if (!projectId) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        title="多平台发布"
        subtitle={project?.title || '漫剧作品发布中心'}
        icon="🚀"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="emerald">{videosReady}/{sortedSB.length} 就绪</Badge>
            <Badge variant="zinc">{totalDuration}s</Badge>
          </div>
        }
      />

      {/* 发布按钮横幅 */}
      <Card variant="default" className="p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="text-base font-semibold text-ink">准备好发布了吗？</p>
            <p className="text-sm text-ink-muted mt-1">已选中 {enabledPlatforms.length} 个平台 · 预计文件大小 {estimatedSize}</p>
            {message && <p className="text-sm text-emerald-700 mt-2 font-medium">{message}</p>}
          </div>
          <Button onClick={handleExport} disabled={publishing || enabledPlatforms.length === 0 || videosReady === 0}
            className="px-6 py-3 text-base">
            {publishing ? '⏳ 导出中...' : '🚀 开始导出'}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 目标平台 */}
        <div className="lg:col-span-4">
          <Card variant="default" className="p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">目标平台</h3>
            <div className="space-y-2.5">
              {platforms.map(p => (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all border ${
                    p.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-border hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      p.enabled ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      {p.id === 'douyin' ? '🎵' : p.id === 'bilibili' ? '📺' : p.id === 'youtube' ? '▶️' : '📕'}
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${p.enabled ? 'text-emerald-700' : 'text-ink'}`}>{p.name}</p>
                      <p className="text-xs text-ink-muted">{p.ratio} · {p.resolution}</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${p.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${p.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* 预览 */}
        <div className="lg:col-span-5">
          <Card variant="default" className="p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">平台预览</h3>
            {enabledPlatforms.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] bg-gray-50 rounded-xl">
                <p className="text-sm text-ink-muted">请选择至少一个目标平台</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {enabledPlatforms.map(p => {
                  const maxDim = 180;
                  const isVertical = p.ratioH > p.ratioW;
                  const w = isVertical ? (p.ratioW / p.ratioH) * maxDim : maxDim;
                  const h = isVertical ? maxDim : (p.ratioH / p.ratioW) * maxDim;
                  return (
                    <div key={p.id} className="text-center">
                      <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center mx-auto mb-2 overflow-hidden"
                        style={{ width: w, height: h }}>
                        {sortedSB[0]?.imageUrls ? (
                          <img src={sortedSB[0].imageUrls.split(',')[0]}
                            className="w-full h-full object-cover opacity-80"
                            alt="预览" />
                        ) : (
                          <span className="text-[10px] text-ink-muted font-medium">{p.ratio}</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-ink">{p.name}</p>
                      <p className="text-[10px] text-ink-muted">{p.resolution}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* 导出设置 */}
        <div className="lg:col-span-3">
          <Card variant="default" className="p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">导出设置</h3>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-ink-secondary mb-2">视频格式</label>
              <div className="flex gap-2">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    format === f.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-ink-secondary hover:bg-gray-200'
                  }`}>{f.label}</button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-semibold text-ink-secondary">画质</span>
                <span className="text-ink-muted font-mono">{quality}%</span>
              </div>
              <input type="range" className="w-full accent-emerald-500" min="10" max="100" step="5"
                value={quality} onChange={e => setQuality(Number(e.target.value))} />
            </div>

            <div className="flex items-center justify-between mb-5 p-3 rounded-xl bg-gray-50 border border-border">
              <span className="text-xs font-semibold text-ink-secondary">添加水印</span>
              <button onClick={() => setWatermark(!watermark)}
                className={`w-10 h-5 rounded-full relative transition-colors ${watermark ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${watermark ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">预计体积</span>
                <span className="text-base font-bold text-emerald-700">{estimatedSize}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 作品统计 */}
      <Card variant="default" className="p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">作品统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon="🎬" label="分镜总数" value={sortedSB.length} />
          <Stat icon="🖼️" label="已生成图片" value={sortedSB.filter(s => s.imageUrls).length} />
          <Stat icon="🎞️" label="已生成视频" value={sortedSB.filter(s => s.videoUrl).length} />
          <Stat icon="⏱️" label="总时长" value={`${totalDuration}s`} />
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{label}</p>
    </div>
  );
}
