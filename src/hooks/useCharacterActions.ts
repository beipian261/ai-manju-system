'use client';
import { useCallback, useState } from 'react';
import type { Character } from '@/app/dashboard/projects/[id]/types';

interface UseCharacterActionsResult {
  generatingCharacterImages: Set<string>;
  createCharacter: (data: Partial<Character> & { name: string }) => Promise<void>;
  updateCharacter: (id: string, data: Partial<Character>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  generateCharacterPortrait: (characterId: string, name: string) => Promise<void>;
}

export function useCharacterActions(
  projectId: string,
  loadData: () => Promise<void>
): UseCharacterActionsResult {
  const [generatingCharacterImages, setGeneratingCharacterImages] = useState<Set<string>>(new Set());

  const createCharacter = useCallback(async (data: Partial<Character> & { name: string }) => {
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
    setGeneratingCharacterImages(prev => new Set(prev).add(characterId));
    try {
      const res = await fetch(`/api/characters/${characterId}/generate-image`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '生成失败');
      }
      await loadData();
    } finally {
      setGeneratingCharacterImages(prev => { const n = new Set(prev); n.delete(characterId); return n; });
    }
  }, [loadData]);

  return { generatingCharacterImages, createCharacter, updateCharacter, deleteCharacter, generateCharacterPortrait };
}
