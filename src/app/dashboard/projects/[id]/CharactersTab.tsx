'use client';
// CharactersTab — 角色管理
// 纯白极简主题
import { useState, useEffect } from 'react';
import { useProjectContext } from './ProjectContext';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import type { Character } from './types';
import type { ConsistencyIssue } from '@/types';

const EMPTY_FORM = {
  name: '', age: '', gender: '', personality: '',
  clothing: '', appearance: '', hair: '', eyes: '', build: '',
};

export default function CharactersTab() {
  const { project, characters, scripts, createCharacter, updateCharacter, deleteCharacter, generatingCharacterImages, loadData } = useProjectContext();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showExtract, setShowExtract] = useState(false);
  const [extractHint, setExtractHint] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [showAIGen, setShowAIGen] = useState(false);
  const [aiName, setAiName] = useState('');
  const [aiHint, setAiHint] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatingPortraits, setGeneratingPortraits] = useState(false);
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [showConsistency, setShowConsistency] = useState(false);
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);
  const [checkingConsistency, setCheckingConsistency] = useState(false);
  const { showConfirm, dialog: confirmDialog } = useConfirmDialog();
  
  // 智能角色提取状态
  const [detectingCharacters, setDetectingCharacters] = useState(false);
  const [detectedCharacters, setDetectedCharacters] = useState<string[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [extractedCount, setExtractedCount] = useState(0);

  // 批量删除状态
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);

  // 切换单个角色选择
  function toggleSelectForDelete(id: string) {
    setSelectedForDelete(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }

  // 全选/取消全选
  function toggleSelectAll() {
    if (selectedForDelete.length === characters.length) {
      setSelectedForDelete([]);
    } else {
      setSelectedForDelete(characters.map(c => c.id));
    }
  }

  // 批量删除角色
  async function handleBatchDelete() {
    if (selectedForDelete.length === 0) return;
    if (!(await showConfirm('批量删除角色', `确定要删除选中的 ${selectedForDelete.length} 个角色吗？`))) return;
    
    try {
      const res = await fetch('/api/characters/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedForDelete }),
      });
      if (res.ok) {
        await loadData();
        setSelectedForDelete([]);
      } else {
        alert('删除失败');
      }
    } catch {
      alert('网络错误');
    }
  }

  // 打开弹窗时自动检测角色
  useEffect(() => {
    if (showExtract && completedScripts.length > 0) {
      detectCharactersFromScript();
    }
  }, [showExtract]);

  // 从剧本检测角色（仅检测，不生成）
  async function detectCharactersFromScript() {
    if (!project || completedScripts.length === 0) return;
    setDetectingCharacters(true);
    try {
      const res = await fetch('/api/characters/extract-from-script/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: completedScripts[0].id,
          projectId: project.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.characters && data.characters.length > 0) {
        setDetectedCharacters(data.characters);
        setSelectedCharacters([...data.characters]);
      } else {
        setDetectedCharacters([]);
        setSelectedCharacters([]);
      }
    } catch {
      setDetectedCharacters([]);
      setSelectedCharacters([]);
    }
    setDetectingCharacters(false);
  }

  // 切换角色选择
  function toggleCharacterSelection(name: string) {
    setSelectedCharacters(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  }

  // 全选/取消全选
  function toggleAllSelection() {
    if (selectedCharacters.length === detectedCharacters.length) {
      setSelectedCharacters([]);
    } else {
      setSelectedCharacters([...detectedCharacters]);
    }
  }

  // 生成选中的角色
  async function handleExtractSelected() {
    if (!project || selectedCharacters.length === 0) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/characters/extract-from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: completedScripts[0].id,
          projectId: project.id,
          hint: extractHint.trim() || undefined,
          selectedNames: selectedCharacters,
        }),
      });
      const data = await res.json();
      if (res.ok && data.created && data.created > 0) {
        setExtractedCount(data.created);
        await loadData();
      } else if (res.ok) {
        alert(data.message || '未生成任何角色');
      } else {
        alert(data.error || '提取失败');
      }
    } catch {
      alert('网络错误');
    }
    setExtracting(false);
  }
  async function handleGenerateAllPortraits() {
    if (!project) return;
    setGeneratingPortraits(true);
    try {
      const res = await fetch('/api/characters/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, forceRegenerate: false }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
        alert(`已生成 ${data.generated} 个角色的定妆照`);
      } else {
        alert(data.error || '生成失败');
      }
    } catch {
      alert('网络错误');
    }
    setGeneratingPortraits(false);
  }

  // 检查角色一致性
  async function handleCheckConsistency() {
    if (!project) return;
    setCheckingConsistency(true);
    setShowConsistency(true);
    try {
      const res = await fetch('/api/characters/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, action: 'check' }),
      });
      const data = await res.json();
      if (res.ok) {
        setConsistencyScore(data.consistencyScore);
        setConsistencyIssues(data.issues || []);
      }
    } catch {
      // ignore
    }
    setCheckingConsistency(false);
  }

  // 生成单个角色定妆照
  async function handleGeneratePortrait(characterId: string) {
    if (!project) return;
    try {
      const res = await fetch('/api/characters/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, characterId, forceRegenerate: true }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
      } else {
        alert(data.error || '生成失败');
      }
    } catch {
      alert('网络错误');
    }
  }

  const completedScripts = scripts.filter(s => s.status === 'completed');

  async function handleExtractFromScript() {
    if (!project || completedScripts.length === 0) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/characters/extract-from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: completedScripts[0].id,
          projectId: project.id,
          hint: extractHint.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.created && data.created > 0) {
        await loadData();
        setShowExtract(false);
        setExtractHint('');
      } else if (res.ok) {
        alert(data.message || '未从剧本中解析出角色，请先生成分镜（分镜数据中包含角色信息）');
      } else {
        alert(data.error || '提取失败，请稍后重试');
      }
    } catch (e) {
      alert('网络错误，请检查连接后重试');
    }
    setExtracting(false);
  }

  async function handleAIGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!aiName.trim() || !project) return;
    setAiGenerating(true);
    try {
      await fetch('/api/characters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: aiName.trim(),
          hint: aiHint.trim() || undefined,
          projectId: project.id,
          saveToDb: true,
        }),
      });
      setAiName('');
      setAiHint('');
      setShowAIGen(false);
      await loadData();
    } catch { /* ignore */ }
    setAiGenerating(false);
  }

  function startEdit(c: Character) {
    setForm({
      name: c.name || '', age: c.age || '', gender: c.gender || '',
      personality: c.personality || '', clothing: c.clothing || '',
      appearance: c.appearance || '', hair: c.hair || '',
      eyes: c.eyes || '', build: c.build || '',
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  function cancelEdit() {
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingId) {
      await updateCharacter(editingId, form);
    } else {
      await createCharacter(form);
    }
    cancelEdit();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        title="角色管理"
        subtitle="创建和管理故事中的角色"
        icon="🎭"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {characters.length > 0 && (
              <>
                <Button variant="secondary" onClick={handleCheckConsistency} loading={checkingConsistency}>
                  🔍 一致性检查
                </Button>
                <Button variant="secondary" onClick={handleGenerateAllPortraits} loading={generatingPortraits}>
                  🎨 生成定妆照
                </Button>
              </>
            )}
            <Button variant={showAIGen ? 'secondary' : 'secondary'} onClick={() => { setShowAIGen(v => !v); setShowForm(false); }}>
              🤖 AI 生成
            </Button>
            {completedScripts.length > 0 && (
              <Button variant="secondary" onClick={() => { setShowExtract(true); setShowForm(false); setShowAIGen(false); }}>
                📖 从剧本提取
              </Button>
            )}
            <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => { setShowForm(v => !v); setShowAIGen(false); }}>
              {showForm ? '✖️ 取消' : '✨ 创建角色'}
            </Button>
          </div>
        }
      >
        {showAIGen && (
          <Card variant="default" className="mb-6 p-6 border border-emerald-100">
            <h3 className="font-semibold text-ink mb-2">AI 智能生成角色</h3>
            <p className="text-sm text-ink-muted mb-4">输入角色名和简单描述，AI 自动补全全部设定</p>
            <form onSubmit={handleAIGenerate} className="space-y-4">
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">角色名 *</label>
                <input className="input-field" placeholder="例：林晚月" value={aiName} onChange={e => setAiName(e.target.value)} disabled={aiGenerating} />
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">角色提示（可选）</label>
                <textarea
                  className="textarea-field min-h-[60px]"
                  placeholder="描述你想要的感觉，如：冷酷的女剑客，黑色长发，沉默寡言"
                  value={aiHint}
                  onChange={e => setAiHint(e.target.value)}
                  disabled={aiGenerating}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={!aiName.trim() || aiGenerating} loading={aiGenerating}>
                  {aiGenerating ? '生成中...' : '🤖 AI 自动生成'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setShowAIGen(false); setAiName(''); setAiHint(''); }}>
                  取消
                </Button>
              </div>
            </form>
          </Card>
        )}

        {showForm && (
          <Card variant="default" className="mb-6 p-6 border border-emerald-100">
            <h3 className="font-semibold text-ink mb-4">{editingId ? '编辑角色' : '创建新角色'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-ink-secondary mb-1.5">角色名称 *</label>
                  <input className="input-field" placeholder="输入角色名" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm text-ink-secondary mb-1.5">年龄</label>
                  <input className="input-field" placeholder="例：25岁" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm text-ink-secondary mb-1.5">性别</label>
                  <select className="input-field" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">未指定</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-ink-secondary mb-1.5">体型</label>
                  <input className="input-field" placeholder="例：中等身材" value={form.build} onChange={e => setForm(f => ({ ...f, build: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">外貌特征</label>
                <input className="input-field" placeholder="描述外貌" value={form.appearance} onChange={e => setForm(f => ({ ...f, appearance: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-ink-secondary mb-1.5">发型</label>
                  <input className="input-field" placeholder="例：黑色短发" value={form.hair} onChange={e => setForm(f => ({ ...f, hair: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm text-ink-secondary mb-1.5">瞳色</label>
                  <input className="input-field" placeholder="例：蓝色" value={form.eyes} onChange={e => setForm(f => ({ ...f, eyes: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">性格特点</label>
                <input className="input-field" placeholder="描述性格" value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">着装风格</label>
                <input className="input-field" placeholder="描述服装" value={form.clothing} onChange={e => setForm(f => ({ ...f, clothing: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit">{editingId ? '💾 保存修改' : '✨ 创建角色'}</Button>
                <Button type="button" variant="secondary" onClick={cancelEdit}>取消</Button>
              </div>
            </form>
          </Card>
        )}

        {characters.length === 0 ? (
          <Card variant="default" className="text-center py-16">
            <div className="text-6xl mb-4 opacity-50">🎭</div>
            <h3 className="text-lg font-semibold text-ink mb-2">还没有角色</h3>
            <p className="text-sm text-ink-secondary mb-6">点击上方按钮创建第一个角色</p>
          </Card>
        ) : (
          <>
            {/* 批量操作栏 */}
            {selectedForDelete.length > 0 && (
              <div className="flex items-center justify-between mb-4 p-4 card-subtle rounded-xl">
                <span className="text-sm text-ink-secondary">
                  已选择 <span className="font-semibold text-ink">{selectedForDelete.length}</span> 个角色
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={toggleSelectAll}>
                    全选
                  </Button>
                  <Button variant="danger" onClick={handleBatchDelete}>
                    🗑️ 批量删除
                  </Button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map((c, idx) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  index={idx}
                  onEdit={() => startEdit(c)}
                  onDelete={() => deleteCharacter(c.id)}
                  onGeneratePortrait={() => handleGeneratePortrait(c.id)}
                  selected={selectedForDelete.includes(c.id)}
                  onSelect={() => toggleSelectForDelete(c.id)}
                />
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Extract from script dialog */}
      {showExtract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowExtract(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">从剧本提取角色</h2>
              <button onClick={() => setShowExtract(false)} className="w-8 h-8 rounded-lg hover:bg-base-bg flex items-center justify-center text-ink-muted transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 成功提示 */}
            {extractedCount > 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-lg font-semibold text-ink mb-2">提取成功！</h3>
                <p className="text-sm text-ink-secondary mb-6">已成功创建 {extractedCount} 个角色</p>
                <Button onClick={() => { setShowExtract(false); setExtractedCount(0); }}>
                  完成
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="card-subtle p-4 text-sm text-ink-secondary leading-relaxed">
                  <p>AI 将自动分析剧本内容，提取角色名并生成完整的角色设定（外貌、性格、服装等）。</p>
                </div>

                {/* 正在检测 */}
                {detectingCharacters ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-ink-secondary">AI 正在分析剧本...</p>
                  </div>
                ) : detectedCharacters.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3 opacity-50">📝</div>
                    <p className="text-sm text-ink-secondary">未检测到角色，请先生成分镜数据</p>
                  </div>
                ) : (
                  <>
                    {/* 检测到的角色列表 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-ink-secondary">
                          检测到 {detectedCharacters.length} 个角色
                        </label>
                        <button 
                          onClick={toggleAllSelection}
                          className="text-xs text-emerald-600 hover:text-emerald-700"
                        >
                          {selectedCharacters.length === detectedCharacters.length ? '取消全选' : '全选'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {detectedCharacters.map((name, idx) => (
                          <label 
                            key={idx}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedCharacters.includes(name)
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-white border-border hover:border-emerald-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCharacters.includes(name)}
                              onChange={() => toggleCharacterSelection(name)}
                              className="w-4 h-4 rounded border-border text-emerald-600"
                            />
                            <span className="text-sm text-ink">{name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 提取提示 */}
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-2">额外提示（可选）</label>
                      <textarea
                        className="textarea-field min-h-[60px]"
                        placeholder="例如：让角色更偏向年轻风格"
                        value={extractHint}
                        onChange={e => setExtractHint(e.target.value)}
                        disabled={extracting}
                      />
                      <p className="text-xs text-ink-muted mt-1.5">提供额外提示可以让角色设定更符合你的需求</p>
                    </div>
                  </>
                )}

                {/* 操作按钮 */}
                {detectedCharacters.length > 0 && extractedCount === 0 && (
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleExtractSelected} 
                      disabled={extracting || selectedCharacters.length === 0} 
                      className="flex-1"
                    >
                      {extracting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          生成中...
                        </>
                      ) : (
                        `✨ 生成 ${selectedCharacters.length} 个角色`
                      )}
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowExtract(false); setExtractHint(''); setDetectedCharacters([]); setSelectedCharacters([]); setExtractedCount(0); }} className="flex-1">
                      取消
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 角色一致性检查弹窗 */}
      {showConsistency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowConsistency(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">🔍 角色一致性检查</h2>
              <button onClick={() => setShowConsistency(false)} className="w-8 h-8 rounded-lg hover:bg-base-bg flex items-center justify-center text-ink-muted transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {checkingConsistency ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-ink-secondary">正在检查角色一致性...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 评分 */}
                {consistencyScore !== null && (
                  <div className="text-center p-6 card-subtle rounded-xl">
                    <div className="text-4xl font-bold mb-2" style={{ color: consistencyScore >= 80 ? '#10b981' : consistencyScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                      {consistencyScore}分
                    </div>
                    <p className="text-sm text-ink-secondary">
                      {consistencyScore >= 90 ? '一致性优秀' : consistencyScore >= 70 ? '一致性良好' : consistencyScore >= 50 ? '需要改进' : '需要修复'}
                    </p>
                  </div>
                )}

                {/* 问题列表 */}
                {consistencyIssues.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-ink">发现的问题</h3>
                    {consistencyIssues.map((issue, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${
                        issue.severity === 'error' 
                          ? 'bg-red-50 border-red-200' 
                          : issue.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm">
                            {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'}
                          </span>
                          <p className="text-sm text-ink-secondary">{issue.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : consistencyScore !== null ? (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-sm text-ink-secondary">没有发现严重问题</p>
                  </div>
                ) : null}

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-2 border-t border-border">
                  <Button onClick={handleGenerateAllPortraits} loading={generatingPortraits} className="flex-1">
                    🎨 生成定妆照
                  </Button>
                  <Button variant="secondary" onClick={() => setShowConsistency(false)} className="flex-1">
                    关闭
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

function CharacterCard({ character: c, index, onEdit, onDelete, onGeneratePortrait, selected, onSelect }: {
  character: Character; index: number; onEdit: () => void; onDelete: () => void; onGeneratePortrait: () => void;
  selected?: boolean; onSelect?: () => void;
}) {
  const hasImage = !!c.referenceImg;
  return (
    <Card variant="default" className={`p-0 animate-slide-up transition-all ${selected ? 'ring-2 ring-emerald-500' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="p-5 flex items-start gap-4">
        {/* 选择框 */}
        {onSelect && (
          <div className="flex-shrink-0 pt-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              className="w-5 h-5 rounded border-border text-emerald-600 cursor-pointer"
            />
          </div>
        )}
        
        {/* 角色头像 */}
        <div className="relative flex-shrink-0">
          {hasImage ? (
            <img src={c.referenceImg!} alt={c.name} className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-3xl text-emerald-600">
              {c.name.charAt(0) || '?'}
            </div>
          )}
          {hasImage && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-xs text-white">✓</div>
          )}
        </div>

        {/* 角色信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-ink truncate">{c.name}</h4>
            {c.age && <span className="text-xs text-ink-muted">{c.age}</span>}
          </div>
          <div className="flex gap-2 flex-wrap mb-2">
            {c.gender && <Badge variant="emerald">{c.gender === 'male' ? '♂' : c.gender === 'female' ? '♀' : '⚥'}</Badge>}
            {hasImage ? (
              <Badge variant="emerald">有定妆照</Badge>
            ) : (
              <Badge variant="zinc">未定妆</Badge>
            )}
          </div>
          {c.personality && <p className="text-xs text-ink-muted line-clamp-2">{c.personality}</p>}
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {!hasImage && (
            <button onClick={onGeneratePortrait} className="btn-ghost px-3 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
              🎨 定妆
            </button>
          )}
          <button onClick={onEdit} className="btn-ghost px-3 py-1.5 text-xs">✏️</button>
          <button onClick={onDelete} className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:text-red-600">🗑️</button>
        </div>
      </div>
    </Card>
  );
}
