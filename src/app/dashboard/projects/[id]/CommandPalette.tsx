'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectContext } from './ProjectContext';
import type { TabKey } from './types';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  shortcut?: string;
  keywords: string[];
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const {
    project, activeTab, setActiveTab,
    storyboards, characters, scripts,
    generateScript, generatingScript,
    batchGenerateImages, selectedStoryboards,
  } = useProjectContext();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    cmds.push({
      id: 'tab-overview',
      label: '前往概览',
      icon: '🏠',
      shortcut: 'G O',
      keywords: ['概览', 'overview', '首页', 'home'],
      category: '导航',
      action: () => setActiveTab('overview'),
    });
    cmds.push({
      id: 'tab-script',
      label: '前往剧本',
      icon: '📝',
      shortcut: 'G S',
      keywords: ['剧本', 'script', '大纲', '写作'],
      category: '导航',
      action: () => setActiveTab('script'),
    });
    cmds.push({
      id: 'tab-characters',
      label: '前往角色',
      icon: '🎭',
      shortcut: 'G C',
      keywords: ['角色', 'character', '人物'],
      category: '导航',
      action: () => setActiveTab('characters'),
    });
    cmds.push({
      id: 'tab-storyboard',
      label: '前往分镜',
      icon: '🎬',
      shortcut: 'G B',
      keywords: ['分镜', 'storyboard', '故事板'],
      category: '导航',
      action: () => setActiveTab('storyboard'),
    });
    cmds.push({
      id: 'tab-voice',
      label: '前往配音',
      icon: '🎙️',
      shortcut: 'G V',
      keywords: ['配音', 'voice', '音频', '声音'],
      category: '导航',
      action: () => setActiveTab('voice'),
    });
    cmds.push({
      id: 'tab-timeline',
      label: '前往时间线',
      icon: '🎞️',
      shortcut: 'G T',
      keywords: ['时间线', 'timeline', '剪辑', '预览'],
      category: '导航',
      action: () => setActiveTab('timeline'),
    });
    cmds.push({
      id: 'tab-review',
      label: '前往评审',
      icon: '✅',
      shortcut: 'G R',
      keywords: ['评审', 'review', '审核', '检查'],
      category: '导航',
      action: () => setActiveTab('review'),
    });
    cmds.push({
      id: 'tab-publish',
      label: '前往发布',
      icon: '🚀',
      shortcut: 'G P',
      keywords: ['发布', 'publish', '导出', '分享'],
      category: '导航',
      action: () => setActiveTab('publish'),
    });

    if (scripts.length === 0 || scripts.every(s => s.status !== 'completed')) {
      cmds.push({
        id: 'gen-script',
        label: 'AI 生成剧本',
        description: '输入创意，AI自动生成完整剧本',
        icon: '✨',
        keywords: ['生成', 'create', '剧本', 'ai', '写作'],
        category: '创作',
        action: () => { setActiveTab('script'); },
      });
    }

    const pendingImages = storyboards.filter(s => !s.imageUrls);
    if (pendingImages.length > 0) {
      cmds.push({
        id: 'gen-all-images',
        label: `批量生成图片 (${pendingImages.length}个待生成)`,
        icon: '🖼️',
        keywords: ['批量', 'batch', '图片', 'image', '生成'],
        category: '创作',
        action: () => {
          setActiveTab('storyboard');
          batchGenerateImages(pendingImages.map(s => s.id));
        },
      });
    }

    cmds.push({
      id: 'close-palette',
      label: '关闭命令面板',
      icon: '✕',
      shortcut: 'ESC',
      keywords: ['关闭', 'close', '退出', 'esc'],
      category: '其他',
      action: () => onClose(),
    });

    return cmds;
  }, [setActiveTab, storyboards, scripts, batchGenerateImages, selectedStoryboards]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.keywords.some(k => k.toLowerCase().includes(q))
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      return;
    }

    if (!open) return;

    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.action();
        onClose();
      }
    }
  }, [open, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const flatIndexToCmd = useMemo(() => {
    const flat: Command[] = [];
    Object.values(groupedCommands).forEach(cmds => flat.push(...cmds));
    return flat;
  }, [groupedCommands]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <span className="text-gray-400 mr-3">🔍</span>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="输入命令或搜索... (Ctrl+K)"
            className="flex-1 text-base outline-none bg-transparent text-ink placeholder:text-gray-400"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-100 rounded">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {Object.entries(groupedCommands).length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              没有找到匹配的命令
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  const flatIdx = flatIndexToCmd.findIndex(c => c.id === cmd.id);
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => { cmd.action(); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-gray-50 text-ink'
                      }`}
                    >
                      <span className="text-lg w-6 text-center">{cmd.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-xs text-gray-500 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded font-mono">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
          <span>↑↓ 选择</span>
          <span>↵ 执行</span>
          <span>Ctrl+K 打开/关闭</span>
          <span className="ml-auto">{project?.title || '命令面板'}</span>
        </div>
      </div>
    </div>
  );
}
