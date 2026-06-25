'use client';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Users,
  Film,
  Mic,
  Clock,
  Eye,
  Rocket,
  ChevronRight,
} from 'lucide-react';
import { TABS } from './types';
import type { TabKey } from './types';
import { useProjectContext } from './ProjectContext';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FileText,
  Users,
  Film,
  Mic,
  Clock,
  Eye,
  Rocket,
};

interface WorkflowSidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const MEMBERS = [
  { name: '张', color: 'var(--brand-primary)' },
  { name: '李', color: '#94A3B8' },
  { name: '王', color: '#CBD5E1' },
];

const GENRE_TAGS = ['科幻', '赛博朋克'];

export default function WorkflowSidebar({ activeTab, onTabChange }: WorkflowSidebarProps) {
  const { project, characters, storyboards, scripts } = useProjectContext();

  if (!project) return null;

  return (
    <>
      {/* Mobile Tab Bar - visible below lg */}
      <div
        className="lg:hidden flex-shrink-0 overflow-x-auto no-scrollbar"
        style={{ background: 'white', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-1 px-4 py-2 min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                style={
                  isActive
                    ? {
                        background: 'var(--gradient-primary-soft)',
                        color: 'var(--brand-primary)',
                      }
                    : { color: 'var(--color-text-secondary)' }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{ width: '224px', background: 'white', borderRight: '1px solid var(--color-border)' }}
      >
        {/* Project Info */}
        <div className="px-4 pt-5 pb-4">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {project.title}
          </h2>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {GENRE_TAGS.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                style={{
                  background: 'var(--gradient-primary-soft)',
                  color: 'var(--brand-primary)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--color-border)' }} />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const IconComponent = iconMap[tab.icon];
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150"
                style={
                  isActive
                    ? {
                        background: 'var(--gradient-primary-soft)',
                        color: 'var(--brand-primary)',
                        fontWeight: 500,
                      }
                    : {
                        color: 'var(--color-text-secondary)',
                      }
                }
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {IconComponent && <IconComponent className="w-4 h-4" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Members Section */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            成员
          </p>
          <div className="flex items-center">
            {MEMBERS.map((member, idx) => (
              <div
                key={member.name}
                className="flex items-center justify-center rounded-full text-white text-xs font-medium"
                style={{
                  width: '28px',
                  height: '28px',
                  background: member.color,
                  zIndex: 3 - idx,
                  marginLeft: idx > 0 ? '-4px' : '0',
                }}
              >
                {member.name}
              </div>
            ))}
            <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-muted)' }}>
              +2
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
