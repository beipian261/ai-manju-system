'use client';

import { useState, useEffect, useCallback } from 'react';

interface SceneItem {
  id?: string;
  title: string;
  sceneNumber: number;
  description: string;
  emotion: string;
  cameraAngle: string;
  location: string;
  timeOfDay: string;
  characters?: string[];
  dialogue?: string;
  imageUrl?: string;
  imageUrls?: string[];
}

interface ScenePreviewProps {
  scriptContent: string;
  scriptId: string;
  projectId: string;
  onClose: () => void;
  onGenerate: (orderedScenes: SceneItem[]) => void;
}

const EMOTION_COLORS: Record<string, string> = {
  comedic: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cheerful: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  tense: 'bg-red-500/15 text-red-300 border-red-500/30',
  dramatic: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  melancholy: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  mysterious: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  epic: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  peaceful: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  romantic: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  action: 'bg-red-500/20 text-red-200 border-red-500/40',
  hopeful: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
  horror: 'bg-slate-600/40 text-slate-200 border-slate-500/40',
  intimate: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  magical: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

export default function ScenePreview({ scriptContent, scriptId, projectId, onClose, onGenerate }: ScenePreviewProps) {
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());

  // 解析剧本 JSON，提取场景列表
  const parseScript = useCallback((content: string): SceneItem[] => {
    try {
      const parsed = JSON.parse(content);
      let allScenes: SceneItem[] = [];

      if (Array.isArray(parsed.acts)) {
        for (const act of parsed.acts) {
          if (Array.isArray(act.scenes)) {
            allScenes.push(...act.scenes.map((s: Record<string, unknown>) => ({ ...s, actName: act.name })));
          }
        }
      } else if (Array.isArray(parsed.scenes)) {
        allScenes = parsed.scenes;
      }

      return allScenes.map((s, i) => ({
        ...s,
        sceneNumber: i + 1,
      }));
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const parsed = parseScript(scriptContent);
    setScenes(parsed);
    setSelectedScenes(new Set(parsed.map((_, i) => i)));
    setLoading(false);
  }, [scriptContent, parseScript]);

  const moveScene = (from: number, to: number) => {
    if (to < 0 || to >= scenes.length) return;
    const updated = [...scenes];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setScenes(updated.map((s, i) => ({ ...s, sceneNumber: i + 1 })));
  };

  const deleteScene = (index: number) => {
    const updated = scenes.filter((_, i) => i !== index);
    setScenes(updated.map((s, i) => ({ ...s, sceneNumber: i + 1 })));
    setSelectedScenes((prev) => {
      const next = new Set<number>();
      prev.forEach((v) => {
        if (v < index) next.add(v);
        else if (v > index) next.add(v - 1);
      });
      return next;
    });
  };

  const toggleSelect = (index: number) => {
    setSelectedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleGenerate = () => {
    const ordered = scenes.filter((_, i) => selectedScenes.has(i));
    onGenerate(ordered);
  };

  const emotionColor = (emotion: string) =>
    EMOTION_COLORS[emotion?.toLowerCase()] || 'bg-ink-700/40 text-ink-300 border-ink-600';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="card p-8 text-center">
          <div className="w-8 h-8 border-2 border-ink-600 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink-300">解析剧本中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">场景预览 & 调整</h2>
            <p className="text-sm text-ink-400 mt-0.5">
              共 {scenes.length} 场，已选 {selectedScenes.size} 场（拖拽或用箭头调整顺序）
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-ink-400 hover:text-white font-medium rounded-lg hover:bg-ink-800 transition"
            >
              取消
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedScenes.size === 0}
              className="btn-primary text-sm"
            >
              生成选中分镜图 ({selectedScenes.size} 场)
            </button>
          </div>
        </div>

        {/* Scene List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          {scenes.length === 0 ? (
            <div className="text-center py-12 text-ink-400">
              <p>无法解析剧本内容，请检查剧本格式是否正确</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-4 transition-all ${
                    selectedScenes.has(index)
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : 'border-ink-700/50 bg-ink-800/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 序号 + 选择框 */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedScenes.has(index)}
                        onChange={() => toggleSelect(index)}
                        className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-ink-500 w-6 text-center">
                        {index + 1}
                      </span>
                    </div>

                    {/* 场景信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink-100">{scene.title || `场景 ${index + 1}`}</h3>
                        {scene.emotion && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${emotionColor(scene.emotion)}`}>
                            {scene.emotion}
                          </span>
                        )}
                        {scene.cameraAngle && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-ink-700/60 text-ink-300 border border-ink-600">
                            📷 {scene.cameraAngle}
                          </span>
                        )}
                        {scene.location && (
                          <span className="text-xs text-ink-400 truncate max-w-xs">📍 {scene.location}</span>
                        )}
                      </div>
                      <p className="text-sm text-ink-300 mt-1 line-clamp-2">{scene.description}</p>
                      {scene.dialogue && (
                        <p className="text-xs text-ink-400 mt-1 italic line-clamp-1">💬 {scene.dialogue}</p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => moveScene(index, index - 1)}
                        disabled={index === 0}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed text-ink-400 transition"
                        title="上移"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveScene(index, index + 1)}
                        disabled={index === scenes.length - 1}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed text-ink-400 transition"
                        title="下移"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => deleteScene(index)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/20 text-red-400 transition"
                        title="删除"
                      >
                        ✕
                      </button>
                    </div>
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
