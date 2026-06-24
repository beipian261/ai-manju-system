'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

interface Scene {
  id: string;
  sceneNum: number;
  name: string;
  status: 'reviewed' | 'analyzing' | 'pending';
  description: string;
  dialogue: string | null;
  emotion: string | null;
  location: string | null;
  timeOfDay: string | null;
  cameraAngle: string | null;
  visualKeywords: string | null;
  hasImage: boolean;
}

interface Suggestion {
  type: string;
  title: string;
  content: string;
  confidence: 'high' | 'medium';
}

interface AnalysisResult {
  storyboardId: string;
  sceneNum: number;
  title: string | null;
  description: string;
  dialogue: string | null;
  emotionAnalysis: string;
  suggestions: Suggestion[];
}

const getStatusLabel = (s: string) => {
  switch (s) {
    case 'reviewed': return '已审核';
    case 'analyzing': return 'AI 分析中';
    default: return '待分析';
  }
};

const getStatusStyle = (s: string) => {
  switch (s) {
    case 'reviewed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'analyzing': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-base-bg text-ink-secondary border-border';
  }
};

const getItemStyle = (s: string) => {
  switch (s) {
    case 'reviewed': return 'bg-base-bg';
    case 'analyzing': return 'bg-emerald-50/60 border border-emerald-200';
    default: return '';
  }
};

const SUGGESTION_COLORS: Record<string, string> = {
  '构图': '#10B981', '景别': '#059669', '节奏': '#0369A0',
  '转场': '#7C3AED', '色调': '#DC2626',
};

export default function DirectorPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string>('');
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingScenes, setLoadingScenes] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoadingScenes(true);
    apiGet<{ scenes: Scene[] }>(`/api/director/scenes?projectId=${projectId}`)
      .then(data => {
        if (data.scenes) {
          setScenes(data.scenes);
          if (data.scenes.length > 0 && !activeSceneId) setActiveSceneId(data.scenes[0].id);
        }
      })
      .catch(() => setError('加载场景失败'))
      .finally(() => setLoadingScenes(false));
  }, [projectId]);

  useEffect(() => {
    const scene = scenes.find(s => s.id === activeSceneId);
    setActiveScene(scene || null);
    setAnalysis(null);
  }, [activeSceneId, scenes]);

  const runAnalysis = useCallback(async () => {
    if (!activeSceneId || !projectId) return;
    setAnalyzing(true);
    setError('');
    try {
      const data = await apiPost<AnalysisResult>('/api/director/analyze', { storyboardId: activeSceneId, projectId });
      setAnalysis(data);
      setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, status: 'reviewed' as const } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 分析失败');
    } finally { setAnalyzing(false); }
  }, [activeSceneId, projectId]);

  useEffect(() => {
    if (activeScene && !analysis && !analyzing) runAnalysis();
  }, [activeScene, analysis, analyzing, runAnalysis]);

  // Implemented: Adopt suggestion and apply to storyboard via API
  const adoptSuggestion = async (sug: Suggestion) => {
    if (!activeSceneId) return;
    try {
      const updatePayload: Record<string, string> = {};
      if (sug.type === '构图' || sug.type === '景别') updatePayload.cameraAngle = sug.content;
      if (sug.type === '色调') updatePayload.emotion = sug.content;
      if (Object.keys(updatePayload).length > 0) {
        await apiPatch(`/api/storyboards/${activeSceneId}`, updatePayload);
      }
      setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, status: 'reviewed' as const } : s));
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-base-bg">
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
          <h1 className="text-2xl font-bold text-ink">AI 导演模式</h1>
        </div>
        {activeScene && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">当前场景</span>
            <select className="select-field w-56 !py-1.5 text-xs" value={activeSceneId}
              onChange={e => setActiveSceneId(e.target.value)}>
              {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-[260px] flex-shrink-0 bg-white border-r border-border p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">场景列表</h3>
          {loadingScenes ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
          ) : scenes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2 opacity-40">🎬</div>
              <p className="text-xs text-ink-muted">暂无分镜数据</p>
              <p className="text-[10px] text-ink-muted mt-1">请先在项目工作台生成分镜</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scenes.map(scene => (
                <button key={scene.id} onClick={() => setActiveSceneId(scene.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                    activeSceneId === scene.id
                      ? getItemStyle(scene.status)
                      : 'hover:bg-base-bg'
                  }`}>
                  <p className={`text-sm font-semibold mb-1 ${activeSceneId === scene.id ? 'text-emerald-700' : 'text-ink'}`}>
                    {scene.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-[10px] ${getStatusStyle(scene.status)}`}>{getStatusLabel(scene.status)}</span>
                    {scene.hasImage && <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">🖼️ 已出图</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-white border-r border-border p-6 overflow-y-auto scrollbar-thin">
          {activeScene ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink mb-0.5">{activeScene.name}</h2>
                  <p className="text-xs text-ink-muted">{activeScene.location || '未知地点'}{activeScene.timeOfDay ? ` | ${activeScene.timeOfDay}` : ''}{activeScene.emotion ? ` | ${activeScene.emotion}` : ''}</p>
                </div>
                <button onClick={runAnalysis} disabled={analyzing} className="btn-primary btn-sm">
                  {analyzing ? '⏳ 分析中...' : '💡 重新分析'}
                </button>
              </div>

              <div className="card-subtle rounded-2xl p-5 mb-6">
                <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-3">场景描述</p>
                <p className="text-sm text-ink leading-relaxed mb-4">{activeScene.description}</p>
                {activeScene.dialogue && (
                  <>
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-2">对话</p>
                    <p className="text-sm text-ink-secondary leading-relaxed mb-4 italic">{activeScene.dialogue}</p>
                  </>
                )}
                {activeScene.cameraAngle && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2 py-1 rounded-md bg-sky-50 text-sky-700 text-[10px] font-medium border border-sky-200">
                      镜头: {activeScene.cameraAngle}
                    </span>
                    {activeScene.visualKeywords && (
                      <span className="px-2 py-1 rounded-md bg-base-bg text-ink-secondary text-[10px] font-medium border border-border">
                        {activeScene.visualKeywords}
                      </span>
                    )}
                  </div>
                )}

                {analysis?.emotionAnalysis ? (
                  <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">AI 情绪分析</span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">{analysis.emotionAnalysis}</p>
                  </div>
                ) : analyzing ? (
                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 animate-pulse">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">AI 正在分析情绪...</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-emerald-200/50 rounded w-full" />
                      <div className="h-3 bg-emerald-200/50 rounded w-4/5" />
                    </div>
                  </div>
                ) : null}
              </div>

              {error && (<div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-xs text-red-700">{error}</p></div>)}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-5xl mb-3 opacity-30">🎬</div>
                <p className="text-sm text-ink-muted">请从左侧选择一个场景</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-[400px] flex-shrink-0 bg-white p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-base font-bold text-ink mb-4">AI 导演建议</h3>
          
          {analyzing && !analysis ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="card-subtle p-4 animate-pulse">
                  <div className="h-4 bg-border rounded w-1/3 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-border rounded w-full" />
                    <div className="h-3 bg-border rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : analysis?.suggestions && analysis.suggestions.length > 0 ? (
            <div className="space-y-3">
              {analysis.suggestions.map((sug, idx) => (
                <div key={idx} className="card-subtle p-4 hover:bg-emerald-50/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SUGGESTION_COLORS[sug.type] || '#10B981' }} />
                      <span className="text-xs font-semibold text-ink">{sug.title}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${sug.confidence === 'high' ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-50 text-emerald-600'}`}>
                      {sug.confidence === 'high' ? '高置信' : '中置信'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed mb-3">{sug.content}</p>
                  <div className="flex gap-2">
                    <button onClick={() => adoptSuggestion(sug)} className="flex-1 btn-primary btn-sm">
                      ✅ 采纳
                    </button>
                    <button className="flex-1 btn-secondary btn-sm">跳过</button>
                  </div>
                </div>
              ))}
            </div>
          ) : !analyzing ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2 opacity-40">💡</div>
              <p className="text-xs text-ink-muted">点击「重新分析」获取 AI 建议</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
