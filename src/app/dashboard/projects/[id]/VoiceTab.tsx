'use client';
import { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from './ProjectContext';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface DialogueLine {
  id: string;
  sceneNum: number;
  character: string;
  emotion: string;
  text: string;
  status: 'pending' | 'active' | 'done';
}

interface GeneratedClip {
  storyboardId: string;
  sceneNum: number;
  text: string;
  voice: string;
  emotion: string;
}

const EMOTION_TAGS = ['冷静', '愤怒', '悲伤', '喜悦', '恐惧', '惊讶', '厌恶', '温柔'];
const VOICE_OPTIONS = [
  '成熟女声 (沉稳 / 知性)', '青年男声 (磁性 / 低音)', '少女声 (清甜 / 活力)',
  '御姐声 (冷艳 / 气场)', '少年声 (清朗 / 阳光)', '老年声 (沙哑 / 沧桑)',
];

export default function VoiceTab() {
  const { projectId, storyboards, characters } = useProjectContext();
  const [lines, setLines] = useState<DialogueLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0]);
  const [speed, setSpeed] = useState(1.0);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [generatedClips, setGeneratedClips] = useState<GeneratedClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [voicePreview, setVoicePreview] = useState<Array<{
    sceneNum: number;
    character: string;
    voiceType: string;
    emotion: string;
    duration: number;
  }>>([]);

  // 从 storyboards 提取台词
  useEffect(() => {
    setLoading(true);
    const extracted: DialogueLine[] = storyboards
      .filter(sb => sb.dialogue && sb.dialogue.trim())
      .map(sb => ({
        id: sb.id,
        sceneNum: sb.sceneNum,
        character: sb.charactersInScene?.split(',')[0]?.trim() || '旁白',
        emotion: sb.emotion || '中性',
        text: sb.dialogue as string,
        status: generatedClips.some(c => c.storyboardId === sb.id) ? 'done' : 'pending',
      }));
    setLines(extracted);
    if (extracted.length > 0 && !selectedLineId) setSelectedLineId(extracted[0].id);
    setLoading(false);
  }, [storyboards]);

  const selectedLine = lines.find(l => l.id === selectedLineId);

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev =>
      prev.includes(emotion) ? prev.filter(e => e !== emotion) : [...prev, emotion]
    );
  };

  const handleGenerate = () => {
    if (!selectedLine) return;
    setGenerating(true);
    setError('');
    setTimeout(() => {
      const clip: GeneratedClip = {
        storyboardId: selectedLine.id,
        sceneNum: selectedLine.sceneNum,
        text: selectedLine.text,
        voice: selectedVoice,
        emotion: selectedEmotions.join('/') || selectedLine.emotion,
      };
      setGeneratedClips(prev => [clip, ...prev.filter(c => c.storyboardId !== clip.storyboardId)]);
      setLines(prev => prev.map(l => l.id === selectedLine.id ? { ...l, status: 'done' as const } : l));
      setGenerating(false);
    }, 1200);
  };

  // 一键批量配音（智能匹配声线和情绪）
  const handleBatchGenerate = async () => {
    if (!projectId || lines.length === 0) return;
    setBatchGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/voice/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, autoMatch: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '批量配音失败');
        return;
      }
      // 更新已生成列表
      setGeneratedClips(prev => [
        ...prev,
        ...lines.map(line => ({
          storyboardId: line.id,
          sceneNum: line.sceneNum,
          text: line.text,
          voice: '智能匹配',
          emotion: line.emotion,
        })),
      ]);
      setLines(prev => prev.map(l => ({ ...l, status: 'done' as const })));
    } catch (e) {
      setError('批量配音请求失败');
    } finally {
      setBatchGenerating(false);
    }
  };

  // 预览配音匹配结果
  const handlePreview = async () => {
    if (!projectId) return;
    setShowPreview(true);
    try {
      const res = await fetch(`/api/voice/batch-generate?projectId=${projectId}`);
      const data = await res.json();
      if (data.preview) setVoicePreview(data.preview);
    } catch (e) {
      // 使用本地计算
      const preview = lines.map(line => {
        const char = characters.find(c => c.name === line.character);
        const gender = char?.gender?.toLowerCase() || 'male';
        const ageNum = char?.age ? (typeof char.age === 'string' ? parseInt(char.age, 10) : char.age) : 25;
        const age = ageNum || 25;
        let voiceType = gender === 'female' ? 'female_1' : 'male_1';
        if (age < 12) voiceType = gender === 'female' ? 'child_girl' : 'child_boy';
        else if (age > 60) voiceType = gender === 'female' ? 'elder_female' : 'elder_male';
        else if (age < 25) voiceType = gender === 'female' ? 'female_young' : 'male_young';
        const duration = Math.ceil(line.text.length / 3.5);
        return {
          sceneNum: line.sceneNum,
          character: line.character,
          voiceType,
          emotion: line.emotion,
          duration: Math.max(2, Math.min(duration, 30)),
        };
      });
      setVoicePreview(preview);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="角色配音" subtitle="为分镜台词配置语音与情绪" icon="🎙️" />

      {/* 智能配音工具栏 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="emerald">{lines.length} 条台词</Badge>
          <Badge variant="sky">{generatedClips.length} 已生成</Badge>
          <Badge variant="zinc">{lines.filter(l => l.status === 'pending').length} 待生成</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePreview}
            className="btn-secondary px-3 py-1.5 text-xs">
            👁️ 预览匹配
          </button>
          <button onClick={handleBatchGenerate}
            disabled={batchGenerating || lines.length === 0}
            className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
            {batchGenerating ? '⏳ 批量生成中...' : '✨ 一键批量配音'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 台词列表 */}
        <div className="lg:col-span-4">
          <Card variant="default" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">台词列表</h3>
              <Badge variant="emerald">{lines.length} 条</Badge>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : lines.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-2 opacity-40">🎤</div>
                <p className="text-xs text-ink-muted">暂无台词数据</p>
                <p className="text-[10px] text-ink-muted mt-1">请先在「分镜」Tab 中为分镜添加台词</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {lines.map(line => (
                  <button key={line.id} onClick={() => setSelectedLineId(line.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedLineId === line.id ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-ink">第{line.sceneNum}场 · {line.character}</span>
                      {line.status === 'done' ? (
                        <Badge variant="emerald">已生成</Badge>
                      ) : (
                        <Badge variant="zinc">待生成</Badge>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted line-clamp-2">{line.text}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 配音配置 */}
        <div className="lg:col-span-5">
          <Card variant="default" className="p-5">
            {selectedLine ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-ink mb-2">当前台词</h3>
                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-sm text-ink italic">"{selectedLine.text}"</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
                      <span>角色: {selectedLine.character}</span>
                      <span>情绪: {selectedLine.emotion}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-ink-secondary mb-2">角色声线</label>
                  <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white">
                    {VOICE_OPTIONS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-semibold text-ink-secondary">语速</span>
                    <span className="text-ink-muted">{speed.toFixed(1)}x</span>
                  </div>
                  <input type="range" className="w-full accent-emerald-500" min="0.5" max="2.0" step="0.1"
                    value={speed} onChange={e => setSpeed(Number(e.target.value))} />
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-ink-secondary mb-2">情绪标记</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOTION_TAGS.map(tag => (
                      <button key={tag} onClick={() => toggleEmotion(tag)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                          selectedEmotions.includes(tag) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-ink-secondary border-border hover:border-emerald-300'
                        }`}>{tag}</button>
                    ))}
                  </div>
                </div>

                <button onClick={handleGenerate} disabled={generating}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {generating ? '🎬 生成中...' : '🔊 生成配音'}
                </button>

                {error && <div className="mt-3 bg-red-50 rounded-lg p-3 border border-red-200 text-xs text-red-700">{error}</div>}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="text-5xl mb-3 opacity-30">🎤</div>
                <p className="text-sm text-ink-muted">请从左侧选择一句台词</p>
              </div>
            )}
          </Card>
        </div>

        {/* 已生成配音 */}
        <div className="lg:col-span-3">
          <Card variant="default" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">已生成</h3>
              <Badge variant="emerald">{generatedClips.length}</Badge>
            </div>
            {generatedClips.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-2 opacity-40">🎵</div>
                <p className="text-xs text-ink-muted">暂无配音</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {generatedClips.map(clip => (
                  <div key={clip.storyboardId} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white text-xs">▶</div>
                      <div>
                        <p className="text-xs font-semibold text-ink">第{clip.sceneNum}场</p>
                        <p className="text-[10px] text-ink-muted">{clip.voice}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-ink-muted line-clamp-2">{clip.text}</p>
                    <div className="flex items-end gap-[1px] h-5 mt-2">
                      {Array.from({length: 40}).map((_, i) => (
                        <div key={i} className="flex-1 rounded-sm"
                          style={{height: `${5 + Math.abs(Math.sin(i * 0.3 + clip.sceneNum) * 14)}px`, background: clip.emotion.includes(i % 3 === 0 ? '怒' : clip.emotion) ? '#10B981' : '#A7F3D0'}} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 预览配音匹配弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">👁️ 配音匹配预览</h2>
              <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">AI 根据角色属性自动推荐声线和情绪</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {voicePreview.map(p => (
                <div key={p.sceneNum} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-semibold text-ink w-12">#{p.sceneNum}</span>
                  <span className="text-xs text-ink-muted w-16">{p.character}</span>
                  <span className="text-xs text-emerald-600 font-medium">{p.voiceType}</span>
                  <span className="text-xs text-ink-secondary">{p.emotion}</span>
                  <span className="text-xs text-ink-muted font-mono">{p.duration}s</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t border-border">
              <button onClick={() => { setShowPreview(false); handleBatchGenerate(); }}
                className="btn-primary flex-1 py-2 text-sm">
                ✨ 确认并生成
              </button>
              <button onClick={() => setShowPreview(false)}
                className="btn-secondary flex-1 py-2 text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
