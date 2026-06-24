// ============================================================
// ProjectContext — 项目详情页的全局状态管理中心
//
// 职责：
// - 统一管理 project / characters / scripts / storyboards 数据
// - 封装 SSE 进度订阅 + 轮询逻辑
// - 提供给所有 Tab 组件共享的状态和操作方法
// - 消除 [id]/page.tsx 中的 20+ useState 混乱
// ============================================================

'use client';
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Character, Script, Storyboard, ProgressInfo } from './types';
import type { TabKey } from './types';
import { logger } from '@/lib/logger';

// ---- Context Types ----

interface ProjectContextValue {
  // Data
  projectId: string;
  project: Project | null;
  characters: Character[];
  scripts: Script[];
  storyboards: Storyboard[];
  loading: boolean;
  error: string;
  activeTab: TabKey;

  // Progress tracking
  progressMap: Record<string, ProgressInfo>;

  // Streaming state
  streamingContent: Record<string, string>;
  streamingStatus: Record<string, 'idle' | 'streaming' | 'completed'>;

  // Actions
  setActiveTab: (tab: TabKey) => void;
  loadData: () => Promise<void>;
  updateProject: (fields: Partial<Project>) => Promise<void>;
  deleteProject: () => Promise<void>;

  // Character actions
  createCharacter: (data: Omit<Character, 'id' | 'projectId'>) => Promise<void>;
  updateCharacter: (id: string, data: Partial<Character>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  generateCharacterPortrait: (characterId: string, name: string) => Promise<void>;

  // Script actions
  generateScript: (outline: string) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;

  // Storyboard actions
  generateStoryboards: (scriptId: string) => Promise<void>;
  generateStoryboardsWithOrder: (scriptId: string, orderedScenes: Array<Record<string, unknown>>) => Promise<void>;
  generateImage: (storyboardId: string, prompt: string) => Promise<void>;
  generateVideo: (storyboardId: string) => Promise<void>;
  batchGenerateImages: (storyboardIds: string[]) => Promise<void>;
  batchGenerateVideos: (storyboardIds: string[]) => Promise<void>;
  batchDeleteStoryboards: (storyboardIds: string[]) => Promise<void>;
  deleteStoryboard: (id: string) => Promise<void>;
  updateStoryboard: (id: string, fields: Partial<Storyboard>) => Promise<void>;

  // Streaming preview helpers
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  setStoryboards: React.Dispatch<React.SetStateAction<Storyboard[]>>;

  // Streaming state setters
  setStreamingContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setStreamingStatus: React.Dispatch<React.SetStateAction<Record<string, 'idle' | 'streaming' | 'completed'>>>;

  // Selection state (for batch operations)
  selectedStoryboards: Set<string>;
  toggleStoryboardSelection: (id: string) => void;
  toggleSelectAllStoryboards: () => void;
  setSelectedStoryboards: (ids: Set<string>) => void;

  // Loading states for generators
  generatingStoryboard: string | null;
  generatingImage: string | null;
  generatingVideo: Set<string>;
  batchGeneratingImages: boolean;
  batchGeneratingVideos: boolean;
  generatingScript: boolean;
  generatingCharacterImages: Set<string>;

  // Error display
  setError: (msg: string) => void;
  clearError: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}

// ---- Provider ----

interface ProjectProviderProps {
  projectId: string;
  children: React.ReactNode;
}

export function ProjectProvider({ projectId, children }: ProjectProviderProps) {
  // ---- Core Data State ----
  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // ---- Progress Tracking ----
  const [progressMap, setProgressMap] = useState<Record<string, ProgressInfo>>({});

  // ---- Streaming State ----
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [streamingStatus, setStreamingStatus] = useState<Record<string, 'idle' | 'streaming' | 'completed'>>({});

  // ---- Generator Loading States ----
  const [generatingStoryboard, setGeneratingStoryboard] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState<Set<string>>(new Set());
  const [batchGeneratingImages, setBatchGeneratingImages] = useState(false);
  const [batchGeneratingVideos, setBatchGeneratingVideos] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingCharacterImages, setGeneratingCharacterImages] = useState<Set<string>>(new Set());

  // ---- Selection State ----
  const [selectedStoryboards, setSelectedStoryboards] = useState<Set<string>>(new Set());

  // ---- Refs for async access ----
  const storyboardsRef = useRef<Storyboard[]>([]);
  const charactersRef = useRef<Character[]>([]);
  const scriptsRef = useRef<Script[]>([]);
  const progressMapRef = useRef<Record<string, ProgressInfo>>({});
  const pollingVideosRef = useRef<Set<string>>(new Set());
  const sseRef = useRef<EventSource | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);
  const localErrorRef = useRef<string>('');

  // Keep refs in sync
  useEffect(() => { storyboardsRef.current = storyboards; }, [storyboards]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => { scriptsRef.current = scripts; }, [scripts]);
  useEffect(() => { progressMapRef.current = progressMap; }, [progressMap]);

  // ---- Data Loading ----
  const loadData = useCallback(async () => {
    try {
      const [pRes, sbRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch('/api/storyboards?projectId=' + projectId),
      ]);

      if (!pRes.ok) {
        if (pRes.status === 404) setError('项目不存在');
        else setError('加载数据失败');
        return;
      }

      const projectData: Project = await pRes.json();
      const allSB: Storyboard[] = sbRes.ok ? await sbRes.json() : [];

      setProject(projectData);
      setCharacters(projectData.characters || []);
      setScripts(projectData.scripts || []);
      setStoryboards(allSB);
    } catch {
      setError('加载数据失败');
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // ---- SSE Progress Updates ----
  useEffect(() => {
    if (!projectId) return;
    try {
      const es = new EventSource(`/api/progress/stream?projectId=${projectId}`);
      sseRef.current = es;

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'system') return;
          const updated: Record<string, ProgressInfo> = {
            ...progressMapRef.current,
            [data.id]: { progress: data.progress ?? 0, message: data.message ?? '', status: data.status },
          };
          progressMapRef.current = updated;
          setProgressMap(updated);
          if (data.status === 'completed' || data.status === 'failed') {
            // 图片批量生成完成时，取消 loading 状态
            if (data.type === 'image' && data.id?.startsWith('batch_')) {
              setBatchGeneratingImages(false);
            }
            // 刷新数据
            setTimeout(loadData, 500);
          }
        } catch {
          // ignore parse errors
        }
      };
    } catch {
      // fallback to polling only
    }

    return () => {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    };
  }, [projectId, loadData]);

  // ---- Polling Fallback ----
  useEffect(() => {
    pollTimer.current = setInterval(loadData, 8000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [loadData]);

  // ---- Error Helpers ----
  const localSetError = useCallback((msg: string) => {
    localErrorRef.current = msg;
    setError(msg);
  }, []);

  const clearError = useCallback(() => {
    localErrorRef.current = '';
    setError('');
  }, []);

  // ---- Project Actions ----
  const updateProject = useCallback(async (fields: Partial<Project>) => {
    setProject(prev => prev ? { ...prev, ...fields } : prev);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    } catch {
      // silent
    }
  }, [projectId]);

  const deleteProject = useCallback(async () => {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    window.location.href = '/dashboard/projects';
  }, [projectId]);

  // ---- Character Actions ----
  const createCharacter = useCallback(async (data: Omit<Character, 'id' | 'projectId'>) => {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, projectId }),
    });
    if (!res.ok) throw new Error('创建角色失败');
    await loadData();
  }, [projectId, loadData]);

  const updateCharacter = useCallback(async (id: string, data: Partial<Character>) => {
    const res = await fetch(`/api/characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('更新角色失败');
    await loadData();
  }, [loadData]);

  const deleteCharacter = useCallback(async (id: string) => {
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    await loadData();
  }, [loadData]);

  const generateCharacterPortrait = useCallback(async (characterId: string, _name: string) => {
    const next = new Set(generatingCharacterImages);
    next.add(characterId);
    setGeneratingCharacterImages(next);
    try {
      const res = await fetch(`/api/characters/${characterId}/generate-image`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '生成失败');
      }
      await loadData();
    } finally {
      const clear = new Set(generatingCharacterImages);
      clear.delete(characterId);
      setGeneratingCharacterImages(clear);
    }
  }, [generatingCharacterImages, loadData]);

  // ---- Script Actions ----
  const generateScript = useCallback(async (outline: string) => {
    setGeneratingScript(true);
    // Auto-save existing completed scripts as versions before regenerating
    const completedScripts = scriptsRef.current?.filter(s => s.status === 'completed' && s.content) || [];
    if (completedScripts.length > 0) {
      await Promise.allSettled(
        completedScripts.map(s =>
          fetch(`/api/scripts/${s.id}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'ai_generated' }),
          })
        )
      );
    }
    // Generate a temp id for streaming tracking
    const streamId = `stream-${Date.now()}`;
    setStreamingContent(prev => ({ ...prev, [streamId]: '' }));
    setStreamingStatus(prev => ({ ...prev, [streamId]: 'streaming' }));
    try {
      const res = await fetch('/api/scripts?stream=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ projectId, outline }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      // Stream handling — update streamingContent in real-time
      await new Promise<void>((resolve) => {
        if (!res.body) { resolve(); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const processStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) { resolve(); return; }
            buffer += decoder.decode(value, { stream: true });
            let rest = buffer;
            while (rest.includes('\n\n')) {
              const blockEnd = rest.indexOf('\n\n');
              const block = rest.slice(0, blockEnd);
              rest = rest.slice(blockEnd + 2);
              const lines = block.split('\n');
              let eventType = '', dataLine = '';
              for (const line of lines) {
                if (line.startsWith('event: ')) eventType = line.slice(7).trim();
                if (line.startsWith('data: ')) dataLine = line.slice(6);
              }
              if (eventType === 'chunk' && dataLine) {
                // Streaming chunk — update display with accumulated content
                try {
                  const chunkData = JSON.parse(dataLine);
                  if (chunkData.content) {
                    setStreamingContent(prev => ({ ...prev, [streamId]: chunkData.content }));
                  }
                } catch { /* ignore parse errors */ }
              }
              if ((eventType === 'completed' || eventType === 'error') && dataLine) {
                try { JSON.parse(dataLine); } catch { /* ignore */ }
              }
            }
            buffer = rest;
            if (!done) processStream();
            else resolve();
          });
        };
        processStream();
      });
      setStreamingStatus(prev => ({ ...prev, [streamId]: 'completed' }));
      await loadData();
    } catch (e) {
      setStreamingStatus(prev => ({ ...prev, [streamId]: 'completed' }));
      throw e;
    } finally {
      setGeneratingScript(false);
    }
  }, [projectId, loadData]);

  const deleteScript = useCallback(async (id: string) => {
    await fetch(`/api/scripts/${id}`, { method: 'DELETE' });
    await loadData();
  }, [loadData]);

  // ---- Storyboard Actions ----
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
      // Poll until done
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
  }, [projectId, loadData, localSetError, clearError]);

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
  }, [projectId, loadData, localSetError, clearError]);

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
  }, [loadData, localSetError, clearError]);

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
  }, [localSetError, clearError]);

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
  }, [localSetError, clearError]);

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
  }, [localSetError, clearError]);

  const deleteStoryboard = useCallback(async (id: string) => {
    await fetch(`/api/storyboards/${id}`, { method: 'DELETE' });
    setSelectedStoryboards(prev => { const n = new Set(prev); n.delete(id); return n; });
    await loadData();
  }, [loadData]);

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
  }, [loadData]);

  const updateStoryboard = useCallback(async (id: string, fields: Partial<Storyboard>) => {
    const res = await fetch(`/api/storyboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error('update failed');
    const updated: Storyboard = await res.json();
    setStoryboards(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  }, []);

  // ---- Selection Helpers ----
  const toggleStoryboardSelection = useCallback((id: string) => {
    setSelectedStoryboards(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const toggleSelectAllStoryboards = useCallback(() => {
    setSelectedStoryboards(prev =>
      prev.size === storyboards.length ? new Set() : new Set(storyboards.map(s => s.id))
    );
  }, [storyboards]);

  // ---- Video Polling ----
  function startVideoPolling(storyboardId: string, maxAttempts = 120) {
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
  }

  // Restore video polling on mount for in-progress tasks
  useEffect(() => {
    storyboards.forEach(sb => {
      if (sb.videoTaskId && !sb.videoUrl && sb.videoStatus !== 'completed' && sb.videoStatus !== 'failed') {
        startVideoPolling(sb.id);
      }
    });
  }, [storyboards.map(s => s.id + s.videoTaskId + s.videoUrl).join(',')]);

  // ---- Expose Value ----
  const value: ProjectContextValue = {
    projectId,
    project, characters, scripts, storyboards, loading, error, activeTab,
    progressMap,
    streamingContent, streamingStatus,
    setActiveTab, loadData, updateProject, deleteProject,
    createCharacter, updateCharacter, deleteCharacter, generateCharacterPortrait,
    generateScript, deleteScript,
    generateStoryboards, generateStoryboardsWithOrder, generateImage, generateVideo,
    batchGenerateImages, batchGenerateVideos, batchDeleteStoryboards, deleteStoryboard, updateStoryboard,
    selectedStoryboards, toggleStoryboardSelection, toggleSelectAllStoryboards, setSelectedStoryboards,
    setScripts, setStoryboards,
    setStreamingContent, setStreamingStatus,
    generatingStoryboard, generatingImage, generatingVideo,
    batchGeneratingImages, batchGeneratingVideos, generatingScript, generatingCharacterImages,
    setError: localSetError, clearError,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
