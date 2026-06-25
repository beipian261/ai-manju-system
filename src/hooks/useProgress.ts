'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgressInfo } from '@/app/dashboard/projects/[id]/types';

interface UseProgressResult {
  progressMap: Record<string, ProgressInfo>;
  progressMapRef: React.MutableRefObject<Record<string, ProgressInfo>>;
  setBatchGeneratingImages: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useProgress(
  projectId: string,
  loadData: () => Promise<void>,
  setBatchGeneratingImagesExternal?: React.Dispatch<React.SetStateAction<boolean>>
): UseProgressResult {
  const [progressMap, setProgressMap] = useState<Record<string, ProgressInfo>>({});
  const progressMapRef = useRef<Record<string, ProgressInfo>>({});
  const sseRef = useRef<EventSource | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);
  const [batchGeneratingImages, setBatchGeneratingImages] = useState(false);

  const setBatchImages = setBatchGeneratingImagesExternal || setBatchGeneratingImages;

  useEffect(() => { progressMapRef.current = progressMap; }, [progressMap]);

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
            if (data.type === 'image' && data.id?.startsWith('batch_')) {
              setBatchImages(false);
            }
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
  }, [projectId, loadData, setBatchImages]);

  useEffect(() => {
    pollTimer.current = setInterval(loadData, 8000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [loadData]);

  return { progressMap, progressMapRef, setBatchGeneratingImages: setBatchImages };
}
