# AI 漫剧系统 — UI 重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**目标**: 将项目 UI 从当前的紫粉深色 + 暖白琥珀混搭风格，统一为纯白极简 + 翡翠绿强调的全新设计系统

**架构**: 从底层设计 Token 开始，逐层向上更新：Tailwind 配置 → 全局 CSS → 通用 UI 组件 → 导航栏 → 各页面

**技术栈**: Next.js 14 (App Router) + TypeScript + TailwindCSS 3.4

---

### 任务 0: 更新 Tailwind 配置 — 色板/阴影/圆角

**文件:**
- 修改: `tailwind.config.js`

- [ ] **步骤 1: 替换 tailwind.config.js 中的 color 系统**

将当前的 amber/stone 主色 + 废弃 indigo/purple 注释，替换为以白色/灰色为基底、emerald 为强调色的设计 Token：

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ===== Pure White + Emerald Design System =====
        // Base
        base: {
          white: '#FFFFFF',
          bg: '#FAFAFA',
          'bg-subtle': '#F5F5F5',
        },
        // Border
        border: {
          DEFAULT: '#F0F0F0',
          strong: '#E4E4E7',
          input: '#D4D4D8',
        },
        // Text
        ink: {
          DEFAULT: '#18181B',
          secondary: '#71717A',
          muted: '#A1A1AA',
          placeholder: '#D4D4D8',
        },
        // Emerald accent (replaces previous amber primary)
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Semantic colors
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        // Retain stone for compatibility
        stone: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E8E6E3',
          300: '#D6D3D1',
          400: '#A8A39E',
          500: '#78706C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'button': '0 2px 8px rgba(16, 185, 129, 0.2)',
        'button-lg': '0 4px 16px rgba(16, 185, 129, 0.25)',
        'glow-emerald': '0 0 0 3px rgba(16, 185, 129, 0.12)',
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '14px',
        'button': '10px',
        'input': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **步骤 2: 验证 Tailwind 配置正确**

运行: `npx tailwindcss --help`（确认无语法错误）

---

### 任务 1: 重写全局 CSS — 纯白极简主题

**文件:**
- 修改: `src/app/globals.css`

- [ ] **步骤 1: 替换 globals.css 内容为纯白极简主题**

将当前以深色背景 + 紫粉渐变为主的 CSS，替换为以纯白 + 翡翠绿为主的样式：

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

html, body {
  scroll-behavior: smooth;
}

body {
  font-family: 'DM Sans', 'Inter', system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #ffffff;
  color: #18181B;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== Pure White Design System ===== */
@layer components {

  /* ---------- Cards ---------- */
  .card {
    @apply rounded-card border transition-all duration-200;
    background: #ffffff;
    border-color: #F0F0F0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .card:hover {
    border-color: #D1FAE5;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);
  }

  .card-subtle {
    @apply rounded-card border;
    background: #FAFAFA;
    border-color: #F0F0F0;
  }

  .card-emerald {
    @apply rounded-card border;
    background: #FAFEFC;
    border-color: #D1FAE5;
  }

  .card-flat {
    @apply rounded-card;
    background: #FAFAFA;
  }

  /* ---------- Buttons ---------- */
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-button font-semibold text-sm text-white transition-all duration-200;
    background: #10b981;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
  }
  .btn-primary:hover:not(:disabled) {
    background: #059669;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
    transform: translateY(-1px);
  }
  .btn-primary:disabled {
    @apply opacity-40 cursor-not-allowed;
    transform: none;
  }

  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-button font-semibold text-sm transition-all duration-200;
    background: transparent;
    border: 1px solid #D4D4D8;
    color: #52525B;
  }
  .btn-secondary:hover:not(:disabled) {
    border-color: #10b981;
    color: #10b981;
    background: rgba(16, 185, 129, 0.04);
  }

  .btn-ghost {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200;
    color: #71717A;
  }
  .btn-ghost:hover {
    background: rgba(0, 0, 0, 0.04);
    color: #18181B;
  }

  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-button font-semibold text-sm text-white transition-all duration-200;
    background: #EF4444;
  }
  .btn-danger:hover:not(:disabled) {
    background: #DC2626;
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
    transform: translateY(-1px);
  }

  .btn-sm {
    @apply px-3 py-1.5 text-xs rounded-lg;
  }

  .btn-lg {
    @apply px-7 py-3.5 text-base rounded-button;
  }

  /* ---------- Inputs ---------- */
  .input-field {
    @apply w-full px-4 py-2.5 rounded-input text-sm outline-none transition-all duration-200;
    background: #ffffff;
    border: 1px solid #D4D4D8;
    color: #18181B;
  }
  .input-field::placeholder {
    color: #D4D4D8;
  }
  .input-field:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
  }

  .textarea-field {
    @apply w-full px-4 py-2.5 rounded-input text-sm outline-none resize-none leading-relaxed transition-all duration-200;
    background: #ffffff;
    border: 1px solid #D4D4D8;
    color: #18181B;
  }
  .textarea-field::placeholder {
    color: #D4D4D8;
  }
  .textarea-field:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
  }

  .select-field {
    @apply w-full px-4 py-2.5 rounded-input text-sm outline-none transition-all duration-200 appearance-none;
    background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center;
    border: 1px solid #D4D4D8;
    color: #18181B;
  }
  .select-field:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
  }

  /* ---------- Badges ---------- */
  .badge {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium;
  }
  .badge-emerald {
    background: #F0FDF4;
    color: #10B981;
    border: 1px solid #BBF7D0;
  }
  .badge-zinc {
    background: #FAFAFA;
    color: #71717A;
    border: 1px solid #E4E4E7;
  }
  .badge-amber {
    background: #FFFBEB;
    color: #D97706;
    border: 1px solid #FDE68A;
  }
  .badge-blue {
    background: #EFF6FF;
    color: #3B82F6;
    border: 1px solid #BFDBFE;
  }
  .badge-purple {
    background: #F5F3FF;
    color: #8B5CF6;
    border: 1px solid #DDD6FE;
  }
  .badge-red {
    background: #FEF2F2;
    color: #EF4444;
    border: 1px solid #FECACA;
  }
  .badge-green {
    background: #F0FDF4;
    color: #10B981;
    border: 1px solid #BBF7D0;
  }
  .badge-pink {
    background: #FDF2F8;
    color: #EC4899;
    border: 1px solid #FBCFE8;
  }

  /* ---------- Tabs ---------- */
  .tab-item {
    @apply px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer relative;
    color: #71717A;
  }
  .tab-item:hover {
    color: #52525B;
  }
  .tab-item.active {
    color: #18181B;
  }
  .tab-item.active::after {
    content: '';
    @apply absolute bottom-0 left-0 right-0 h-0.5;
    background: #10b981;
    border-radius: 1px 1px 0 0;
  }

  /* ---------- Progress Bar ---------- */
  .progress-track {
    @apply w-full rounded-full overflow-hidden;
    background: #F0F0F0;
  }
  .progress-track.sm { height: 4px; }
  .progress-track.md { height: 6px; }
  .progress-track.lg { height: 8px; }
  .progress-fill {
    @apply h-full rounded-full transition-all duration-500;
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  /* ---------- Dividers ---------- */
  .divider {
    @apply w-full;
    border-top: 1px solid #F0F0F0;
  }

  /* ---------- Text Gradient ---------- */
  .text-gradient {
    @apply bg-clip-text text-transparent;
    background-image: linear-gradient(135deg, #10b981, #34d399);
  }

  /* ---------- Section ---------- */
  .section-title {
    @apply text-lg font-semibold text-ink;
  }
  .section-subtitle {
    @apply text-sm text-ink-secondary;
  }

  /* ---------- Sidebar Nav ---------- */
  .nav-item {
    @apply flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200;
    color: #71717A;
  }
  .nav-item:hover {
    background: #F5F5F5;
    color: #18181B;
  }
  .nav-item.active {
    background: #F0FDF4;
    color: #10B981;
    font-weight: 600;
  }

  /* ---------- Stats Card ---------- */
  .stat-card {
    @apply rounded-card border p-4;
    background: #ffffff;
    border-color: #F0F0F0;
  }
  .stat-card-highlight {
    @apply rounded-card border p-4;
    background: #FAFEFC;
    border-color: #D1FAE5;
  }
}

/* ===== Animations ===== */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

/* Stagger animation delays */
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
```

- [ ] **步骤 2: 验证 globals.css 语法正确**

无运行时错误即可。

---

### 任务 2: 更新 UI 组件 — Button / Card / Badge

**文件:**
- 修改: `src/components/ui/Button.tsx`
- 修改: `src/components/ui/Card.tsx`
- 修改: `src/components/ui/Badge.tsx`

- [ ] **步骤 1: 更新 Button.tsx**

保持组件接口不变，仅将 CSS 类名映射更新为新设计：

```tsx
// Button.tsx — 纯白极简主题
import { type ReactNode, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          <span>处理中...</span>
        </>
      ) : (
        <>
          {icon && <span className="text-base">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
```

- [ ] **步骤 2: 更新 Card.tsx**

```tsx
// Card.tsx — 纯白极简主题
import { type ReactNode } from 'react';

export type CardVariant = 'default' | 'subtle' | 'emerald' | 'flat';

interface CardProps {
  variant?: CardVariant;
  title?: string;
  subtitle?: string;
  icon?: string | ReactNode;
  children?: ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'card',
  subtle: 'card-subtle',
  emerald: 'card-emerald',
  flat: 'card-flat',
};

export function Card({
  variant = 'default',
  title,
  subtitle,
  icon,
  children,
  className = '',
  padding = true,
  hover = true,
  style,
}: CardProps) {
  return (
    <div className={`${VARIANT_CLASSES[variant]} ${hover ? 'hover:shadow-card-hover' : ''} ${padding ? 'p-5' : ''} ${className}`} style={style}>
      {(title || subtitle || icon) && (
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg text-emerald-600 flex-shrink-0">
              {typeof icon === 'string' ? icon : icon}
            </div>
          )}
          <div className="min-w-0">
            {title && <h3 className="font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="text-ink">{children}</div>
    </div>
  );
}

Card.Header = function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

Card.Body = function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-border flex items-center justify-between gap-4 ${className}`}>
      {children}
    </div>
  );
};
```

- [ ] **步骤 3: 更新 Badge.tsx**

```tsx
// Badge.tsx — 纯白极简主题
import { type ReactNode } from 'react';

export type BadgeVariant = 'emerald' | 'zinc' | 'amber' | 'blue' | 'purple' | 'red' | 'pink' | 'green';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  emerald: 'badge-emerald',
  zinc: 'badge-zinc',
  amber: 'badge-amber',
  blue: 'badge-blue',
  purple: 'badge-purple',
  red: 'badge-red',
  pink: 'badge-pink',
  green: 'badge-green',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = 'zinc', children, className = '', dot = false }: BadgeProps) {
  return (
    <span className={`badge ${VARIANT_STYLES[variant]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  );
}
```

---

### 任务 3: 更新 Navbar — 纯白极简风格

**文件:**
- 修改: `src/components/navbar.tsx`

- [ ] **步骤 1: 重写 navbar.tsx**

将深色紫粉导航栏替换为白色极简导航栏：

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((d) => setAuthEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  const navItems = [
    { href: '/dashboard', label: '首页', icon: '📊' },
    { href: '/dashboard/projects', label: '项目', icon: '📁' },
    { href: '/dashboard/characters', label: '角色库', icon: '🎭' },
    { href: '/dashboard/settings', label: '设置', icon: '⚙️' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg" style={{ borderColor: '#F0F0F0' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-ink text-sm">AI 漫剧</div>
              <div className="text-xs text-ink-muted">创作平台</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-primary text-sm py-2 px-4">
              ✨ 新建项目
            </Link>

            {authEnabled && (
              <button onClick={logout} className="btn-ghost text-sm">
                登出
              </button>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-base-bg-subtle transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t animate-fade-in" style={{ borderColor: '#F0F0F0' }}>
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <div className="pt-2 mt-2 border-t space-y-1" style={{ borderColor: '#F0F0F0' }}>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500"
                >
                  ✨ 新建项目
                </Link>
                {authEnabled && (
                  <button onClick={logout} className="w-full text-left nav-item">
                    登出
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
```

---

### 任务 4: 重写首页 Landing Page

**文件:**
- 修改: `src/app/page.tsx`

- [ ] **步骤 1: 替换 page.tsx 为纯白极简首页**

完整替换首页代码为新的纯白翡翠设计（参考设计文档 6.1 节）：

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { STATUS_CONFIG } from '@/lib/constants';

interface Project {
  id: string;
  title: string;
  description?: string;
  genre: string;
  style: string;
  status: string;
  createdAt?: string;
}

const genreOptions = [
  { value: 'fantasy', label: '奇幻冒险', icon: '🧙', desc: '魔法世界、英雄传说' },
  { value: 'sci-fi', label: '科幻未来', icon: '🚀', desc: '赛博朋克、太空歌剧' },
  { value: 'romance', label: '言情恋爱', icon: '💕', desc: '青春校园、都市爱情' },
  { value: 'action', label: '动作热血', icon: '⚔️', desc: '战斗对决、武侠江湖' },
  { value: 'comedy', label: '喜剧搞笑', icon: '🎭', desc: '日常爆笑、荒诞幽默' },
  { value: 'mystery', label: '悬疑推理', icon: '🔍', desc: '烧脑解谜、惊悚侦探' },
];

const styleOptions = [
  { value: 'anime', label: '日式动漫', icon: '🌸', desc: '精致细腻、色彩明快' },
  { value: 'western', label: '美式漫画', icon: '💥', desc: '粗犷线条、强对比度' },
  { value: 'chinese', label: '国风水墨', icon: '🎋', desc: '古韵雅致、水墨意境' },
  { value: 'realistic', label: '写实风格', icon: '📷', desc: '电影质感、真实细腻' },
  { value: 'pixel', label: '像素艺术', icon: '👾', desc: '复古怀旧、8bit风格' },
  { value: 'chibi', label: 'Q版萌系', icon: '🎀', desc: '可爱Q萌、大头小身' },
];

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenre, setNewGenre] = useState('fantasy');
  const [newStyle, setNewStyle] = useState('anime');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          genre: newGenre,
          style: newStyle,
        }),
      });
      if (res.ok) {
        const newProject = await res.json();
        window.location.href = `/dashboard/projects/${newProject.id}`;
      }
    } catch (e) {
      console.error(e);
    }
    setCreateLoading(false);
  }

  const getGenreLabel = (g: string) => genreOptions.find((o) => o.value === g)?.label || g;
  const getStyleLabel = (s: string) => styleOptions.find((o) => o.value === s)?.label || s;
  const getGenreIcon = (g: string) => genreOptions.find((o) => o.value === g)?.icon || '📖';

  return (
    <>
      {/* ===== NAV ===== */}
      <div className="flex items-center justify-between max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600"></div>
          <span className="font-semibold text-ink">AI 漫剧</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost text-sm">登录</Link>
          <Link href="/dashboard" className="btn-primary text-sm py-2 px-4">开始创作</Link>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-50/30" />
        </div>
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center relative">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-full text-sm text-emerald-700 font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            AI 驱动 · 全流程自动化
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-ink mb-4">
            用 AI 创作你的<br/>
            <span className="text-gradient">漫剧故事</span>
          </h1>
          <p className="text-lg text-ink-secondary max-w-lg mx-auto mb-8 leading-relaxed">
            从大纲到成片，一站式 AI 创作平台
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard" className="btn-primary btn-lg">
              免费开始创作
              <span className="ml-1">→</span>
            </Link>
            <a href="#features" className="btn-secondary btn-lg">
              了解更多
            </a>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-ink mb-2">一站式创作</h2>
          <p className="text-ink-secondary">从灵感到成片，AI 全程陪伴</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[
            { icon: '📝', title: '智能剧本', desc: 'AI 生成故事剧本' },
            { icon: '🎬', title: '自动分镜', desc: '智能拆解镜头' },
            { icon: '🖼️', title: 'AI 绘画', desc: '角色一致性' },
            { icon: '🎞️', title: '视频合成', desc: '一键导出成片' },
          ].map((f) => (
            <div key={f.title} className="card-flat p-5 text-center">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-sm text-ink mb-0.5">{f.title}</div>
              <div className="text-xs text-ink-muted">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-ink mb-2">创作流程</h2>
          <p className="text-ink-secondary">四个步骤完成你的漫剧</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {[
            { num: 1, title: '创建项目', desc: '设定题材与风格' },
            { num: 2, title: 'AI 剧本', desc: '自动生成剧本' },
            { num: 3, title: '智能分镜', desc: '设计镜头情绪' },
            { num: 4, title: '生成成片', desc: '合成漫剧视频' },
          ].map((s) => (
            <div key={s.num} className="text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg mx-auto mb-3 ${
                s.num === 1
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}>
                {s.num}
              </div>
              <div className="font-semibold text-sm text-ink mb-1">{s.title}</div>
              <div className="text-xs text-ink-muted">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 border border-emerald-100 rounded-2xl py-12 px-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-2">
            准备好让故事 <span className="text-emerald-600">动起来</span> 了吗？
          </h2>
          <p className="text-ink-secondary mb-6">加入创作者行列，用 AI 释放你的创意</p>
          <Link href="/dashboard" className="btn-primary btn-lg">
            立即开始创作 →
          </Link>
        </div>
      </section>

      {/* ===== RECENT PROJECTS ===== */}
      {projects.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-ink">最近项目</h2>
              <p className="text-sm text-ink-secondary">继续你的创作之旅</p>
            </div>
            <Link href="/dashboard/projects" className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
              查看全部 →
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-40 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-ink-muted text-sm">
                    <div className="w-4 h-4 border-2 border-border-strong border-t-emerald-500 rounded-full animate-spin" />
                    加载中...
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {projects.slice(0, 6).map((p, idx) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="card p-5 animate-slide-up group"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      {getGenreIcon(p.genre)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink truncate">{p.title}</h3>
                      <p className="text-xs text-ink-muted mt-0.5">{getGenreLabel(p.genre)} · {getStyleLabel(p.style)}</p>
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-sm text-ink-secondary line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="badge badge-emerald text-xs">
                      {STATUS_CONFIG[p.status]?.label || '草稿'}
                    </span>
                    <span className="text-xs text-ink-muted group-hover:text-emerald-600 transition-colors">
                      进入项目 →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-ink-muted">© 2026 AI 漫剧系统</p>
      </footer>
    </>
  );
}
```

---

### 任务 5: 重写仪表盘 Dashboard

**文件:**
- 修改: `src/app/dashboard/page.tsx`

- [ ] **步骤 1: 替换 dashboard/page.tsx 为新设计**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';

interface Project {
  id: string;
  title: string;
  style: string;
  genre: string;
  updatedAt: string;
}

interface Stats {
  projects: number;
  characters: number;
  scripts: number;
  completed: number;
}

export default function PipelineDashboard() {
  const [stats, setStats] = useState<Stats>({ projects: 0, characters: 0, scripts: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/characters').then(r => r.json()).catch(() => []),
      fetch('/api/scripts').then(r => r.json()).catch(() => []),
    ]).then(([p, c, s]) => {
      const projects = p as Project[];
      setStats({
        projects: projects.length || 0,
        characters: (c as any[]).length || 0,
        scripts: (s as any[]).length || 0,
        completed: projects.filter(x => x.id).length || 0,
      });
      setRecentProjects(projects.slice(0, 3));
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-2xl font-bold text-ink mb-1">
            欢迎回来 <span className="text-gradient">创作者</span>
          </h1>
          <p className="text-ink-secondary text-sm">开始你的 AI 漫剧创作之旅</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: '📁', label: '项目总数', value: stats.projects, highlight: false },
            { icon: '🎭', label: '角色数量', value: stats.characters, highlight: false },
            { icon: '📝', label: '剧本数量', value: stats.scripts, highlight: false },
            { icon: '✅', label: '已发布', value: stats.completed, highlight: true },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`${s.highlight ? 'stat-card-highlight' : 'stat-card'} animate-slide-up`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-secondary font-medium">{s.label}</span>
                <span className="text-xl">{s.icon}</span>
              </div>
              <p className={`text-2xl font-bold ${s.highlight ? 'text-emerald-600' : 'text-ink'}`}>
                {loading ? '-' : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-sm font-semibold text-ink mb-3">快速操作</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: '✨', title: '新建项目', desc: '开始创作新的漫剧', href: '/dashboard/projects' },
              { icon: '🎭', title: '角色管理', desc: '创建和编辑角色', href: '/dashboard/characters' },
              { icon: '📊', title: '全链路视图', desc: '查看创作管线状态', href: '/dashboard' },
            ].map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className="card p-4 hover:border-emerald-100 hover:shadow-card-hover transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                    {a.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-ink group-hover:text-emerald-700 transition-colors">{a.title}</h3>
                    <p className="text-xs text-ink-muted mt-0.5">{a.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink">最近项目</h2>
              <Link href="/dashboard/projects" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
                查看全部 →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recentProjects.map((project, idx) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="card p-4 hover:border-emerald-100 hover:shadow-card-hover transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      🎬
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-ink truncate group-hover:text-emerald-700 transition-colors">
                        {project.title}
                      </h3>
                      <span className="badge badge-emerald text-xs mt-1">{project.genre || '未分类'}</span>
                      <p className="text-xs text-ink-muted mt-1.5">
                        {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {recentProjects.length === 0 && !loading && (
          <div className="card text-center py-20 animate-fade-in">
            <div className="text-5xl mb-4 opacity-60">🎬</div>
            <h3 className="text-lg font-semibold text-ink mb-1">还没有项目</h3>
            <p className="text-ink-secondary text-sm mb-5">创建你的第一个漫剧项目</p>
            <Link href="/dashboard/projects" className="btn-primary inline-flex items-center gap-2">
              ✨ 创建项目
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 任务 6: 重写登录页

**文件:**
- 修改: `src/app/login/page.tsx`

- [ ] **步骤 1: 替换登录页为双栏纯白翡翠风格**

```tsx
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
```

---

### 任务 7: 更新项目列表页

**文件:**
- 修改: `src/app/dashboard/projects/page.tsx`

- [ ] **步骤 1: 更新项目列表页的 CSS 类名**

将 `card-white` 替换为 `card`，将 amber/stone 色系换成 ink/emerald 色系，更新状态标签映射：

主要改动：
- `card-white` → `card p-5` / `card p-6`
- `text-ink` / `text-stone-*` → `text-ink` / `text-ink-secondary` / `text-ink-muted`
- `bg-amber-100` / `border-amber-200` → `bg-emerald-50` / `border-emerald-100`
- `btn-primary` 无需改（已更新为绿色）
- `STATUS_CONFIG` 的 `cls` 映射需要更新

- [ ] **步骤 2: 更新 constants.ts 中的状态标签 CSS**

```ts
// constants.ts
export const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'badge-zinc' },
  scripting: { label: '剧本生成中', cls: 'badge-amber' },
  storyboarding: { label: '分镜设计中', cls: 'badge-blue' },
  producing: { label: '制作中', cls: 'badge-purple' },
  completed: { label: '已完成', cls: 'badge-emerald' },
};
```

---

### 任务 8: 更新角色管理页

**文件:**
- 修改: `src/app/dashboard/characters/page.tsx`

- [ ] **步骤 1: 替换角色管理页的旧 CSS 类名**

类似项目列表页，将 `card-white` → `card`，amber/stone 色系 → emerald/ink 色系。

---

### 任务 9: 更新设置页

**文件:**
- 修改: `src/app/dashboard/settings/page.tsx`

- [ ] **步骤 1: 替换设置页的旧 CSS 类名**

将 `card-white` → `card`，amber/stone 色系 → emerald/ink 色系。

---

### 任务 10: 更新布局文件

**文件:**
- 修改: `src/app/layout.tsx`

- [ ] **步骤 1: 简化 layout.tsx，移除内联深色背景样式**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 漫剧系统',
  description: 'AI Comic Drama Generation Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-ink">
        {children}
      </body>
    </html>
  );
}
```

---

### 任务 11: 构建验证

- [ ] **步骤 1: 运行 Next.js build 检查错误**

```bash
cd C:\Users\28406\Desktop\新建文件夹\ai-comic-drama-system
npx next build 2>&1
```

预期: 构建成功，无 TypeScript 或 CSS 错误。

- [ ] **步骤 2: 启动开发服务器检查页面渲染**

```bash
npx next dev
```

- [ ] **步骤 3: 人工检查关键页面**
   - 首页 (/) — Hero/功能/流程/CTA 正常渲染
   - 仪表盘 (/dashboard) — 统计数据/快速操作/项目列表正常
   - 项目列表 (/dashboard/projects) — 卡片布局正确
   - 登录页 (/login) — 双栏布局正常
   - 角色管理 (/dashboard/characters) — 样式一致

---

## 实施顺序

按依赖关系排列：

```
任务 0 (Tailwind Config) → 基础层
  ↓
任务 1 (Global CSS) → 样式层
  ↓
任务 2 (UI 组件) → 组件层
  ↓
任务 3 (Navbar) → 公共组件
  ↓
任务 4 (Layout) → 根布局
  ↓
任务 5 (Landing Page) → 页面层
任务 6 (Dashboard)
任务 7 (Login)
任务 8 (Projects List)
任务 9 (Characters)
任务 10 (Settings)
  ↓
任务 11 (Build 验证)
```

**建议**: 使用 subagent-driven-development 按任务顺序逐一实施，每个任务完成后检查结果。
