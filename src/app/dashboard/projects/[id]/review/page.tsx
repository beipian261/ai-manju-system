'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

interface Frame {
  id: string;
  sceneNum: number;
  name: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  comments: number;
  hasImage: boolean;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  annotationX: number | null;
  annotationY: number | null;
  createdAt: string;
}

interface StoryboardDetail {
  id: string;
  sceneNum: number;
  title: string | null;
  description: string;
  dialogue: string | null;
  imageUrls: string | null;
  reviewStatus: string | null;
  location: string | null;
  emotion: string | null;
}

const AVATAR_COLORS = ['#10B981', '#0369A0', '#14803C', '#7C3AED', '#DC2626'];
const REVIEWER_NAME = '评审员';

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'reviewing': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-base-bg text-ink-secondary border-border';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'approved': return '已通过';
    case 'reviewing': return '评审中';
    case 'rejected': return '已驳回';
    default: return '待评审';
  }
};

const getThumbnailStyle = (status: string) => {
  switch (status) {
    case 'approved': return 'bg-emerald-50 text-emerald-600';
    case 'reviewing': return 'bg-emerald-50 text-emerald-600';
    case 'rejected': return 'bg-red-50 text-red-600';
    default: return 'bg-base-bg text-ink-muted';
  }
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function getAvatarColor(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ReviewPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState('');
  const [storyboard, setStoryboard] = useState<StoryboardDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiGet<{ frames: Frame[] }>(`/api/review/comments?projectId=${projectId}`)
      .then(data => {
        if (data.frames) {
          setFrames(data.frames);
          if (data.frames.length > 0) setSelectedFrameId(data.frames[0].id);
        }
      })
      .catch(() => setError('加载分镜列表失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadFrameData = useCallback(async () => {
    if (!selectedFrameId) return;
    try {
      const sbData = await apiGet<StoryboardDetail[]>(`/api/storyboards?projectId=${projectId}`);
      const sb = sbData.find((s: StoryboardDetail) => s.id === selectedFrameId);
      if (sb) setStoryboard({
        id: sb.id, sceneNum: sb.sceneNum, title: sb.title,
        description: sb.description, dialogue: sb.dialogue,
        imageUrls: sb.imageUrls, reviewStatus: sb.reviewStatus,
        location: sb.location, emotion: sb.emotion,
      });
    } catch { /* ignore */ }
    try {
      const cmtData = await apiGet<{ comments: Comment[] }>(`/api/review/comments?storyboardId=${selectedFrameId}`);
      setComments(cmtData.comments || []);
    } catch { setComments([]); }
  }, [selectedFrameId, projectId]);

  useEffect(() => { loadFrameData(); }, [loadFrameData]);

  const submitComment = async () => {
    if (!newComment.trim() || !selectedFrameId) return;
    setSubmitting(true);
    try {
      const data = await apiPost<{ comment: Comment }>('/api/review/comments', { storyboardId: selectedFrameId, author: REVIEWER_NAME, text: newComment.trim() });
      setComments(prev => [data.comment, ...prev]);
      setNewComment('');
      setFrames(prev => prev.map(f => f.id === selectedFrameId ? { ...f, comments: f.comments + 1, status: 'reviewing' as const } : f));
    } catch (e) { setError(e instanceof Error ? e.message : '评论失败'); }
    finally { setSubmitting(false); }
  };

  const updateStatus = async (status: 'approved' | 'rejected') => {
    if (!selectedFrameId) return;
    try {
      await apiPatch('/api/review/status', { storyboardId: selectedFrameId, reviewStatus: status });
      setStoryboard(prev => prev ? { ...prev, reviewStatus: status } : null);
      setFrames(prev => prev.map(f => f.id === selectedFrameId ? { ...f, status } : f));
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
  };

  const imageUrl = storyboard?.imageUrls ? storyboard.imageUrls.split(',')[0] : null;
  const currentStatus = storyboard?.reviewStatus || 'pending';

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
          <h1 className="text-2xl font-bold text-ink">协作评审</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">共 {frames.length} 场 | 已通过 {frames.filter(f => f.status === 'approved').length} | 评审中 {frames.filter(f => f.status === 'reviewing').length}</span>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-[240px] flex-shrink-0 bg-white border-r border-border p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">分镜列表</h3>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
          ) : frames.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2 opacity-40">🎬</div>
              <p className="text-xs text-ink-muted">暂无分镜数据</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {frames.map(frame => (
                <button key={frame.id} onClick={() => setSelectedFrameId(frame.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    selectedFrameId === frame.id
                      ? frame.status === 'reviewing' ? 'bg-emerald-50/60 border border-emerald-200' :
                        frame.status === 'approved' ? 'bg-emerald-50/60 border border-emerald-200' :
                        'bg-base-bg border border-border'
                      : 'hover:bg-base-bg'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold ${getThumbnailStyle(frame.status)}`}>
                    {frame.sceneNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{frame.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`badge text-[9px] ${getStatusStyle(frame.status)}`}>{getStatusLabel(frame.status)}</span>
                      {frame.comments > 0 && (
                        <span className="text-[9px] text-ink-muted flex items-center gap-0.5">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>{frame.comments}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-white border-r border-border p-6 overflow-y-auto scrollbar-thin">
          {storyboard ? (
            <>
              <div className="w-full h-[320px] rounded-2xl bg-ink flex items-center justify-center mb-4 relative overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt={storyboard.title || `场景${storyboard.sceneNum}`} className="w-full h-full object-contain" />
                ) : (
                  <>
                    <div className="absolute top-4 left-4">
                      <p className="text-lg font-bold text-ink-muted">第{storyboard.sceneNum}场</p>
                    </div>
                    {comments.filter(c => c.annotationX !== null).map((c, idx) => (
                      <div key={c.id} className="absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white/50"
                        style={{ left: `${(c.annotationX || 0.5) * 100}%`, top: `${(c.annotationY || 0.5) * 100}%`,
                          background: idx === 0 ? '#10B981' : '#DC2626', transform: 'translate(-50%, -50%)' }}>{idx + 1}</div>
                    ))}
                    <span className="text-ink-muted text-lg">暂无预览图</span>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">第{storyboard.sceneNum}场</span>
                  <span className="text-xs text-ink-muted">{storyboard.location || '未知地点'}{storyboard.emotion ? ` | ${storyboard.emotion}` : ''}</span>
                </div>
                <span className={`badge text-xs ${getStatusStyle(currentStatus)}`}>{getStatusLabel(currentStatus)}</span>
              </div>

              <div className="card-subtle p-4 mb-4">
                <p className="text-xs text-ink-secondary leading-relaxed">{storyboard.description}</p>
                {storyboard.dialogue && (
                  <p className="text-xs text-ink-muted italic mt-2 pt-2 border-t border-border">{storyboard.dialogue}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => updateStatus('approved')} disabled={currentStatus === 'approved'}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${currentStatus === 'approved' ? 'bg-emerald-100 text-emerald-600 cursor-default' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  ✅ 批准通过
                </button>
                <button onClick={() => updateStatus('rejected')} disabled={currentStatus === 'rejected'}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 border ${currentStatus === 'rejected' ? 'bg-red-50 text-red-600 border-red-300 cursor-default' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                  ❌ 驳回修改
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-5xl mb-3 opacity-30">🎬</div>
                <p className="text-sm text-ink-muted">请从左侧选择一个分镜</p>
              </div>
            </div>
          )}

          {error && (<div className="mt-4 bg-red-50 rounded-xl p-3 border border-red-200"><p className="text-xs text-red-700">{error}</p></div>)}
        </div>

        <div className="w-[360px] flex-shrink-0 bg-white p-4 overflow-y-auto scrollbar-thin flex flex-col">
          <h3 className="text-base font-bold text-ink mb-4 flex-shrink-0">评审意见</h3>
          <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin mb-4">
            {comments.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2 opacity-40">💬</div>
                <p className="text-xs text-ink-muted">暂无评论</p>
              </div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="card-subtle p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: getAvatarColor(comment.author) }}>
                      {comment.author.charAt(0)}
                    </div>
                    <span className="text-xs font-semibold text-ink">{comment.author}</span>
                    <span className="text-[10px] text-ink-muted">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed">{comment.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-border flex-shrink-0">
            <textarea className="textarea-field text-xs min-h-[80px] mb-2" placeholder="输入你的评审意见..."
              value={newComment} onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }} />
            <button onClick={submitComment} disabled={!newComment.trim() || submitting}
              className="btn-primary w-full btn-sm disabled:opacity-50">
              {submitting ? '发送中...' : '发送评论'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
