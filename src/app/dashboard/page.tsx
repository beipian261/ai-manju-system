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
