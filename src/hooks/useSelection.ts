'use client';
import { useCallback, useState } from 'react';
import type { Storyboard } from '@/app/dashboard/projects/[id]/types';

interface UseSelectionResult {
  selectedStoryboards: Set<string>;
  toggleStoryboardSelection: (id: string) => void;
  toggleSelectAllStoryboards: () => void;
  setSelectedStoryboards: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useSelection(storyboards: Storyboard[]): UseSelectionResult {
  const [selectedStoryboards, setSelectedStoryboards] = useState<Set<string>>(new Set());

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

  return {
    selectedStoryboards,
    toggleStoryboardSelection,
    toggleSelectAllStoryboards,
    setSelectedStoryboards,
  };
}
