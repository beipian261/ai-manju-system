'use client';
// SmartAssistant — AI 创作副驾驶（浮动助手）
// 纯白翡翠主题

import { useState, useRef, useEffect } from 'react';
import { apiPost } from '@/lib/utils/api-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: SuggestedAction[];
  followUpQuestions?: string[];
}

interface SuggestedAction {
  label: string;
  description: string;
  apiEndpoint: string;
  method: string;
  bodyTemplate?: Record<string, unknown>;
}

interface SmartAssistantProps {
  projectId?: string;
}

export default function SmartAssistant({ projectId }: SmartAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是漫剧创作助手 ✨\n\n你可以问我任何关于创作的问题，比如：\n- 怎么设计一个有辨识度的主角？\n- 如何让分镜更有冲击力？\n- 帮我规划一个悬疑故事的场景序列',
      followUpQuestions: ['怎么设计主角？', '场景怎么规划？', '提示词怎么写？'],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, messages]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const userMsg: Message = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    try {
      const data = await apiPost<{ reply: string; suggestedActions: SuggestedAction[]; followUpQuestions: string[] }>('/api/assistant/chat', { message: msg, history, ...(projectId ? { projectId } : {}) });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.reply || '抱歉，我暂时没有好的建议，可以换个问题试试。',
        suggestedActions: data.suggestedActions || [],
        followUpQuestions: data.followUpQuestions || [],
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `抱歉，出现了一个错误：${err instanceof Error ? err.message : '未知错误'}` }]);
    } finally { setLoading(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function renderContent(text: string) {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="font-semibold text-emerald-600">{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  }

  return (
    <>
      <button onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${open ? 'bg-emerald-600 hover:bg-emerald-700 rotate-180' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        title="智能创作助手">
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[560px] bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-base-bg">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">创作助手</p>
              <p className="text-xs text-ink-muted">AI 驱动 · 上下文感知</p>
            </div>
            <button onClick={() => setMessages([{ role: 'assistant', content: '对话已清除，重新开始吧！', followUpQuestions: ['怎么设计主角？', '场景怎么规划？'] }])}
              className="text-ink-muted hover:text-ink-secondary transition-colors text-xs">清除</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] flex flex-col gap-1">
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-emerald-500 text-white rounded-br-sm' : 'bg-base-bg text-ink-secondary border border-border rounded-bl-sm'}`}>
                    {renderContent(msg.content)}
                  </div>
                  {msg.role === 'assistant' && (msg.followUpQuestions?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(msg.followUpQuestions ?? []).map((q, qi) => (
                        <button key={qi} onClick={() => sendMessage(q)} disabled={loading}
                          className="text-xs px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50">{q}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-base-bg border border-border rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown} disabled={loading} placeholder="输入问题... (Enter 发送)" rows={1}
                className="flex-1 resize-none rounded-xl bg-base-bg border border-border text-sm text-ink placeholder-ink-muted px-3 py-2 focus:outline-none focus:border-emerald-400 transition-all max-h-24 overflow-y-auto disabled:opacity-50" style={{ minHeight: '40px' }} />
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl flex-shrink-0 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-1.5 text-center">Shift+Enter 换行 · Enter 发送</p>
          </div>
        </div>
      )}
    </>
  );
}
