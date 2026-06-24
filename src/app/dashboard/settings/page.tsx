'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';

export default function SettingsPage() {
  const [form, setForm] = useState({
    AGNES_API_BASE: '',
    AGNES_API_KEY: '',
    AGNES_TEXT_MODEL: '',
    AGNES_IMAGE_MODEL: '',
    AGNES_VIDEO_MODEL: '',
    IMAGE_EVAL_THRESHOLD: '60',
    IMAGE_MAX_RETRIES: '3',
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    apiGet('/api/settings')
      .then((data: any) => {
        setForm({
          AGNES_API_BASE: data.AGNES_API_BASE || 'https://apihub.agnes-ai.com/v1',
          AGNES_API_KEY: '',
          AGNES_TEXT_MODEL: data.AGNES_TEXT_MODEL || 'agnes-2.0-flash',
          AGNES_IMAGE_MODEL: data.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash',
          AGNES_VIDEO_MODEL: data.AGNES_VIDEO_MODEL || 'agnes-video-v2.0',
          IMAGE_EVAL_THRESHOLD: data.IMAGE_EVAL_THRESHOLD || '60',
          IMAGE_MAX_RETRIES: data.IMAGE_MAX_RETRIES || '3',
        });
        setHasApiKey(!!data.hasApiKey);
        setApiKeyMasked(data.apiKeyMasked || '');
        setLoading(false);
      })
      .catch(() => {
        setError('加载配置失败');
        setLoading(false);
      });
  }, []);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const data: any = await apiPost('/api/settings', form);
      if (data.success) {
        setTestResult({ ok: true, msg: '连接成功！模型回复正常' });
      } else {
        setTestResult({ ok: false, msg: data.error || '测试失败' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: '网络错误，请检查 API 地址' });
    }
    setTesting(false);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload: Record<string, string> = { ...form };
      if (!payload.AGNES_API_KEY) delete payload.AGNES_API_KEY;
      await apiPut('/api/settings', payload);
      setForm(f => ({ ...f, AGNES_API_KEY: '' }));
      setMessage('配置已成功保存');
      setTimeout(() => setMessage(''), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存配置失败，请检查网络连接');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-10 w-48 rounded bg-stone-200 animate-pulse mb-2"></div>
            <div className="h-5 w-32 rounded bg-stone-100 animate-pulse"></div>
          </div>
        </div>
        <div className="card h-96 p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 rounded skeleton"></div>
                <div className="h-12 w-full rounded skeleton"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">系统设置</h1>
          <p className="text-sm text-ink-secondary">配置 AI 模型 API 连接和参数</p>
        </div>
        <Link href="/dashboard" className="btn-secondary text-sm">
          <span className="mr-2">←</span>
          返回仪表盘
        </Link>
      </div>

      {/* API Configuration Card */}
      <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl">
            ⚙️
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">AI 模型配置</h2>
            <p className="text-sm text-ink-secondary">设置 Agnes AI 平台的 API 连接参数</p>
          </div>
        </div>

        <form onSubmit={saveSettings} className="space-y-6">
          {/* API Base URL */}
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              API 服务地址
            </label>
            <input
              className="input-field"
              value={form.AGNES_API_BASE}
              onChange={e => setForm({ ...form, AGNES_API_BASE: e.target.value })}
              placeholder="https://apihub.agnes-ai.com/v1"
            />
            <p className="text-xs text-ink-muted mt-2">API 服务的基础 URL 地址</p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              API 密钥
              {hasApiKey && (
                <span className="ml-3 text-xs font-normal text-ink-muted">
                  已配置 {apiKeyMasked}，留空则不修改
                </span>
              )}
            </label>
            <div className="relative">
              <input
                className="input-field pr-14"
                type={showKey ? 'text' : 'password'}
                value={form.AGNES_API_KEY}
                onChange={e => setForm({ ...form, AGNES_API_KEY: e.target.value })}
                placeholder={hasApiKey ? '••••••••（留空保持不变）' : '输入你的 Agnes AI API Key'}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors"
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-2">
              前往 <a href="https://platform.agnes-ai.com" target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">Agnes AI 平台</a> 注册并获取 API Key
            </p>
          </div>

          {/* Divider */}
          <hr className="border-border" />

          {/* Image Quality Settings */}
          <div>
            <h3 className="text-lg font-bold text-ink mb-4">图像质量与重试</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-flat p-4">
                <label className="block text-sm font-semibold text-ink-secondary mb-2">
                  评分阈值 (0-100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input-field text-sm"
                  value={form.IMAGE_EVAL_THRESHOLD}
                  onChange={e => setForm({ ...form, IMAGE_EVAL_THRESHOLD: e.target.value })}
                />
                <p className="text-xs text-ink-muted mt-2">低于该分数的图会自动重试，设为 -1 关闭评估</p>
              </div>
              <div className="card-flat p-4">
                <label className="block text-sm font-semibold text-ink-secondary mb-2">
                  最大重试次数
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="input-field text-sm"
                  value={form.IMAGE_MAX_RETRIES}
                  onChange={e => setForm({ ...form, IMAGE_MAX_RETRIES: e.target.value })}
                />
                <p className="text-xs text-ink-muted mt-2">未达阈值时最多重新生成多少次</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-border" />

          {/* Model Configuration */}
          <div>
            <h3 className="text-lg font-bold text-ink mb-4">模型配置</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Text Model */}
              <div className="card-flat p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📝</span>
                  <span className="font-semibold text-ink text-sm">文本模型</span>
                </div>
                <input
                  className="input-field text-sm"
                  value={form.AGNES_TEXT_MODEL}
                  onChange={e => setForm({ ...form, AGNES_TEXT_MODEL: e.target.value })}
                />
                <p className="text-xs text-ink-muted mt-2">用于剧本生成和对话创作</p>
              </div>

              {/* Image Model */}
              <div className="card-flat p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🖼️</span>
                  <span className="font-semibold text-ink text-sm">图像模型</span>
                </div>
                <input
                  className="input-field text-sm"
                  value={form.AGNES_IMAGE_MODEL}
                  onChange={e => setForm({ ...form, AGNES_IMAGE_MODEL: e.target.value })}
                />
                <p className="text-xs text-ink-muted mt-2">用于分镜画面和角色生成</p>
              </div>

              {/* Video Model */}
              <div className="card-flat p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🎬</span>
                  <span className="font-semibold text-ink text-sm">视频模型</span>
                </div>
                <input
                  className="input-field text-sm"
                  value={form.AGNES_VIDEO_MODEL}
                  onChange={e => setForm({ ...form, AGNES_VIDEO_MODEL: e.target.value })}
                />
                <p className="text-xs text-ink-muted mt-2">用于动态画面合成</p>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 animate-slide-up">
              <span className="text-xl">⚠️</span>
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}
          {message && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 animate-slide-up">
              <span className="text-xl">✅</span>
              <p className="text-emerald-700 font-medium">{message}</p>
            </div>
          )}
          {testResult && (
            <div className={`p-4 rounded-xl flex items-center gap-3 animate-slide-up ${
              testResult.ok
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <span className="text-xl">{testResult.ok ? '✅' : '❌'}</span>
              <p className={testResult.ok ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                {testResult.msg}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="btn-secondary flex-1 justify-center"
            >
              {testing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-border-strong border-t-emerald-500 rounded-full animate-spin"></span>
                  测试中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>🔌</span>
                  测试连接
                </span>
              )}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 justify-center"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  保存中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>💾</span>
                  保存配置
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info Card */}
      <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl flex-shrink-0">
            💡
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink mb-2">使用提示</h3>
            <div className="text-sm text-ink-secondary space-y-2 leading-relaxed">
              <p>• API 密钥仅保存在服务器端，页面不再回显明文</p>
              <p>• 建议定期轮换 API 密钥以确保账户安全</p>
              <p>• 如果连接测试失败，请检查 API 地址和密钥是否正确</p>
              <p>• 首次使用需要先保存配置才能生成内容</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
