'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params?.get('next') || '/dashboard';

  const safeNext =
    typeof rawNext === 'string' &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\') &&
    rawNext !== '/login'
      ? rawNext
      : '/dashboard';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setEnabled(Boolean(data.enabled));
        if (!data.enabled) {
          router.replace(safeNext);
        } else if (data.authed) {
          router.replace(safeNext);
        }
      })
      .catch(() => setError('无法检查鉴权状态'));
  }, [router, safeNext]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }
      router.replace(safeNext);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }

  if (enabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-border-strong border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-ink-secondary text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left - Brand */}
      <div className="hidden md:flex flex-1 bg-gradient-to-br from-emerald-50 to-white items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-5 shadow-lg shadow-emerald-200">
            A
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">AI 漫剧系统</h2>
          <p className="text-ink-secondary leading-relaxed">
            用 AI 释放你的创意<br/>
            从故事到成片，一键生成
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-ink mb-1">欢迎回来</h2>
          <p className="text-sm text-ink-secondary mb-8">登录你的账号</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">密码</label>
              <input
                type="password"
                className="input-field"
                placeholder="输入登录密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-border-strong border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
