// StoryboardTab — 分镜编辑器（专业三栏式布局）
// 左栏：分镜列表 | 中栏：大图预览 | 右栏：参数编辑
'use client';
import { useState, useCallback, useRef } from 'react';
import { useProjectContext } from './ProjectContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import ImageGallery from '@/components/features/ImageGallery';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import type { Storyboard } from './types';

const CAMERA_ANGLES = ['远景', '全景', '中景', '中近景', '近景', '特写', '大特写', '仰视', '俯视', '平视', '侧拍', '跟拍'];
const EMOTIONS = ['平静', '喜悦', '悲伤', '愤怒', '恐惧', '惊讶', '厌恶', '冷漠', '兴奋', '紧张', '温柔', '冷酷'];

export default function StoryboardTab() {
  const {
    storyboards, characters, scripts,
    selectedStoryboards, toggleStoryboardSelection, toggleSelectAllStoryboards,
    batchGeneratingImages, batchGenerateImages,
    batchGenerateVideos, batchGeneratingVideos, batchDeleteStoryboards,
    generateStoryboards, generatingStoryboard, generateImage,
    updateStoryboard, deleteStoryboard, reorderStoryboards,
  } = useProjectContext();
  const { showConfirm, dialog: confirmDialog } = useConfirmDialog();

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>('');
  const [editDesc, setEditDesc] = useState('');
  const [editDialogue, setEditDialogue] = useState('');
  const [editEmotion, setEditEmotion] = useState('');
  const [editCamera, setEditCamera] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [showSmartGen, setShowSmartGen] = useState(false);
  const [smartMode, setSmartMode] = useState<'template' | 'auto' | 'manual'>('template');
  const [smartHint, setSmartHint] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('emotional');
  const [templates, setTemplates] = useState<Array<{key: string; name: string; description: string; tips: string[]}>>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/storyboards/generate-with-template');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (e) {
      // 使用默认模板
      setTemplates([
        { key: 'emotional', name: '情感冲突', description: '适合情感激烈的场景', tips: ['多用近景和特写'] },
        { key: 'action', name: '动作场景', description: '适合打斗、追逐等动态场景', tips: ['远景展示空间'] },
        { key: 'dialogue', name: '对话场景', description: '适合角色对话、谈判等静态场景', tips: ['中景展示两人'] },
        { key: 'romance', name: '浪漫场景', description: '适合爱情、温馨等柔和场景', tips: ['多用柔光'] },
        { key: 'horror', name: '恐怖悬疑', description: '适合惊悚、悬疑等紧张场景', tips: ['阴影营造氛围'] },
        { key: 'comedy', name: '喜剧场景', description: '适合搞笑、轻松等娱乐场景', tips: ['表情特写增强笑点'] },
      ]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const hasStoryboards = storyboards.length > 0;
  const storyboardsWithImage = storyboards.filter(s => s.imageUrls).length;
  const storyboardsWithVideo = storyboards.filter(s => s.videoUrl).length;
  const completedScripts = scripts.filter(s => s.status === 'completed');

  // 默认选中第一个
  const allSB = [...storyboards].sort((a, b) => a.sceneNum - b.sceneNum);
  const activeSB = allSB.find(sb => sb.id === selectedId) || allSB[0] || null;

  // 选中分镜时同步编辑表单
  const selectSB = useCallback((sb: Storyboard) => {
    setSelectedId(sb.id);
    setEditDesc(sb.description || '');
    setEditDialogue(sb.dialogue || '');
    setEditEmotion(sb.emotion || '');
    setEditCamera(sb.cameraAngle || '');
    setEditPrompt(sb.imagePrompt || '');
  }, []);

  // 拖拽排序处理
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, overId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(overId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragIdRef.current;
    setDragOverId(null);
    dragIdRef.current = null;

    if (!sourceId || sourceId === targetId) return;

    const newOrder = [...allSB];
    const sourceIdx = newOrder.findIndex(s => s.id === sourceId);
    const targetIdx = newOrder.findIndex(s => s.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [removed] = newOrder.splice(sourceIdx, 1);
    newOrder.splice(targetIdx, 0, removed);

    reorderStoryboards(newOrder.map(s => s.id));
  }, [allSB, reorderStoryboards]);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDragOverId(null);
  }, []);

  // 保存编辑
  const handleSave = async () => {
    if (!activeSB) return;
    await updateStoryboard(activeSB.id, {
      description: editDesc,
      dialogue: editDialogue,
      emotion: editEmotion || undefined,
      cameraAngle: editCamera || undefined,
      imagePrompt: editPrompt || undefined,
    });
  };

  // 单个生成图片
  const handleGenImage = async () => {
    if (!activeSB) return;
    const prompt = editPrompt || activeSB.description || `故事分镜 ${activeSB.sceneNum}`;
    setGenerating(activeSB.id);
    try {
      await generateImage(activeSB.id, prompt);
    } finally {
      setGenerating(null);
    }
  };

  // 批量生成全部图片
  const handleGenAllImages = async () => {
    const idsWithoutImage = allSB.filter(sb => !sb.imageUrls).map(sb => sb.id);
    if (idsWithoutImage.length === 0) {
      alert('所有分镜都已生成图片');
      return;
    }
    setGeneratingAll(true);
    // 异步执行，不等待完成（API 会通过 SSE 推送进度）
    batchGenerateImages(idsWithoutImage).finally(() => {
      // 进度完成后再取消 loading 状态
    });
  };

  // 智能生成分镜
  const handleSmartGen = async () => {
    if (completedScripts.length === 0) return;
    setGeneratingAll(true);
    try {
      await generateStoryboards(completedScripts[0].id);
    } finally {
      setGeneratingAll(false);
      setShowSmartGen(false);
    }
  };

  // 解析图片URL
  const firstImageUrl = (() => {
    if (!activeSB?.imageUrls) return null;
    try {
      const parsed = JSON.parse(activeSB.imageUrls);
      return Array.isArray(parsed) ? parsed[0] : String(activeSB.imageUrls);
    } catch {
      return String(activeSB.imageUrls);
    }
  })();

  const hasImage = !!firstImageUrl;
  const hasVideo = !!activeSB?.videoUrl;

  return (
    <div className="animate-fade-in">
      {/* 无分镜时：生成入口 */}
      {!hasStoryboards && (
        <div className="max-w-lg mx-auto">
          <Card variant="default" className="text-center py-16 border border-emerald-100">
            <div className="text-6xl mb-4 opacity-50">🎬</div>
            <h3 className="text-xl font-semibold text-ink mb-2">暂无分镜</h3>
            <p className="text-sm text-ink-muted mb-6">
              {completedScripts.length > 0 ? '点击下方按钮，让 AI 从已有剧本中提取分镜' : '请先生成剧本，然后自动提取分镜'}
            </p>
            {completedScripts.length > 0 ? (
              <div className="space-y-3">
                <Button onClick={() => setShowSmartGen(true)} loading={!!generatingStoryboard}>
                  ✨ AI 智能分镜
                </Button>
                <p className="text-xs text-ink-muted">自动将剧本拆解为专业分镜</p>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">前往「剧本」Tab 生成</p>
            )}
          </Card>
        </div>
      )}

      {/* 三栏编辑器 */}
      {hasStoryboards && (
        <div>
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                <input type="checkbox"
                  checked={selectedStoryboards.size === allSB.length && allSB.length > 0}
                  onChange={toggleSelectAllStoryboards}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                全选 ({selectedStoryboards.size}/{allSB.length})
              </label>
              
              {/* 快速选择按钮组 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    allSB.filter(s => !s.imageUrls).forEach(s => {
                      if (!selectedStoryboards.has(s.id)) toggleStoryboardSelection(s.id);
                    });
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-ink-muted transition-colors"
                  title="选择所有没有图片的分镜"
                >
                  选无图
                </button>
                <button
                  onClick={() => {
                    allSB.filter(s => s.imageUrls).forEach(s => {
                      if (!selectedStoryboards.has(s.id)) toggleStoryboardSelection(s.id);
                    });
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-ink-muted transition-colors"
                  title="选择所有有图片的分镜"
                >
                  选有图
                </button>
                <button
                  onClick={() => {
                    allSB.forEach(s => toggleStoryboardSelection(s.id));
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-ink-muted transition-colors"
                  title="反选"
                >
                  反选
                </button>
                <button
                  onClick={() => {
                    selectedStoryboards.forEach(id => toggleStoryboardSelection(id));
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-ink-muted transition-colors"
                  title="清除选择"
                >
                  清空
                </button>
              </div>

              <div className="h-4 w-px bg-border" />
              <div className="flex gap-2">
                <Badge variant="emerald">{storyboardsWithImage}/{allSB.length} 图</Badge>
                <Badge variant="sky">{storyboardsWithVideo} 视频</Badge>
                <Badge variant="amber">
                  {allSB.filter(s => !s.imageUrls).length} 待生成
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {storyboardsWithImage > 0 && (
                <Button size="sm" variant="secondary" onClick={() => { setGalleryOpen(true); setGalleryIndex(0); }}>
                  🖼️ 全屏浏览
                </Button>
              )}

              {/* 断点续生成 - 一键生成所有缺失图片 */}
              {storyboardsWithImage < allSB.length && (
                <Button size="sm" variant="secondary" onClick={handleGenAllImages} loading={generatingAll || !!batchGeneratingImages}>
                  ⚡ 续生成缺图 ({allSB.length - storyboardsWithImage})
                </Button>
              )}

              {/* 选中时的批量操作 */}
              {selectedStoryboards.size > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <Button size="sm" variant="secondary"
                    onClick={() => batchGenerateImages(Array.from(selectedStoryboards))}
                    loading={!!batchGeneratingImages}>
                    🖼️ 重生成图片 ({selectedStoryboards.size})
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => batchGenerateVideos(Array.from(selectedStoryboards))}
                    loading={!!batchGeneratingVideos}>
                    🎬 批量视频 ({selectedStoryboards.size})
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={async () => {
                      const ids = Array.from(selectedStoryboards);
                      for (const id of ids) {
                        await updateStoryboard(id, { reviewStatus: 'approved' });
                      }
                    }}>
                    ✅ 通过 ({selectedStoryboards.size})
                  </Button>
                  <Button size="sm" variant="danger"
                    onClick={async () => {
                      if (await showConfirm('批量删除分镜', `确定要删除选中的 ${selectedStoryboards.size} 个分镜吗？`)) {
                        batchDeleteStoryboards(Array.from(selectedStoryboards));
                      }
                    }}>
                    🗑️ 删除 ({selectedStoryboards.size})
                  </Button>
                </>
              )}

              {/* 全部重新生成 */}
              {storyboardsWithImage === allSB.length && allSB.length > 0 && (
                <Button size="sm" variant="primary"
                  onClick={async () => {
                    if (await showConfirm('全部重新生成', `确定要重新生成所有 ${allSB.length} 个分镜的图片吗？已有图片将被覆盖。`)) {
                      batchGenerateImages(allSB.map(s => s.id));
                    }
                  }}
                  loading={!!batchGeneratingImages}>
                  🔄 全部重生成
                </Button>
              )}
            </div>
          </div>

          {/* 批量操作浮动提示 - 当有选中项时显示 */}
          {selectedStoryboards.size > 0 && (
            <div className="sticky top-0 z-20 mb-4 -mx-2 px-2 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 text-sm font-medium">
                  ✅ 已选择 {selectedStoryboards.size} 个分镜
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ids = Array.from(selectedStoryboards);
                    ids.forEach(id => updateStoryboard(id, { reviewStatus: 'approved' }));
                  }}
                  className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  全部审核通过
                </button>
                <button
                  onClick={() => batchGenerateImages(Array.from(selectedStoryboards))}
                  className="px-3 py-1.5 text-xs bg-white border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  重生成图片
                </button>
                <button
                  onClick={async () => {
                    if (await showConfirm('删除', `确定删除选中的 ${selectedStoryboards.size} 个分镜？`)) {
                      batchDeleteStoryboards(Array.from(selectedStoryboards));
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          )}

          {/* 三栏主体 */}
          <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
            {/* 左栏：分镜列表 */}
            <div className="col-span-3 flex flex-col">
              <Card variant="default" className="flex-1 p-3 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">分镜列表</h3>
                  <Badge variant="zinc">{allSB.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {allSB.map((sb, idx) => {
                    const sbImage = sb.imageUrls ? (() => {
                      try { return JSON.parse(sb.imageUrls as string)[0]; } catch { return String(sb.imageUrls); }
                    })() : null;
                    const isActive = activeSB?.id === sb.id;
                    const isSelected = selectedStoryboards.has(sb.id);
                    const isDragging = dragIdRef.current === sb.id;
                    const isDragOver = dragOverId === sb.id;
                    return (
                      <div
                        key={sb.id}
                        className={`flex items-center gap-2 transition-all ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-t-2 border-emerald-500 pt-1.5' : ''}`}
                        onDragOver={(e) => handleDragOver(e, sb.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, sb.id)}
                      >
                        {/* 复选框 */}
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleStoryboardSelection(sb.id)}
                          className="w-3.5 h-3.5 rounded accent-emerald-500 flex-shrink-0 cursor-pointer" />
                        {/* 分镜项 */}
                        <button
                          draggable
                          onDragStart={(e) => handleDragStart(e, sb.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => selectSB(sb)}
                          className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-left transition-all cursor-grab active:cursor-grabbing ${
                            isActive
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          {/* 拖拽手柄图标 */}
                          <span className="text-gray-400 text-xs select-none">⋮⋮</span>
                          {/* 缩略图 */}
                          <div className="w-10 h-7 rounded overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                            {sbImage ? (
                              <img src={sbImage} alt="" className="w-full h-full object-cover pointer-events-none" />
                            ) : (
                              <span className="text-[10px] opacity-40">🎬</span>
                            )}
                          </div>
                          {/* 信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-ink">#{sb.sceneNum}</span>
                              {sb.imageUrls && <span className="text-[9px]">🖼️</span>}
                              {sb.videoUrl && <span className="text-[9px]">🎬</span>}
                            </div>
                            <p className="text-[9px] text-ink-muted truncate leading-tight mt-0.5">
                              {sb.description?.substring(0, 18) || '待编辑'}
                            </p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* 中栏：大图预览 */}
            <div className="col-span-5 flex flex-col">
              <Card variant="default" className="flex-1 p-4 flex flex-col overflow-hidden">
                {activeSB ? (
                  <>
                    {/* 预览区 */}
                    <div className="flex-1 relative bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]">
                      {hasImage ? (
                        <img src={firstImageUrl!} alt={`分镜 ${activeSB.sceneNum}`}
                          className="w-full h-full object-contain cursor-pointer"
                          onClick={() => { setGalleryOpen(true); setGalleryIndex(allSB.findIndex(s => s.id === activeSB.id)); }} />
                      ) : hasVideo ? (
                        <video src={activeSB.videoUrl!} className="w-full h-full object-contain" controls />
                      ) : (
                        <div className="text-center text-ink-muted">
                          <div className="text-5xl mb-3 opacity-30">🎬</div>
                          <p className="text-sm">第 {activeSB.sceneNum} 场 · 暂无素材</p>
                          <p className="text-xs mt-1 opacity-60">点击「生成图片」创建画面</p>
                        </div>
                      )}
                      {/* 播放按钮叠加 */}
                      {hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center text-xl shadow-lg">▶</div>
                        </div>
                      )}
                      {/* 场景编号 */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 text-white text-xs font-bold rounded-lg backdrop-blur-sm">
                        #{activeSB.sceneNum}
                      </div>
                      {/* 状态标签 */}
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        {hasImage && <span className="px-2 py-1 bg-black/60 text-white text-[10px] rounded-md backdrop-blur-sm">🖼️</span>}
                        {hasVideo && <span className="px-2 py-1 bg-black/60 text-white text-[10px] rounded-md backdrop-blur-sm">🎬</span>}
                      </div>
                    </div>

                    {/* 播放控制栏 */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                      <Button size="sm" variant="secondary" onClick={handleGenImage}
                        loading={generating === activeSB.id || !!generatingAll}
                        disabled={!!generatingAll}>
                        🖼️ {hasImage ? '重新生成' : '生成图片'}
                      </Button>
                      {hasImage && !hasVideo && (
                        <Button size="sm" variant="secondary">
                          🎬 生成视频
                        </Button>
                      )}
                      <div className="flex-1" />
                      <span className="text-xs text-ink-muted font-mono">
                        {activeSB.duration ?? 5}s
                      </span>
                      {activeSB.emotion && (
                        <Badge variant="sky">{activeSB.emotion}</Badge>
                      )}
                      {activeSB.cameraAngle && (
                        <Badge variant="zinc">{activeSB.cameraAngle}</Badge>
                      )}
                    </div>

                    {/* 描述展示 */}
                    {activeSB.description && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs text-ink-secondary leading-relaxed">{activeSB.description}</p>
                        {activeSB.dialogue && (
                          <p className="text-xs text-ink-muted italic mt-2 pt-2 border-t border-border">
                            「{activeSB.dialogue}」
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-ink-muted">
                    <div className="text-center">
                      <div className="text-5xl mb-3 opacity-30">👈</div>
                      <p className="text-sm">从左侧选择一个分镜</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* 右栏：参数编辑 */}
            <div className="col-span-4 flex flex-col">
              <Card variant="default" className="flex-1 p-4 overflow-y-auto">
                {activeSB ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-ink">片段参数</h3>
                      <Badge variant="emerald">#{activeSB.sceneNum}</Badge>
                    </div>

                    {/* 描述 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1.5">分镜描述</label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white resize-none focus:border-emerald-500 focus:outline-none"
                        rows={4}
                        placeholder="描述这个场景的画面内容..."
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                      />
                    </div>

                    {/* 镜头角度 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1.5">镜头角度</label>
                      <select
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:border-emerald-500 focus:outline-none"
                        value={editCamera}
                        onChange={e => setEditCamera(e.target.value)}
                      >
                        <option value="">默认</option>
                        {CAMERA_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>

                    {/* 情绪 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1.5">情绪</label>
                      <div className="flex flex-wrap gap-1.5">
                        {EMOTIONS.map(em => (
                          <button key={em} onClick={() => setEditEmotion(em)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                              editEmotion === em
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-ink-secondary border-border hover:border-emerald-300'
                            }`}>{em}</button>
                        ))}
                      </div>
                    </div>

                    {/* 台词 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1.5">角色台词</label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white resize-none focus:border-emerald-500 focus:outline-none"
                        rows={3}
                        placeholder="输入角色对话..."
                        value={editDialogue}
                        onChange={e => setEditDialogue(e.target.value)}
                      />
                    </div>

                    {/* 图片提示词 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-1.5">图片生成提示词</label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white resize-none focus:border-emerald-500 focus:outline-none"
                        rows={3}
                        placeholder="AI 图片生成提示词，留空则自动使用分镜描述"
                        value={editPrompt}
                        onChange={e => setEditPrompt(e.target.value)}
                      />
                    </div>

                    {/* 保存按钮 */}
                    <Button onClick={handleSave} className="w-full">
                      💾 保存修改
                    </Button>

                    {/* 删除 */}
                    <button
                      onClick={async () => {
                        if (await showConfirm('删除分镜', `删除第 ${activeSB.sceneNum} 场？`)) {
                          await deleteStoryboard(activeSB.id);
                        }
                      }}
                      className="w-full py-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      🗑️ 删除此分镜
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-ink-muted">
                    <div className="text-center">
                      <div className="text-4xl mb-2 opacity-30">⚙️</div>
                      <p className="text-xs">选择分镜以编辑参数</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Gallery */}
      {galleryOpen && (
        <ImageGallery
          images={allSB.filter(s => s.imageUrls).map(s => ({
            id: s.id,
            url: (() => { try { return JSON.parse(s.imageUrls as string)[0]; } catch { return String(s.imageUrls); } })(),
            sceneNum: s.sceneNum,
            description: s.description,
            qualityScore: s.qualityScore,
          }))}
          initialIndex={galleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {/* 智能生成分镜弹窗 */}
      {showSmartGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowSmartGen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-ink">✨ 智能分镜生成</h2>
                <p className="text-xs text-ink-muted mt-0.5">AI 自动将剧本拆解为专业分镜序列</p>
              </div>
              <button onClick={() => setShowSmartGen(false)} className="w-8 h-8 rounded-lg hover:bg-base-bg flex items-center justify-center text-ink-muted transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* 模式选择 */}
              <div className="flex gap-2">
                <button onClick={() => setSmartMode('template')}
                  className={`flex-1 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                    smartMode === 'template'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-border hover:border-emerald-200'
                  }`}>
                  🎨 模板分镜
                </button>
                <button onClick={() => setSmartMode('auto')}
                  className={`flex-1 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                    smartMode === 'auto'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-border hover:border-emerald-200'
                  }`}>
                  🤖 智能分镜
                </button>
                <button onClick={() => setSmartMode('manual')}
                  className={`flex-1 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                    smartMode === 'manual'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-border hover:border-emerald-200'
                  }`}>
                  ✏️ 自定义
                </button>
              </div>

              {/* 模板选择 */}
              {smartMode === 'template' && (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-2">选择分镜模板风格</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(templates.length > 0 ? templates : [
                      { key: 'emotional', name: '情感冲突', description: '适合情感激烈的场景', tips: ['多用近景和特写'] },
                      { key: 'action', name: '动作场景', description: '适合打斗、追逐等动态场景', tips: ['远景展示空间'] },
                      { key: 'dialogue', name: '对话场景', description: '适合角色对话、谈判等静态场景', tips: ['中景展示两人'] },
                      { key: 'romance', name: '浪漫场景', description: '适合爱情、温馨等柔和场景', tips: ['多用柔光'] },
                      { key: 'horror', name: '恐怖悬疑', description: '适合惊悚、悬疑等紧张场景', tips: ['阴影营造氛围'] },
                      { key: 'comedy', name: '喜剧场景', description: '适合搞笑、轻松等娱乐场景', tips: ['表情特写增强笑点'] },
                    ]).map(tpl => (
                      <button key={tpl.key} onClick={() => setSelectedTemplate(tpl.key)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          selectedTemplate === tpl.key
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-border hover:border-emerald-200'
                        }`}>
                        <p className="text-sm font-semibold text-ink">{tpl.name}</p>
                        <p className="text-[10px] text-ink-muted mt-0.5 line-clamp-2">{tpl.description}</p>
                        {selectedTemplate === tpl.key && tpl.tips && (
                          <div className="mt-1.5 pt-1.5 border-t border-emerald-200">
                            <p className="text-[9px] text-emerald-600">💡 {tpl.tips[0]}</p>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 智能分镜提示 */}
              {smartMode === 'auto' && (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1.5">分镜提示（可选）</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white resize-none focus:border-emerald-500 focus:outline-none"
                    rows={3}
                    placeholder="例如：重点突出情感冲突，添加更多近景和特写"
                    value={smartHint}
                    onChange={e => setSmartHint(e.target.value)}
                  />
                </div>
              )}

              {/* 自定义分镜 */}
              {smartMode === 'manual' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1.5">预计分镜数量</label>
                    <input type="number" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:border-emerald-500 focus:outline-none"
                      placeholder="例如：12" defaultValue={10} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1.5">镜头风格偏好</label>
                    <select className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:border-emerald-500 focus:outline-none">
                      <option value="mixed">混合镜头</option>
                      <option value="close-up">多用特写</option>
                      <option value="wide">多用远景</option>
                      <option value="medium">多用中景</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-border">
                <Button onClick={handleSmartGen} loading={!!generatingStoryboard} className="flex-1">
                  ✨ 开始生成
                </Button>
                <Button variant="secondary" onClick={() => setShowSmartGen(false)} className="flex-1">
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
