'use client';
import { useCallback, useRef, useState } from 'react';
import type { Script } from '@/app/dashboard/projects/[id]/types';

interface UseScriptActionsResult {
  generatingScript: boolean;
  streamingContent: Record<string, string>;
  streamingStatus: Record<string, 'idle' | 'streaming' | 'completed'>;
  setStreamingContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setStreamingStatus: React.Dispatch<React.SetStateAction<Record<string, 'idle' | 'streaming' | 'completed'>>>;
  generateScript: (outline: string) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
}

export function useScriptActions(
  projectId: string,
  loadData: () => Promise<void>,
  scriptsRef: React.MutableRefObject<Script[]>
): UseScriptActionsResult {
  const [generatingScript, setGeneratingScript] = useState(false);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [streamingStatus, setStreamingStatus] = useState<Record<string, 'idle' | 'streaming' | 'completed'>>({});

  const generateScript = useCallback(async (outline: string) => {
    setGeneratingScript(true);
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
  }, [projectId, loadData, scriptsRef]);

  const deleteScript = useCallback(async (id: string) => {
    await fetch(`/api/scripts/${id}`, { method: 'DELETE' });
    await loadData();
  }, [loadData]);

  return {
    generatingScript,
    streamingContent, streamingStatus,
    setStreamingContent, setStreamingStatus,
    generateScript, deleteScript,
  };
}
