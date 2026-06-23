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
            <Link href="/dashboard/projects" className="btn-primary text-sm py-2 px-4">
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
                  href="/dashboard/projects"
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
