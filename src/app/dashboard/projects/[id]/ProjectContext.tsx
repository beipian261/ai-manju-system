// ============================================================
// ProjectContext — 项目详情页的全局状态管理中心
//
// 职责：
// - 组合多个专注的 hooks，提供统一的 Context 接口
// - 保持 Context 接口不变，消费组件无需修改
//
// 拆分后的 hooks：
// - useProjectData: 数据加载
// - useProgress: SSE 进度订阅 + 轮询
// - useProjectCRUD: 项目更新/删除
// - useCharacterActions: 角色 CRUD + 头像生成
// - useScriptActions: 剧本生成 + 流式状态
// - useStoryboardActions: 分镜/图片/视频操作 + 视频轮询
// - useSelection: 分镜多选状态
// ============================================================

'use client';
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Character, Script, Storyboard, ProgressInfo, TabKey } from './types';
import { useProjectData } from '@/hooks/useProjectData';
import { useProgress } from '@/hooks/useProgress';
import { useProjectCRUD } from '@/hooks/useProjectCRUD';
import { useCharacterActions } from '@/hooks/useCharacterActions';
import { useScriptActions } from '@/hooks/useScriptActions';
import { useStoryboardActions } from '@/hooks/useStoryboardActions';
import { useSelection } from '@/hooks/useSelection';

// ---- Context Types (保持接口完全不变) ----

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
  createCharacter: (data: Partial<Character> & { name: string }) => Promise<void>;
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
  reorderStoryboards: (orderedIds: string[]) => Promise<void>;

  // Streaming preview helpers
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  setStoryboards: React.Dispatch<React.SetStateAction<Storyboard[]>>;

  // Streaming state setters
  setStreamingContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setStreamingStatus: React.Dispatch<React.SetStateAction<Record<string, 'idle' | 'streaming' | 'completed'>>>;

  // Selection state
  selectedStoryboards: Set<string>;
  toggleStoryboardSelection: (id: string) => void;
  toggleSelectAllStoryboards: () => void;
  setSelectedStoryboards: (ids: Set<string>) => void;

  // Loading states
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
  // ---- UI State ----
  const [error, setErrorState] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const setError = useCallback((msg: string) => setErrorState(msg), []);
  const clearError = useCallback(() => setErrorState(''), []);

  // ---- Data Loading ----
  const {
    project, characters, scripts, storyboards, loading,
    setProject, setScripts, setStoryboards,
    loadData,
  } = useProjectData(projectId, setError);

  // ---- Refs for async access ----
  const storyboardsRef = useRef(storyboards);
  const charactersRef = useRef(characters);
  const scriptsRef = useRef(scripts);
  useEffect(() => { storyboardsRef.current = storyboards; }, [storyboards]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => { scriptsRef.current = scripts; }, [scripts]);

  // ---- Progress Tracking (SSE + polling) ----
  const { progressMap, progressMapRef } = useProgress(projectId, loadData);

  // ---- Selection ----
  const {
    selectedStoryboards, toggleStoryboardSelection, toggleSelectAllStoryboards, setSelectedStoryboards,
  } = useSelection(storyboards);

  // ---- Project CRUD ----
  const { updateProject, deleteProject } = useProjectCRUD(projectId, setProject);

  // ---- Character Actions ----
  const {
    generatingCharacterImages, createCharacter, updateCharacter, deleteCharacter, generateCharacterPortrait,
  } = useCharacterActions(projectId, loadData);

  // ---- Script Actions ----
  const {
    generatingScript, streamingContent, streamingStatus,
    setStreamingContent, setStreamingStatus,
    generateScript, deleteScript,
  } = useScriptActions(projectId, loadData, scriptsRef);

  // ---- Storyboard Actions (includes image/video generation, video polling) ----
  const {
    generatingStoryboard, generatingImage, generatingVideo,
    batchGeneratingImages, batchGeneratingVideos,
    generateStoryboards, generateStoryboardsWithOrder, generateImage, generateVideo,
    batchGenerateImages, batchGenerateVideos, batchDeleteStoryboards, deleteStoryboard, updateStoryboard,
    reorderStoryboards,
  } = useStoryboardActions(
    projectId, loadData,
    storyboardsRef as React.MutableRefObject<Storyboard[]>,
    charactersRef as React.MutableRefObject<Character[]>,
    progressMapRef,
    setStoryboards, setSelectedStoryboards,
    setError, clearError
  );

  // ---- Expose Value (保持完全相同的接口) ----
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
    reorderStoryboards,
    selectedStoryboards, toggleStoryboardSelection, toggleSelectAllStoryboards, setSelectedStoryboards,
    setScripts, setStoryboards,
    setStreamingContent, setStreamingStatus,
    generatingStoryboard, generatingImage, generatingVideo,
    batchGeneratingImages, batchGeneratingVideos, generatingScript, generatingCharacterImages,
    setError, clearError,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
