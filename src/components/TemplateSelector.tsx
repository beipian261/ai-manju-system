'use client';

import { useState, useEffect } from 'react';
import type { ScriptTemplate } from '@/lib/script-templates';
import { BUILT_IN_TEMPLATES } from '@/lib/script-templates';

interface TemplateSelectorProps {
  onSelect: (tpl: ScriptTemplate) => void;
  selectedId?: string;
}

const GENRE_MAP: Record<string, string> = {
  fantasy: 'fantasy',
  'sci-fi': 'sci-fi',
  romance: 'romance',
  thriller: 'mystery',
  historical: 'action',
  comedy: 'comedy',
  horror: 'mystery',
  wuxia: 'action',
};

const STYLE_MAP: Record<string, string> = {
  anime_fantasy: 'anime',
  cyberpunk_noir: 'western',
  shoujo_romance: 'anime',
  noir_shadow: 'western',
  ink_wash: 'chinese',
  chibi_comedy: 'chibi',
  dark_gothic: 'realistic',
  chinese_ink: 'chinese',
};

export function TemplateSelector({ onSelect, selectedId }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setTemplates(data.templates);
      })
      .catch(() => {
        // Fallback: static import
        setTemplates(BUILT_IN_TEMPLATES);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 rounded skeleton mb-2"></div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-muted font-medium">模板推荐</span>
        <span className="text-[10px] text-ink-muted">点击模板自动填充故事大纲</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {templates.map((tpl) => {
          const isSelected = selectedId === tpl.id;
          const isExpanded = expandedId === tpl.id;

          return (
            <div key={tpl.id} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setExpandedId(isExpanded ? null : tpl.id);
                  } else {
                    onSelect(tpl);
                    setExpandedId(null);
                  }
                }}
                className={`w-full p-3 rounded-xl text-left transition-all border ${
                  isSelected
                    ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                    : 'border-border bg-base-bg hover:border-amber-200 hover:shadow-sm'
                }`}
              >
                <div className="text-xl mb-1">{tpl.icon}</div>
                <div className="text-xs font-bold text-ink truncate">{tpl.label}</div>
                <div className="text-[10px] text-ink-muted truncate mt-0.5">{tpl.description}</div>
              </button>

              {/* Expand preview */}
              {isSelected && isExpanded && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 p-3 bg-white rounded-xl border border-border shadow-lg z-10 max-h-48 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] text-ink-secondary leading-relaxed whitespace-pre-line line-clamp-8">
                    {tpl.outline.slice(0, 300)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      {tpl.recommendedSettings.episodeCount} 集
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                      {tpl.recommendedSettings.targetDuration}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {tpl.recommendedSettings.pacing}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Map template art style to project style value */
export function mapTemplateStyle(artStyle: string): string {
  return STYLE_MAP[artStyle] || 'anime';
}

/** Map template genre to project genre value */
export function mapTemplateGenre(genre: string): string {
  return GENRE_MAP[genre] || 'fantasy';
}
