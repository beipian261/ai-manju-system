'use client';
// ============================================================
// useProjectPage — 子页面统一获取项目数据的 Hook
// 替代 director/review/timeline/voice/publish 页面中
// 重复的 `useParams + fetch + loading state` 代码
// ============================================================

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Project, Character, Script, Storyboard } from '../../app/dashboard/projects/[id]/types';

interface ProjectPageData {
  project: Project | null;
  characters: Character[];
  scripts: Script[];
  storyboards: Storyboard[];
  loading: boolean;
  error: string;
}

interface UseProjectPageResult extends ProjectPageData {
  projectId: string;
  router: ReturnType<typeof useRouter>;
}

export function useProjectPage(): UseProjectPageResult {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [data, setData] = useState<ProjectPageData>({
    project: null, characters: [], scripts: [], storyboards: [], loading: true, error: '',
  });

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setData(d => ({ ...d, loading: true }));

    Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch(`/api/storyboards?projectId=${projectId}`).then(r => r.json()),
    ]).then(([projectData, storyboardData]) => {
      if (cancelled) return;
      setData({
        project: projectData,
        characters: projectData?.characters || [],
        scripts: projectData?.scripts || [],
        storyboards: Array.isArray(storyboardData) ? storyboardData : [],
        loading: false,
        error: '',
      });
    }).catch(() => {
      if (cancelled) return;
      setData(d => ({ ...d, loading: false, error: '加载失败' }));
    });

    return () => { cancelled = true; };
  }, [projectId]);

  return {
    projectId,
    project: data.project,
    characters: data.characters,
    scripts: data.scripts,
    storyboards: data.storyboards,
    loading: data.loading,
    error: data.error,
    router,
  };
}

// 在任意页面导航到 project 子页面
export function useProjectNavigation() {
  const params = useParams();
  const projectId = params?.id as string;
  const router = useRouter();

  const goTo = useCallback((tab: string) => {
    router.push(`/dashboard/projects/${projectId}?tab=${tab}`);
  }, [projectId, router]);

  return { goTo, projectId, router };
}
