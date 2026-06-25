'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character, Storyboard, ProgressInfo } from '@/app/dashboard/projects/[id]/types';
import { logger } from '@/lib/utils/logger';

interface UseStoryboardActionsResult {
  generatingStoryboard: string | null;
  generatingImage: string | null;
  generatingVideo: Set<string>;
  batchGeneratingImages: boolean;
  batchGeneratingVideos: boolean;
  generateStoryboards: (scriptId: string) => Promise<void>;
  generateStoryboardsWithOrder: (scriptId: string, orderedScenes: Array<Record<string, unknown>>) => Promise<void>;
  generateImage: (storyboardId: string, prompt: string) => Promise<void>;
  generateVideo: (storyboardId: string) => Promise<void>;
  batchGenerateImages: (storyboardIds: string[]) => Promise<void>;
  batchGenerateVideos: (storyboardIds: string[]) => Promise<void>;
  batchDeleteStoryboards: (storyboardIds: string[]) => Promise<void>;
  deleteStoryboard: (id: string) => Promise<void>;
  updateStoryboard: (id: string, fields: Partial<Storyboard>) => Promise<void>;
  reorderStoryboards: (orderedIds: string[]) => Promise<void>;
}

export function useStoryboardActions(
  projectId: string,
  loadData: () => Promise<void>,
  storyboardsRef: React.MutableRefObject<Storyboard[]>,
  charactersRef: React.MutableRefObject<Character[]>,
  progressMapRef: React.MutableRefObject<Record<string, ProgressInfo>>,
  setStoryboards: React.Dispatch<React.SetStateAction<Storyboard[]>>,
  setSelectedStoryboards: React.Dispatch<React.SetStateAction<Set<string>>>,
  setError: (msg: string) => void,
  clearError: () => void
): UseStoryboardActionsResult {
  const [generatingStoryboard, setGeneratingStoryboard] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState<Set<string>>(new Set());
  const [batchGeneratingImages, setBatchGeneratingImages] = useState(false);
  const [batchGeneratingVideos, setBatchGeneratingVideos] = useState(false);
  const pollingVideosRef = useRef<Set<string>>(new Set());

  const localSetError = useCallback((msg: string) => {
    setError(msg);
  }, [setError]);

  const generateStoryboards = useCallback(async (scriptId: string) => {
    setGeneratingStoryboard(scriptId);
    const maxWaitMs = 180_000;
    const startTime = Date.now();
    try {
      const res = await fetch('/api/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId, projectId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const poll = () => {
        const elapsed = Date.now() - startTime;
        const cur = progressMapRef.current[scriptId];
        const curSB = storyboardsRef.current.filter(sb => sb.scriptId === scriptId);
        if (cur?.status === 'completed' || cur?.status === 'failed' || curSB.length > 0) {
          setGeneratingStoryboard(null);
          loadData(); return;
        }
        if (elapsed > maxWaitMs) {
          setGeneratingStoryboard(null);
          localSetError('分镜生成超时');
          setTimeout(clearError, 8000);
          loadData(); return;
        }
        setTimeout(poll, 2000);
      };
      setTimeout(poll, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络错误';
      localSetError('生成分镜失败：' + msg);
      setTimeout(clearError, 5000);
      setGeneratingStoryboard(null);
    }
  }, [projectId, loadData, localSetError, clearError, progressMapRef, storyboardsRef]);

  const generateStoryboardsWithOrder = useCallback(async (scriptId: string, orderedScenes: Array<Record<string, unknown>>) => {
    setGeneratingStoryboard(scriptId);
    const maxWaitMs = 300_000;
    const startTime = Date.now();
    try {
      const res = await fetch('/api/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId, projectId, sceneOrder: orderedScenes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const poll = () => {
        const elapsed = Date.now() - startTime;
        const cur = progressMapRef.current[scriptId];
        const curSB = storyboardsRef.current.filter(sb => sb.scriptId === scriptId);
        if (cur?.status === 'completed' || cur?.status === 'failed' || curSB.length > 0) {
          setGeneratingStoryboard(null); loadData(); return;
        }
        if (elapsed > maxWaitMs) {
          setGeneratingStoryboard(null);
          localSetError('分镜生成超时');
          setTimeout(clearError, 8000);
          loadData(); return;
        }
        setTimeout(poll, 2000);
      };
      setTimeout(poll, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络错误';
      localSetError('生成分镜失败：' + msg);
      setTimeout(clearError, 5000);
      setGeneratingStoryboard(null);
    }
  }, [projectId, loadData, localSetError, clearError, progressMapRef, storyboardsRef]);

  const generateImage = useCallback(async (storyboardId: string, prompt: string) => {
    setGeneratingImage(storyboardId);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 240_000);
      const characterRefs = charactersRef.current
        .filter(c => c.referenceImg)
        .map(c => c.referenceImg as string)
        .slice(0, 4);
      const res = await fetch('/api/agnes/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardId, prompt, characterRefs }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await loadData();
    } catch (e) {
      const msg = e instanceof Error && e.name === 'AbortError' ? '生成超时' : e instanceof Error ? e.message : '未知错误';
      localSetError('生成图片失败：' + msg);
      setTimeout(clearError, 6000);
    } finally {
      setGeneratingImage(null);
    }
  }, [loadData, localSetError, clearError, charactersRef]);

  const startVideoPolling = useCallback((storyboardId: string, maxAttempts = 120) => {
    if (pollingVideosRef.current.has(storyboardId)) return;
    pollingVideosRef.current.add(storyboardId);
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/agnes/video/task/${storyboardId}`);
        if (!res.ok) throw new Error('poll failed');
        const data = await res.json();
        setStoryboards(prev => prev.map(s =>
          s.id === storyboardId ? { ...s, videoUrl: data.videoUrl || s.videoUrl, videoStatus: data.videoStatus } : s
        ));
        if (data.videoStatus === 'completed' && data.videoUrl) {
          pollingVideosRef.current.delete(storyboardId);
          setGeneratingVideo(prev => { const n = new Set(prev); n.delete(storyboardId); return n; });
          loadData(); return;
        }
        if (data.videoStatus === 'failed' || attempts >= maxAttempts) {
          pollingVideosRef.current.delete(storyboardId);
          setGeneratingVideo(prev => { const n = new Set(prev); n.delete(storyboardId); return n; });
          return;
        }
      } catch { /* ignore */ }
      setTimeout(poll, 5000);
    };
    poll();
  }, [setStoryboards, loadData]);

  const generateVideo = useCallback(async (storyboardId: string) => {
    const sb = storyboardsRef.current.find(s => s.id === storyboardId);
    if (!sb || !sb.imageUrls) {
      localSetError('该分镜还没有图片，无法生成视频');
      setTimeout(clearError, 3000); return;
    }
    if (sb.videoUrl) {
      localSetError('该分镜已生成视频');
      setTimeout(clearError, 3000); return;
    }
    setGeneratingVideo(prev => new Set(prev).add(storyboardId));
    try {
      const res = await fetch('/api/agnes/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardId, duration: sb.duration || 8 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStoryboards(prev => prev.map(s =>
        s.id === storyboardId ? { ...s, videoTaskId: data.videoTaskId, videoStatus: data.videoStatus } : s
      ));
      startVideoPolling(storyboardId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络错误';
      localSetError('生成视频失败：' + msg);
      setTimeout(clearError, 6000);
      setGeneratingVideo(prev => { const n = new Set(prev); n.delete(storyboardId); return n; });
    }
  }, [localSetError, clearError, storyboardsRef, setStoryboards, startVideoPolling]);

  const batchGenerateImages = useCallback(async (ids: string[]) => {
    const idsWithoutImage = ids.filter(id => {
      const sb = storyboardsRef.current.find(s => s.id === id);
      return sb && !sb.imageUrls;
    });
    if (idsWithoutImage.length === 0) {
      localSetError('选中的分镜都已有图片');
      setTimeout(clearError, 3000); return;
    }
    setBatchGeneratingImages(true);
    try {
      const res = await fetch('/api/agnes/image/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardIds: idsWithoutImage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '批量生成失败');
      }
      setSelectedStoryboards(new Set());
    } catch {
      localSetError('批量生成图片失败');
      setTimeout(clearError, 3000);
    } finally {
      setBatchGeneratingImages(false);
    }
  }, [localSetError, clearError, storyboardsRef, setSelectedStoryboards]);

  const batchGenerateVideos = useCallback(async (ids: string[]) => {
    const idsToProcess = ids.filter(id => {
      const sb = storyboardsRef.current.find(s => s.id === id);
      return sb && sb.imageUrls && !sb.videoUrl && !sb.videoTaskId;
    });
    if (idsToProcess.length === 0) {
      localSetError('选中的分镜中：没有图片、或已有视频、或正在生成');
      setTimeout(clearError, 3000); return;
    }
    setBatchGeneratingVideos(true);
    idsToProcess.forEach(id => setGeneratingVideo(prev => new Set(prev).add(id)));
    try {
      const res = await fetch('/api/agnes/video/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardIds: idsToProcess }),
      });
      if (!res.ok) throw new Error('批量生成视频失败');
      const data = await res.json();
      data.results?.forEach((r: { storyboardId: string; status: string }) => {
        if (r.status === 'completed' || r.status === 'started') {
          startVideoPolling(r.storyboardId);
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络错误';
      localSetError('批量生成视频失败：' + msg);
      setTimeout(clearError, 6000);
      idsToProcess.forEach(id => setGeneratingVideo(prev => { const n = new Set(prev); n.delete(id); return n; }));
    } finally {
      setBatchGeneratingVideos(false);
    }
  }, [localSetError, clearError, storyboardsRef, startVideoPolling]);

  const deleteStoryboard = useCallback(async (id: string) => {
    await fetch(`/api/storyboards/${id}`, { method: 'DELETE' });
    setSelectedStoryboards(prev => { const n = new Set(prev); n.delete(id); return n; });
    await loadData();
  }, [loadData, setSelectedStoryboards]);

  const batchDeleteStoryboards = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/storyboards/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setSelectedStoryboards(new Set());
        await loadData();
      }
    } catch (e) {
      logger.error('Batch delete failed:', e);
    }
  }, [loadData, setSelectedStoryboards]);

  const updateStoryboard = useCallback(async (id: string, fields: Partial<Storyboard>) => {
    const res = await fetch(`/api/storyboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error('update failed');
    const updated: Storyboard = await res.json();
    setStoryboards(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  }, [setStoryboards]);

  const reorderStoryboards = useCallback(async (orderedIds: string[]) => {
    const oldSB = storyboardsRef.current;
    const idToSB = new Map(oldSB.map(s => [s.id, s]));
    const optimistic = orderedIds.map((id, idx) => {
      const sb = idToSB.get(id);
      return sb ? { ...sb, sceneNum: idx + 1 } : null;
    }).filter(Boolean) as Storyboard[];

    setStoryboards(optimistic);

    try {
      const res = await fetch('/api/storyboards/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardIds: orderedIds }),
      });
      if (!res.ok) throw new Error('reorder failed');
    } catch (e) {
      setStoryboards(oldSB);
      localSetError('排序失败，已恢复');
      setTimeout(clearError, 3000);
    }
  }, [setStoryboards, localSetError, clearError, storyboardsRef]);

  // Restore video polling on mount for in-progress tasks
  useEffect(() => {
    storyboardsRef.current.forEach(sb => {
      if (sb.videoTaskId && !sb.videoUrl && sb.videoStatus !== 'completed' && sb.videoStatus !== 'failed') {
        startVideoPolling(sb.id);
      }
    });
  }, [storyboardsRef, startVideoPolling]);

  return {
    generatingStoryboard, generatingImage, generatingVideo,
    batchGeneratingImages, batchGeneratingVideos,
    generateStoryboards, generateStoryboardsWithOrder, generateImage, generateVideo,
    batchGenerateImages, batchGenerateVideos, batchDeleteStoryboards, deleteStoryboard, updateStoryboard,
    reorderStoryboards,
  };
}
