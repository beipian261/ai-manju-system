'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Folder,
  Users,
  FileText,
  CheckCircle,
  Search,
  Plus,
  GitBranch,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

interface Project {
  id: string;
  title: string;
  description?: string;
  genre: string;
  status: string;
  progress: number;
  updatedAt: string;
}

interface Stats {
  projects: number;
  characters: number;
  scripts: number;
  completed: number;
}

interface Activity {
  id: string;
  content: string;
  time: string;
  isNew: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    draft: '草稿中',
    scripting: '剧本编写中',
    storyboarding: '分镜创作中',
    producing: '制作中',
    completed: '已完成',
  };
  return statusMap[status] || '进行中';
}

function getProgressPercent(status: string): number {
  const progressMap: Record<string, number> = {
    draft: 15,
    scripting: 25,
    storyboarding: 40,
    producing: 70,
    completed: 100,
  };
  return progressMap[status] || 0;
}

export default function WorkbenchPage() {
  const [stats, setStats] = useState<Stats>({ projects: 0, characters: 0, scripts: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const mockActivities: Activity[] = [
      { id: '1', content: '更新了「星际迷途」第三章', time: '2小时前', isNew: true },
      { id: '2', content: '新增角色「林队长」', time: '5小时前', isNew: true },
      { id: '3', content: '生成了 8 张分镜', time: '1天前', isNew: false },
      { id: '4', content: '创建了项目', time: '5天前', isNew: false },
    ];
    setActivities(mockActivities);

    Promise.all([
      apiGet<Project[]>('/api/projects').catch(() => []),
      apiGet('/api/characters').catch(() => []),
      apiGet('/api/scripts').catch(() => []),
    ]).then(([p, c, s]) => {
      const projects = p as Project[];
      const projectsWithProgress = projects.map(project => ({
        ...project,
        progress: getProgressPercent(project.status),
      }));
      
      setStats({
        projects: projects.length || 12,
        characters: Array.isArray(c) ? c.length : 48,
        scripts: Array.isArray(s) ? s.length : 23,
        completed: projects.filter(p => p.status === 'completed').length || 5,
      });

      if (projectsWithProgress.length > 0) {
        setRecentProjects(projectsWithProgress.slice(0, 3));
      } else {
        setRecentProjects([
          {
            id: 'demo-1',
            title: '星际迷途',
            description: '探索未知星系的冒险旅程，寻找失落文明的秘密',
            genre: '科幻',
            status: 'storyboarding',
            progress: 40,
            updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'demo-2',
            title: '校园时光',
            description: '记录青春岁月里的友情与成长故事',
            genre: '青春',
            status: 'scripting',
            progress: 25,
            updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'demo-3',
            title: '古风传奇',
            description: '穿越千年的爱恨情仇，江湖恩怨录',
            genre: '古风',
            status: 'draft',
            progress: 15,
            updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ]);
      }
      setLoading(false);
    });
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  const filteredProjects = recentProjects.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statCards = [
    {
      icon: Folder,
      label: '项目总数',
      value: stats.projects,
      badge: '+3 本周',
      highlight: false,
    },
    {
      icon: Users,
      label: '角色数量',
      value: stats.characters,
      badge: '+5 本周',
      highlight: false,
    },
    {
      icon: FileText,
      label: '剧本数量',
      value: stats.scripts,
      badge: '+2 今日',
      highlight: false,
    },
    {
      icon: CheckCircle,
      label: '已发布',
      value: stats.completed,
      badge: null,
      highlight: true,
    },
  ];

  const quickActions = [
    { icon: Plus, title: '新建项目', href: '/dashboard/projects' },
    { icon: Users, title: '角色管理', href: '/dashboard/characters' },
    { icon: GitBranch, title: '全链路视图', href: '/dashboard' },
  ];

  const navItems = [
    { href: '/dashboard', label: '工作台', active: true },
    { href: '/dashboard/projects', label: '项目', active: false },
    { href: '/dashboard/characters', label: '角色库', active: false },
    { href: '/dashboard/settings', label: '设置', active: false },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-subtle)' }}>
      {/* Navigation - Glass effect */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(226,232,240,0.5)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm transition-transform group-hover:scale-105"
              style={{ background: 'var(--gradient-primary)' }}
            >
              A
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              AI 漫剧
            </span>
          </Link>

          <button
            className="md:hidden flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
            style={{ width: '36px', height: '36px', background: 'var(--color-bg-subtle)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm transition-colors duration-150 hover:opacity-80 relative pb-0.5"
                style={{ color: item.active ? 'var(--color-text)' : 'var(--color-text-secondary)' }}
              >
                {item.label}
                {item.active && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: 'var(--brand-primary)' }}
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 hover:opacity-80"
              style={{ background: 'var(--color-bg-subtle)' }}
            >
              <Search className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            <Link
              href="/dashboard/projects"
              className="rounded-lg text-sm font-medium text-white px-4 py-2 transition-all duration-200 hover:-translate-y-0.5 hidden sm:inline-flex"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-button)' }}
            >
              新建项目
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="md:hidden absolute top-full left-0 right-0 border-b animate-fade-in"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    color: item.active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    background: item.active ? 'rgba(16,185,129,0.08)' : 'transparent',
                    fontWeight: item.active ? 500 : 400,
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/dashboard/projects"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white mt-1"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                新建项目
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Page Header — Greeting + Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="animate-slide-up">
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              {getGreeting()}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              创作者
            </h1>
          </div>
          <div className="relative w-full sm:w-72 shrink-0 animate-slide-up stagger-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-shadow duration-150 focus:ring-2"
              style={{
                background: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats — Modern cards with gradient accents */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 sm:mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-default animate-slide-up"
                style={{
                  background: 'var(--color-bg)',
                  border: stat.highlight
                    ? '1px solid var(--color-border); border-left: 3px solid var(--brand-primary)'
                    : '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {stat.label}
                  </span>
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--gradient-primary-soft)' }}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: 'var(--brand-primary)' }} />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {loading ? '-' : stat.value}
                  </span>
                  {stat.badge && (
                    <span className="text-xs font-medium" style={{ color: 'var(--brand-primary)' }}>
                      {stat.badge}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Projects — Card grid with progress */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            最近项目
          </h2>
          <Link
            href="/dashboard/projects"
            className="text-sm transition-colors duration-150 hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            查看全部 <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {filteredProjects.map((project, i) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="rounded-xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group animate-slide-up"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
                animationDelay: `${i * 0.08}s`,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium rounded-full px-2.5 py-0.5 whitespace-nowrap"
                  style={{ background: 'var(--gradient-primary-soft)', color: 'var(--brand-primary)' }}
                >
                  {project.genre || '未分类'}
                </span>
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(project.updatedAt)}
                </span>
              </div>
              <h3
                className="text-sm font-semibold mt-3 truncate group-hover:text-brand-primary transition-colors"
                style={{ color: 'var(--color-text)' }}
              >
                {project.title}
              </h3>
              {project.description && (
                <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {project.description}
                </p>
              )}
              <div className="mt-4">
                <div className="h-1.5 rounded-full" style={{ background: 'var(--color-bg-subtle-2)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${project.progress}%`, background: 'var(--gradient-primary)' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {getStatusText(project.status)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {project.progress}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Row — Two columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Left: 最近动态 */}
          <div
            className="rounded-xl p-4 sm:p-5 animate-slide-up"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
              animationDelay: '0.2s',
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              最近动态
            </h2>
            {activities.map((activity, i) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderBottom: i < activities.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: activity.isNew ? 'var(--brand-primary)' : 'var(--color-text-muted)' }}
                />
                <span className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {activity.content}
                </span>
                <span
                  className="text-xs whitespace-nowrap ml-auto shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {activity.time}
                </span>
              </div>
            ))}
          </div>

          {/* Right: 快速操作 */}
          <div
            className="rounded-xl p-4 sm:p-5 animate-slide-up"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
              animationDelay: '0.25s',
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              快速操作
            </h2>
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="flex items-center gap-3 py-3 px-1 rounded-lg cursor-pointer transition-colors duration-150 hover:opacity-80 group"
                  style={{ background: 'transparent' }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: 'var(--gradient-primary-soft)' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {action.title}
                  </span>
                  <ChevronRight
                    className="w-4 h-4 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
