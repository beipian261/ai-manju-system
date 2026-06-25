'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { User, Bell, Palette, Cpu, Shield, CreditCard, HelpCircle, Check } from 'lucide-react';

type SettingsTab = 'profile' | 'notifications' | 'appearance' | 'models' | 'privacy' | 'billing' | 'help';
type ModelOption = 'pro' | 'lite' | 'max';

interface ProfileForm {
  username: string;
  email: string;
  bio: string;
}

interface NotificationSettings {
  projectUpdates: boolean;
  emailNotifications: boolean;
  creationReminders: boolean;
}

interface ModelParams {
  creativity: number;
  imageQuality: number;
  characterConsistency: number;
  styleStrength: number;
}

const settingsTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: '个人资料', icon: <User className="w-4 h-4 shrink-0" /> },
  { id: 'notifications', label: '通知设置', icon: <Bell className="w-4 h-4 shrink-0" /> },
  { id: 'appearance', label: '外观偏好', icon: <Palette className="w-4 h-4 shrink-0" /> },
  { id: 'models', label: '模型配置', icon: <Cpu className="w-4 h-4 shrink-0" /> },
  { id: 'privacy', label: '隐私安全', icon: <Shield className="w-4 h-4 shrink-0" /> },
  { id: 'billing', label: '订阅与计费', icon: <CreditCard className="w-4 h-4 shrink-0" /> },
  { id: 'help', label: '帮助与支持', icon: <HelpCircle className="w-4 h-4 shrink-0" /> },
];

const modelOptions: { id: ModelOption; name: string; desc: string; recommended?: boolean }[] = [
  { id: 'pro', name: '漫剧 Pro', desc: '高质量，适合最终作品', recommended: true },
  { id: 'lite', name: '漫剧 Lite', desc: '快速生成，适合草稿' },
  { id: 'max', name: '漫剧 Max', desc: '最高质量，生成较慢' },
];

interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

function Slider({ value, onChange, label, min = 0, max = 1, step = 0.05 }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const updateValue = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newVal = min + (x / rect.width) * (max - min);
    const stepped = Math.round(newVal / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  }, [min, max, step, onChange]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => updateValue(e.clientX);
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, updateValue]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    updateValue(e.touches[0].clientX);
  }, [updateValue]);

  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</span>
        <span className="text-sm font-medium" style={{ color: 'var(--brand-primary)' }}>{value.toFixed(2)}</span>
      </div>
      <div
        ref={trackRef}
        className="relative w-full rounded-full cursor-pointer"
        style={{ height: '6px', background: 'var(--color-bg-subtle-2)' }}
        onMouseDown={(e) => { setIsDragging(true); updateValue(e.clientX); }}
        onTouchStart={(e) => { setIsDragging(true); updateValue(e.touches[0].clientX); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setIsDragging(false)}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-100"
          style={{ width: `${percentage}%`, background: 'var(--gradient-primary)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-100"
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid var(--brand-primary)',
            left: `calc(${percentage}% - 8px)`,
            boxShadow: isDragging ? '0 0 0 4px rgba(16,185,129,0.15)' : '0 1px 4px rgba(0,0,0,0.1)',
            transform: `translateY(-50%) scale(${isDragging ? 1.1 : 1})`,
          }}
        />
      </div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full relative shrink-0 cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
      style={{ background: checked ? 'var(--brand-primary)' : 'var(--color-border)' }}
      aria-pressed={checked}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ left: checked ? 'auto' : '2px', right: checked ? '2px' : 'auto' }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [profile, setProfile] = useState<ProfileForm>({
    username: '创作者',
    email: 'creator@example.com',
    bio: 'AI 漫剧创作者，热爱科幻与奇幻故事。',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    projectUpdates: true,
    emailNotifications: true,
    creationReminders: false,
  });

  const [selectedModel, setSelectedModel] = useState<ModelOption>('pro');

  const [modelParams, setModelParams] = useState<ModelParams>({
    creativity: 0.7,
    imageQuality: 0.85,
    characterConsistency: 0.95,
    styleStrength: 0.6,
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setSaveMessage('已保存');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const lastSaved = '2026年6月20日';

  const handleTabClick = (tabId: SettingsTab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <nav
        className="sticky top-0 z-50 border-b relative"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(226,232,240,0.5)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <a href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>A</div>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>AI 漫剧</span>
          </a>

          <button
            className="md:hidden flex items-center justify-center rounded-lg"
            style={{ width: '36px', height: '36px', background: 'var(--color-bg-subtle)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="菜单"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-secondary)' }}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <div className="hidden md:flex items-center gap-8">
            <a href="/dashboard" className="text-sm transition-colors duration-150 hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>工作台</a>
            <a href="/dashboard/projects" className="text-sm transition-colors duration-150 hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>项目</a>
            <a href="/dashboard/characters" className="text-sm transition-colors duration-150 hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>角色库</a>
            <a href="/dashboard/settings" className="text-sm font-semibold relative pb-0.5" style={{ color: 'var(--color-text)' }}>
              设置
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--brand-primary)' }} />
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>C</div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 border-b animate-fade-in" style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', borderColor: 'var(--color-border)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1">
              <a className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ color: 'var(--color-text-secondary)' }} href="/dashboard">工作台</a>
              <a className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ color: 'var(--color-text-secondary)' }} href="/dashboard/projects">项目</a>
              <a className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ color: 'var(--color-text-secondary)' }} href="/dashboard/characters">角色库</a>
              <a className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: 'var(--color-text)', background: 'rgba(16,185,129,0.08)' }} href="/dashboard/settings">设置</a>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 flex flex-col md:flex-row gap-6 md:gap-8">
        <aside className="w-full md:w-48 shrink-0">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0 -mx-1 px-1">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all duration-150 ${
                  activeTab === tab.id ? 'font-medium' : ''
                }`}
                style={{
                  background: activeTab === tab.id ? 'var(--gradient-primary-soft)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 animate-fade-in" key={activeTab}>
          {activeTab === 'profile' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>个人资料</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>管理你的账户信息</p>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--color-bg-subtle)',
                    border: '2px solid transparent',
                    backgroundClip: 'padding-box',
                    boxShadow: '0 0 0 2px var(--brand-primary), 0 0 0 4px var(--brand-primary-light)',
                  }}
                >
                  <User className="w-7 h-7" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="text-sm rounded-lg px-3 py-1.5 transition-colors duration-150 hover:opacity-80"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-bg)' }}
                  >
                    更换头像
                  </button>
                  <button
                    className="text-xs transition-colors duration-150 hover:opacity-70"
                    style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="mt-8 max-w-lg">
                <div className="mb-5">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>用户名</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-shadow duration-150 focus:ring-2"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      // @ts-expect-error css var
                      '--tw-ring-color': 'rgba(16,185,129,0.3)',
                    }}
                  />
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>邮箱</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-shadow duration-150 focus:ring-2"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      // @ts-expect-error css var
                      '--tw-ring-color': 'rgba(16,185,129,0.3)',
                    }}
                  />
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>个人简介</label>
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none transition-shadow duration-150 focus:ring-2"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      // @ts-expect-error css var
                      '--tw-ring-color': 'rgba(16,185,129,0.3)',
                    }}
                  />
                </div>
              </div>

              <div className="my-6" style={{ borderBottom: '1px solid var(--color-border)' }} />

              <div>
                <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>通知设置</h2>

                <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>项目更新通知</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>当项目有新动态时通知你</p>
                  </div>
                  <Toggle checked={notifications.projectUpdates} onChange={(v) => setNotifications({ ...notifications, projectUpdates: v })} />
                </div>

                <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>邮件通知</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>接收重要更新和新闻邮件</p>
                  </div>
                  <Toggle checked={notifications.emailNotifications} onChange={(v) => setNotifications({ ...notifications, emailNotifications: v })} />
                </div>

                <div className="flex justify-between items-center py-3">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>创作提醒</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>每日创作提醒推送</p>
                  </div>
                  <Toggle checked={notifications.creationReminders} onChange={(v) => setNotifications({ ...notifications, creationReminders: v })} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '32px', paddingTop: '32px' }}>
                <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>模型配置</h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>调整 AI 生成模型参数</p>

                <div className="mt-6">
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>生成模型</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {modelOptions.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSelectedModel(model.id)}
                        className="rounded-xl p-4 text-center cursor-pointer transition-all duration-200"
                        style={{
                          border: selectedModel === model.id ? '2px solid var(--brand-primary)' : '2px solid var(--color-border)',
                          background: selectedModel === model.id ? 'var(--gradient-primary-soft)' : 'white',
                        }}
                      >
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{model.name}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{model.desc}</p>
                        {model.recommended && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap mt-2"
                            style={{ background: 'var(--gradient-primary)' }}
                          >
                            推荐
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>生成参数</p>
                  <Slider value={modelParams.creativity} onChange={(v) => setModelParams({ ...modelParams, creativity: v })} label="创意度" />
                  <Slider value={modelParams.imageQuality} onChange={(v) => setModelParams({ ...modelParams, imageQuality: v })} label="画面精度" />
                  <Slider value={modelParams.characterConsistency} onChange={(v) => setModelParams({ ...modelParams, characterConsistency: v })} label="角色一致性" />
                  <div className="py-4">
                    <Slider value={modelParams.styleStrength} onChange={(v) => setModelParams({ ...modelParams, styleStrength: v })} label="风格强度" />
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
                    style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-button)' }}
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        保存中...
                      </>
                    ) : saveMessage ? (
                      <>
                        <Check className="w-4 h-4" />
                        已保存
                      </>
                    ) : (
                      '保存更改'
                    )}
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>最后保存于 {lastSaved}</p>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>通知设置</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>管理你的通知偏好</p>
              </div>
              <div className="mt-6 max-w-lg">
                <div className="flex justify-between items-center py-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>项目更新通知</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>当项目有新动态时通知你</p>
                  </div>
                  <Toggle checked={notifications.projectUpdates} onChange={(v) => setNotifications({ ...notifications, projectUpdates: v })} />
                </div>
                <div className="flex justify-between items-center py-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>邮件通知</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>接收重要更新和新闻邮件</p>
                  </div>
                  <Toggle checked={notifications.emailNotifications} onChange={(v) => setNotifications({ ...notifications, emailNotifications: v })} />
                </div>
                <div className="flex justify-between items-center py-4">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>创作提醒</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>每日创作提醒推送</p>
                  </div>
                  <Toggle checked={notifications.creationReminders} onChange={(v) => setNotifications({ ...notifications, creationReminders: v })} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>外观偏好</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>自定义界面外观</p>
              </div>
              <div className="mt-6 max-w-lg">
                <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-subtle)' }}>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>主题模式</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button className="rounded-lg p-3 text-center transition-all duration-200" style={{ border: '2px solid var(--brand-primary)', background: 'var(--gradient-primary-soft)' }}>
                      <span className="text-2xl">☀️</span>
                      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text)' }}>浅色</p>
                    </button>
                    <button className="rounded-lg p-3 text-center transition-all duration-200" style={{ border: '2px solid var(--color-border)', background: 'white' }}>
                      <span className="text-2xl">🌙</span>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>深色</p>
                    </button>
                    <button className="rounded-lg p-3 text-center transition-all duration-200" style={{ border: '2px solid var(--color-border)', background: 'white' }}>
                      <span className="text-2xl">🖥️</span>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>跟随系统</p>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'models' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>模型配置</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>调整 AI 生成模型参数</p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>生成模型</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {modelOptions.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModel(model.id)}
                      className="rounded-xl p-4 text-center cursor-pointer transition-all duration-200"
                      style={{
                        border: selectedModel === model.id ? '2px solid var(--brand-primary)' : '2px solid var(--color-border)',
                        background: selectedModel === model.id ? 'var(--gradient-primary-soft)' : 'white',
                      }}
                    >
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{model.name}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{model.desc}</p>
                      {model.recommended && (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap mt-2"
                          style={{ background: 'var(--gradient-primary)' }}
                        >
                          推荐
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 max-w-lg">
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>生成参数</p>
                <Slider value={modelParams.creativity} onChange={(v) => setModelParams({ ...modelParams, creativity: v })} label="创意度" />
                <Slider value={modelParams.imageQuality} onChange={(v) => setModelParams({ ...modelParams, imageQuality: v })} label="画面精度" />
                <Slider value={modelParams.characterConsistency} onChange={(v) => setModelParams({ ...modelParams, characterConsistency: v })} label="角色一致性" />
                <div className="py-4">
                  <Slider value={modelParams.styleStrength} onChange={(v) => setModelParams({ ...modelParams, styleStrength: v })} label="风格强度" />
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
                  style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-button)' }}
                >
                  {saving ? '保存中...' : saveMessage ? '已保存' : '保存更改'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'privacy' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>隐私安全</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>管理你的隐私和安全设置</p>
              </div>
              <div className="mt-6 max-w-lg space-y-4">
                <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>修改密码</h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>定期修改密码以保护账户安全</p>
                  <button className="btn-secondary text-sm">修改密码</button>
                </div>
                <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>数据导出</h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>导出你的所有项目和角色数据</p>
                  <button className="btn-secondary text-sm">导出数据</button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'billing' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>订阅与计费</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>管理你的订阅和账单信息</p>
              </div>
              <div className="mt-6">
                <div className="rounded-xl p-6" style={{ border: '2px solid var(--brand-primary)', background: 'var(--gradient-primary-soft)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>当前方案：Pro 专业版</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>有效期至 2026年12月31日</p>
                    </div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: 'var(--gradient-primary)' }}>
                      已订阅
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>∞</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>项目数量</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>1000</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>图片生成/月</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>100</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>视频生成/月</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'help' && (
            <>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>帮助与支持</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>获取帮助和联系我们</p>
              </div>
              <div className="mt-6 max-w-lg space-y-3">
                {[
                  { title: '使用指南', desc: '查看详细的使用文档和教程', icon: '📖' },
                  { title: '常见问题', desc: '解答常见使用问题', icon: '❓' },
                  { title: '联系客服', desc: '通过邮件或在线聊天联系我们', icon: '💬' },
                  { title: '意见反馈', desc: '告诉我们你的想法和建议', icon: '💡' },
                ].map((item) => (
                  <button key={item.title} className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 hover:-translate-y-0.5" style={{ border: '1px solid var(--color-border)', background: 'white' }}>
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                    </div>
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
