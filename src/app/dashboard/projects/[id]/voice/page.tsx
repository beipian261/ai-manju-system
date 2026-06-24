'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-client';

interface DialogueLine {
  id: string;
  sceneNum: number;
  title: string | null;
  character: string;
  characterId: string | null;
  gender: string | null;
  personality: string | null;
  emotion: string;
  text: string;
  status: 'pending' | 'active' | 'done';
}

interface GeneratedVoice {
  storyboardId: string;
  sceneNum: number;
  dialogue: string;
  voiceDirection: string;
  ssml: string;
  estimatedDuration: string;
  tips: string[];
  voice: string;
  speed: number;
  pitch: number;
  emotions: string[];
}

const EMOTION_TAGS = ['冷静', '愤怒', '悲伤', '喜悦', '恐惧', '惊讶', '厌恶', '温柔'];
const TABS = [
  { key: 'voice', label: '角色配音' },
  { key: 'music', label: '背景音乐' },
  { key: 'sfx', label: '音效库' },
];
const VOICE_OPTIONS = [
  '成熟女声 (沉稳 / 知性)', '青年男声 (磁性 / 低音)', '少女声 (清甜 / 活力)',
  '御姐声 (冷艳 / 气场)', '少年声 (清朗 / 阳光)', '老年声 (沙哑 / 沧桑)',
];

export default function VoicePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState('voice');
  const [lines, setLines] = useState<DialogueLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0]);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedVoice, setGeneratedVoice] = useState<GeneratedVoice | null>(null);
  const [generatedClips, setGeneratedClips] = useState<GeneratedVoice[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiGet<{ lines: DialogueLine[] }>(`/api/voice/lines?projectId=${projectId}`)
      .then(data => {
        if (data.lines) {
          setLines(data.lines);
          if (data.lines.length > 0) setSelectedLineId(data.lines[0].id);
        }
      })
      .catch(() => setError('加载台词失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const selectedLine = lines.find(l => l.id === selectedLineId);

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev =>
      prev.includes(emotion) ? prev.filter(e => e !== emotion) : [...prev, emotion]
    );
  };

  const handleGenerate = async () => {
    if (!selectedLineId) return;
    setGenerating(true);
    setError('');
    try {
      const data = await apiPost<GeneratedVoice>('/api/voice/generate', { storyboardId: selectedLineId, voice: selectedVoice, speed, pitch, emotions: selectedEmotions });
      setGeneratedVoice(data);
      setGeneratedClips(prev => [data, ...prev.filter(c => c.storyboardId !== data.storyboardId)]);
      setLines(prev => prev.map(l => l.id === selectedLineId ? { ...l, status: 'done' as const } : l));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const getLineStyle = (line: DialogueLine) => {
    if (line.id === selectedLineId) return 'bg-emerald-50/60 border border-emerald-200';
    if (line.status === 'done') return 'bg-base-bg';
    return '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'text-emerald-600';
      case 'active': return 'text-emerald-600';
      default: return 'text-ink-muted';
    }
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
          <h1 className="text-2xl font-bold text-ink">配音音效中心</h1>
        </div>
        <div className="flex items-center gap-1 bg-base-bg rounded-xl p-0.5 border border-border">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === tab.key ? 'bg-ink text-white' : 'text-ink-secondary hover:text-ink'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-[360px] flex-shrink-0 bg-white border-r border-border p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">台词列表 {lines.length > 0 && `(${lines.length})`}</h3>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}</div>
          ) : lines.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2 opacity-40">🎤</div>
              <p className="text-xs text-ink-muted">暂无台词数据</p>
              <p className="text-[10px] text-ink-muted mt-1">请先在项目工作台生成剧本和分镜</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map(line => (
                <button key={line.id} onClick={() => { setSelectedLineId(line.id); setGeneratedVoice(generatedClips.find(c => c.storyboardId === line.id) || null); }}
                  className={`w-full text-left p-4 rounded-2xl transition-all duration-200 ${getLineStyle(line)} ${line.id !== selectedLineId ? 'hover:bg-base-bg' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-emerald-600">{line.character.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{line.character}</p>
                        <p className="text-[11px] text-ink-muted">第{line.sceneNum}场 · {line.emotion}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium ${getStatusColor(line.status)}`}>{line.status === 'done' ? '已生成' : '待生成'}</span>
                  </div>
                  <p className="text-sm text-ink-secondary line-clamp-2">{line.text}</p>
                  {line.status === 'done' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-emerald-600 text-xs">🔊</span>
                      <span className="text-[11px] text-emerald-600">配音脚本已生成</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-white border-r border-border p-6 overflow-y-auto scrollbar-thin">
          {selectedLine ? (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-ink mb-2">语音配置</h2>
                <div className="card-subtle p-4">
                  <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide mb-1">当前台词</p>
                  <p className="text-sm text-ink">"{selectedLine.text}"</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-ink-muted">{selectedLine.character}</span>
                    {selectedLine.gender && <span className="text-[11px] text-ink-muted">| {selectedLine.gender}</span>}
                    <span className="text-[11px] text-ink-muted">| 情绪: {selectedLine.emotion}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-ink-secondary mb-2">角色声线</label>
                <select className="select-field" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                  {VOICE_OPTIONS.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-semibold text-ink-secondary">语速</span>
                  <span className="text-ink-muted">{speed.toFixed(1)}x</span>
                </div>
                <input type="range" className="w-full accent-emerald-500 h-1.5" min="0.5" max="2.0" step="0.1" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
                <div className="flex justify-between text-[10px] text-ink-muted mt-1"><span>慢 0.5x</span><span>正常 1x</span><span>快 2x</span></div>
              </div>

              <div className="mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-semibold text-ink-secondary">音调</span>
                  <span className="text-ink-muted">{pitch > 0 ? '+' : ''}{pitch}</span>
                </div>
                <input type="range" className="w-full accent-emerald-500 h-1.5" min="-12" max="12" step="1" value={pitch} onChange={e => setPitch(Number(e.target.value))} />
                <div className="flex justify-between text-[10px] text-ink-muted mt-1"><span>低 -12</span><span>标准 0</span><span>高 +12</span></div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-semibold text-ink-secondary mb-3">情绪标记</label>
                <div className="flex flex-wrap gap-2">
                  {EMOTION_TAGS.map(emotion => (
                    <button key={emotion} onClick={() => toggleEmotion(emotion)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedEmotions.includes(emotion) ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-base-bg text-ink-secondary border border-border hover:border-emerald-300'}`}>
                      {emotion}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />生成中...
                  </span>
                ) : '🔊 生成配音脚本'}
              </button>

              {error && <div className="mt-4 bg-red-50 rounded-xl p-3 border border-red-200"><p className="text-xs text-red-700">{error}</p></div>}

              {generatedVoice && (
                <div className="mt-6 space-y-4">
                  <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">AI 配音方向</span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">{generatedVoice.voiceDirection}</p>
                  </div>

                  {generatedVoice.tips.length > 0 && (
                    <div className="card-subtle p-4">
                      <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wide mb-2">配音建议</p>
                      <ul className="space-y-1.5">
                        {generatedVoice.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-ink-secondary flex items-start gap-2">
                            <span className="text-emerald-600 flex-shrink-0">•</span>{tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-ink rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">SSML 脚本</p>
                      <span className="text-[10px] text-ink-muted">预计 {generatedVoice.estimatedDuration}s</span>
                    </div>
                    <pre className="text-[10px] text-ink-secondary overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">{generatedVoice.ssml}</pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-5xl mb-3 opacity-30">🎤</div>
                <p className="text-sm text-ink-muted">请从左侧选择一句台词</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-[360px] flex-shrink-0 bg-white p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">已生成配音 ({generatedClips.length})</h3>
          {generatedClips.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2 opacity-40">🎵</div>
              <p className="text-xs text-ink-muted">暂无已生成的配音</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generatedClips.map(clip => (
                <div key={clip.storyboardId} className="card-subtle p-4 hover:bg-emerald-50/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs">▶</div>
                      <div>
                        <p className="text-xs font-semibold text-ink">第{clip.sceneNum}场</p>
                        <p className="text-[10px] text-ink-muted">{clip.estimatedDuration}s · {clip.emotions.join('、') || '默认'}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-ink-secondary mb-2 line-clamp-2">{clip.dialogue}</p>
                  <div className="flex items-end gap-[1px] h-7">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div key={i} className="flex-1 rounded-sm"
                        style={{ height: `${10 + Math.abs(Math.sin(i * 0.3 + clip.sceneNum) * 8 + Math.cos(i * 0.5) * 6)}px`,
                          background: i < 20 ? '#10B981' : '#E4E4E7', opacity: i < 20 ? 1 : 0.4 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
