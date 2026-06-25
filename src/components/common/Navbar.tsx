'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { Sparkles, Search, Menu, X } from 'lucide-react';

export function Navbar() {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    apiGet<{ enabled: boolean }>('/api/auth/status')
      .then((d) => setAuthEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      await apiPost('/api/auth/logout', {});
    } finally {
      window.location.href = '/login';
    }
  }

  const navItems = [
    { href: '/dashboard', label: '工作台', icon: null },
    { href: '/dashboard/projects', label: '项目', icon: null },
    { href: '/dashboard/characters', label: '角色库', icon: null },
    { href: '/dashboard/settings', label: '设置', icon: null },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/60 backdrop-blur-xl border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">AI 漫剧</span>
          </Link>

          <button
            className="md:hidden flex items-center justify-center rounded-lg w-9 h-9 bg-slate-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
          </button>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm rounded-lg transition-colors duration-150 relative ${
                  isActive(item.href)
                    ? 'font-semibold text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                )}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
              <Search className="w-4 h-4" />
            </button>
            {pathname !== '/dashboard/characters' && (
              <Link href="/dashboard/characters" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-sm hover:shadow-md transition-all">
                <span>创建角色</span>
              </Link>
            )}
            {authEnabled && (
              <button onClick={logout} className="btn-ghost text-sm">
                登出
              </button>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 border-b bg-white/80 backdrop-blur-xl border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  isActive(item.href)
                    ? 'font-medium text-slate-900 bg-emerald-500/8'
                    : 'text-slate-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-100 flex gap-2">
              <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600">
                <Search className="w-4 h-4" />
              </button>
              {pathname !== '/dashboard/characters' && (
                <Link
                  href="/dashboard/characters"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500"
                >
                  创建角色
                </Link>
              )}
            </div>
            {authEnabled && (
              <button onClick={logout} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-600">
                登出
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
