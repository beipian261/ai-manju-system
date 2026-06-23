'use client';
// ConfirmDialog — 确认对话框 Hook
// 纯白极简主题

import { useCallback, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    open: false,
    options: { title: '', message: '' },
  });

  const showConfirm = useCallback(
    (title: string, message: string, opts?: Omit<ConfirmOptions, 'title' | 'message'>): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({ open: true, options: { title, message, confirmText: opts?.confirmText || '确定', danger: opts?.danger ?? true }, resolve });
      });
    }, []
  );

  const handleResult = useCallback((result: boolean) => {
    state.resolve?.(result);
    setState({ open: false, options: { title: '', message: '' } });
  }, [state]);

  const dialog = state.open ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => handleResult(false)}>
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white border border-border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink mb-2">{state.options.title}</h3>
        <p className="text-sm text-ink-secondary mb-6 leading-relaxed">{state.options.message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => handleResult(false)} className="btn-secondary btn-sm px-4">取消</button>
          <button onClick={() => handleResult(true)}
            className={`btn-sm px-4 ${state.options.danger ? 'btn-danger' : 'btn-primary'}`}>
            {state.options.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { showConfirm, dialog };
}
