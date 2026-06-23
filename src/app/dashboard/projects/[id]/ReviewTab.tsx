'use client';
import { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from './ProjectContext';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type ReviewStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

interface ReviewFrame {
  id: string;
  sceneNum: number;
  description: string;
  imageUrls?: string;
  reviewStatus: ReviewStatus;
  comments: string[];
  dialogue?: string;
  emotion?: string;
}

const REVIEW_STATUSES = new Set<ReviewStatus>(['pending', 'reviewing', 'approved', 'rejected']);

function normalizeReviewStatus(status?: string): ReviewStatus {
  if (status && REVIEW_STATUSES.has(status as ReviewStatus)) {
    return status as ReviewStatus;
  }
  return 'pending';
}

const REVIEWER_NAME = '评审员';

export default function ReviewTab() {
  const { storyboards, projectId } = useProjectContext();
  const [frames, setFrames] = useState<ReviewFrame[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 从 storyboards 初始化评审数据
  useEffect(() => {
    const f: ReviewFrame[] = storyboards
      .map(sb => ({
        id: sb.id,
        sceneNum: sb.sceneNum,
        description: sb.description,
        imageUrls: sb.imageUrls,
        reviewStatus: normalizeReviewStatus(sb.reviewStatus),
        comments: (sb.comments || []).map((c) =>
          typeof c === 'string' ? c : c.text
        ),
        dialogue: sb.dialogue,
        emotion: sb.emotion,
      }))
      .sort((a, b) => a.sceneNum - b.sceneNum);
    setFrames(f);
    if (f.length > 0 && !selectedId) setSelectedId(f[0].id);
  }, [storyboards]);

  const selectedFrame = frames.find(f => f.id === selectedId) || null;
  const approvedCount = frames.filter(f => f.reviewStatus === 'approved').length;
  const rejectedCount = frames.filter(f => f.reviewStatus === 'rejected').length;

  const updateStatus = useCallback((status: 'approved' | 'rejected') => {
    if (!selectedId) return;
    setFrames(prev => prev.map(f => f.id === selectedId ? { ...f, reviewStatus: status } : f));
  }, [selectedId]);

  const submitComment = () => {
    if (!newComment.trim() || !selectedId) return;
    setSubmitting(true);
    setTimeout(() => {
      setFrames(prev => prev.map(f =>
        f.id === selectedId
          ? { ...f, comments: [...f.comments, newComment.trim()], reviewStatus: 'reviewing' }
          : f
      ));
      setNewComment('');
      setSubmitting(false);
    }, 500);
  };

  const getStatusBadge = (s: ReviewStatus) => {
    switch (s) {
      case 'approved': return { label: '已通过', cls: 'emerald' };
      case 'rejected': return { label: '已驳回', cls: 'red' };
      case 'reviewing': return { label: '评审中', cls: 'sky' };
      default: return { label: '待评审', cls: 'zinc' };
    }
  };

  if (!projectId) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        title="协作评审"
        subtitle={`共 ${frames.length} 场 · ${approvedCount} 通过 · ${rejectedCount} 驳回`}
        icon="✅"
      />

      {frames.length === 0 ? (
        <Card variant="default" className="text-center py-20">
          <div className="text-6xl mb-4 opacity-40">📋</div>
          <h3 className="text-lg font-semibold text-ink mb-2">暂无可评审的分镜</h3>
          <p className="text-sm text-ink-muted">请先在「分镜」Tab 中生成场景</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 分镜列表 */}
          <div className="lg:col-span-3">
            <Card variant="default" className="p-4">
            <h3 className="text-sm font-semibold text-ink mb-3">分镜列表</h3>
            <div className="space-y-1.5 max-h-[540px] overflow-y-auto">
              {frames.map(frame => {
                const badge = getStatusBadge(frame.reviewStatus);
                return (
                  <button key={frame.id} onClick={() => setSelectedId(frame.id)}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-left ${
                    selectedId === frame.id
                      ? frame.reviewStatus === 'approved' ? 'bg-emerald-50 border border-emerald-200'
                      : frame.reviewStatus === 'rejected' ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50 border border-emerald-200'
                      : 'hover:bg-gray-50'
                  }`}>
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      frame.reviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-700'
                      : frame.reviewStatus === 'rejected' ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}>#{frame.sceneNum}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-ink-secondary line-clamp-2">{frame.description}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant={badge.cls as any}>{badge.label}</Badge>
                        {frame.comments.length > 0 && (
                          <span className="text-[9px] text-ink-muted">💬 {frame.comments.length}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            </Card>
          </div>

          {/* 预览与操作 */}
          <div className="lg:col-span-6">
            <Card variant="default" className="p-5">
              {selectedFrame ? (
              <>
                <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">第{selectedFrame.sceneNum} 场</h3>
                <Badge variant={getStatusBadge(selectedFrame.reviewStatus).cls as any}>
                  {getStatusBadge(selectedFrame.reviewStatus).label}
                </Badge>
              </div>

              <div className="w-full h-[280px] bg-gray-100 rounded-xl flex items-center justify-center mb-4 overflow-hidden">
                {selectedFrame.imageUrls ? (
                  <img src={selectedFrame.imageUrls.split(',')[0]}
                    className="w-full h-full object-contain"
                    alt={`场景${selectedFrame.sceneNum}`} />
                ) : (
                  <div className="text-center text-ink-muted">
                    <div className="text-5xl mb-2 opacity-50">🖼️</div>
                    <p className="text-sm">暂无图片</p>
                  </div>
                )}
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-ink-secondary leading-relaxed">{selectedFrame.description}</p>
                {selectedFrame.dialogue && (
                  <p className="text-xs text-ink-muted italic mt-2 pt-2 border-t border-border">
                    「{selectedFrame.dialogue}」
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <Button onClick={() => updateStatus('approved')} className="flex-1">
                  ✅ 批准通过
                </Button>
                <Button variant="secondary" onClick={() => updateStatus('rejected')} className="flex-1">
                  ❌ 驳回修改
                </Button>
              </div>
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-sm text-ink-muted">选择一个分镜进行评审</p>
              </div>
            )}
            </Card>
          </div>

          {/* 评论区 */}
          <div className="lg:col-span-3">
            <Card variant="default" className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink">评审意见</h3>
                {selectedFrame && <Badge variant="zinc">{selectedFrame.comments.length}</Badge>}
              </div>
              {selectedFrame ? (
                <>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto mb-4">
                    {selectedFrame.comments.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-3xl mb-2 opacity-40">💬</div>
                        <p className="text-xs text-ink-muted">暂无评论</p>
                      </div>
                    ) : (
                      selectedFrame.comments.map((c, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">{REVIEWER_NAME[0]}</div>
                          <span className="text-xs font-semibold text-ink">{REVIEWER_NAME}</span>
                          <span className="text-[10px] text-ink-muted">刚刚</span>
                        </div>
                        <p className="text-xs text-ink-secondary leading-relaxed">{c}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-3 border-t border-border">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="输入你的评审意见..."
                    className="w-full p-2.5 border border-border rounded-lg text-xs resize-none min-h-[80px] focus:border-emerald-500 focus:outline-none"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
                  />
                  <Button onClick={submitComment} disabled={!newComment.trim() || submitting} className="w-full mt-2">
                    {submitting ? '发送中...' : '发送评论'}
                  </Button>
                </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-xs text-ink-muted">请先选择一个分镜</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
