'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Project, Character, Script, Storyboard } from '@/app/dashboard/projects/[id]/types';

interface UseProjectDataResult {
  project: Project | null;
  characters: Character[];
  scripts: Script[];
  storyboards: Storyboard[];
  loading: boolean;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  setStoryboards: React.Dispatch<React.SetStateAction<Storyboard[]>>;
  loadData: () => Promise<void>;
}

export function useProjectData(projectId: string, setError: (msg: string) => void): UseProjectDataResult {
  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [projectId, setError]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  return {
    project, characters, scripts, storyboards, loading,
    setProject, setCharacters, setScripts, setStoryboards,
    loadData,
  };
}
