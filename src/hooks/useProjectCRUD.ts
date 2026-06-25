'use client';
import { useCallback } from 'react';
import type { Project } from '@/app/dashboard/projects/[id]/types';

interface UseProjectCRUDResult {
  updateProject: (fields: Partial<Project>) => Promise<void>;
  deleteProject: () => Promise<void>;
}

export function useProjectCRUD(
  projectId: string,
  setProject: React.Dispatch<React.SetStateAction<Project | null>>
): UseProjectCRUDResult {
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
  }, [projectId, setProject]);

  const deleteProject = useCallback(async () => {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    window.location.href = '/dashboard/projects';
  }, [projectId]);

  return { updateProject, deleteProject };
}
