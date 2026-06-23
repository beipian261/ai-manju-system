'use client';

import React from 'react';

// ============================================================
// ScriptRenderer — 结构化剧本渲染组件
//
// 输入：script.content（JSON 字符串或纯文本）
// 输出：按场景分组的可读结构，区分三幕、场景标题、对白、描述
// ============================================================

interface SceneData {
  scene_number?: number;
  title?: string;
  location?: string;
  time_of_day?: string;
  description?: string;
  dialogue?: string;
  emotion?: string;
  camera_angle?: string;
  visual_keywords?: string;
  characters_in_scene?: string[];
}

interface ActData {
  act_num?: number;
  name?: string;
  scenes?: SceneData[];
}

interface ScriptData {
  title?: string;
  logline?: string;
  genre?: string;
  acts?: ActData[];
}

const EMOTION_COLORS: Record<string, string> = {
  tense: '#DC2626',
  dramatic: '#9333EA',
  mysterious: '#1D4ED8',
  epic: '#D97706',
  romantic: '#EC4899',
  peaceful: '#16A34A',
  comedic: '#0891B2',
  melancholy: '#6B7280',
  action: '#EA580C',
  horror: '#7C3AED',
  magical: '#A855F7',
};

function EmotionBadge({ emotion }: { emotion?: string }) {
  if (!emotion) return null;
  const color = EMOTION_COLORS[emotion.toLowerCase()] || '#6B7280';
  const label = emotion.replace(/_/g, ' ');
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        background: color + '20',
        color,
        border: `1px solid ${color}40`,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function SceneCard({ scene, index }: { scene: SceneData; index: number }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E7E5E4',
        borderRadius: '6px',
        padding: '14px 16px',
        marginBottom: '10px',
      }}
    >
      {/* Scene header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '22px',
            height: '22px',
            background: '#FEF3C7',
            color: '#A16207',
            borderRadius: '50%',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {scene.scene_number ?? index + 1}
        </span>
        <span style={{ fontWeight: 600, fontSize: '13px', color: '#1C1917', flex: 1 }}>
          {scene.title || `场景 ${scene.scene_number ?? index + 1}`}
        </span>
        <EmotionBadge emotion={scene.emotion} />
      </div>

      {/* Location & time */}
      {(scene.location || scene.time_of_day) && (
        <div style={{ fontSize: '11px', color: '#78716C', marginBottom: '8px', display: 'flex', gap: '6px' }}>
          {scene.location && <span>📍 {scene.location}</span>}
          {scene.time_of_day && <span>🕐 {scene.time_of_day}</span>}
          {scene.camera_angle && (
            <span style={{ color: '#A16207' }}>🎬 {scene.camera_angle.replace(/_/g, ' ')}</span>
          )}
        </div>
      )}

      {/* Description */}
      {scene.description && (
        <p style={{ fontSize: '13px', color: '#292524', lineHeight: '1.6', marginBottom: '8px' }}>
          {scene.description}
        </p>
      )}

      {/* Dialogue */}
      {scene.dialogue && String(scene.dialogue).trim() && (
        <div
          style={{
            background: '#F5F5F4',
            borderLeft: '3px solid #A16207',
            padding: '8px 12px',
            borderRadius: '0 4px 4px 0',
            fontSize: '12px',
            color: '#44403C',
            fontStyle: 'italic',
            lineHeight: '1.6',
          }}
        >
          {typeof scene.dialogue === 'string' ? scene.dialogue : (scene.dialogue as any)?.text || JSON.stringify(scene.dialogue)}
        </div>
      )}

      {/* Characters */}
      {Array.isArray(scene.characters_in_scene) && scene.characters_in_scene.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {scene.characters_in_scene.map((c) => (
            <span
              key={c}
              style={{
                padding: '1px 8px',
                background: '#EDE9FE',
                color: '#6D28D9',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActSection({ act, actIndex }: { act: ActData; actIndex: number }) {
  const ACT_COLORS = ['#D97706', '#DC2626', '#16A34A'];
  const color = ACT_COLORS[actIndex % ACT_COLORS.length];

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `2px solid ${color}`,
        }}
      >
        <span
          style={{
            padding: '3px 10px',
            background: color,
            color: '#fff',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          第{actIndex + 1}幕
        </span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1C1917' }}>
          {act.name || `Act ${act.act_num ?? actIndex + 1}`}
        </span>
        <span style={{ fontSize: '11px', color: '#78716C', marginLeft: 'auto' }}>
          {(act.scenes || []).length} 场
        </span>
      </div>

      {(act.scenes || []).map((scene, i) => (
        <SceneCard key={i} scene={scene} index={i} />
      ))}
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
interface ScriptRendererProps {
  content: string;
}

export function ScriptRenderer({ content }: ScriptRendererProps) {
  if (!content) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#78716C', fontSize: '13px' }}>
        剧本内容为空
      </div>
    );
  }

  // 尝试解析为结构化 JSON
  let scriptData: ScriptData | null = null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && (parsed.acts || parsed.title)) {
      scriptData = parsed as ScriptData;
    }
  } catch {
    // 不是 JSON，当纯文本渲染
  }

  // 纯文本模式
  if (!scriptData) {
    return (
      <div
        style={{
          background: '#FAFAF9',
          border: '1px solid #E7E5E4',
          borderRadius: '6px',
          padding: '16px',
          fontSize: '13px',
          color: '#292524',
          lineHeight: '1.8',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '600px',
          overflowY: 'auto',
        }}
      >
        {content}
      </div>
    );
  }

  // 结构化渲染
  return (
    <div>
      {/* Script header */}
      {(scriptData.title || scriptData.logline) && (
        <div
          style={{
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}
        >
          {scriptData.title && (
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#A16207' }}>
              {scriptData.title}
            </h3>
          )}
          {scriptData.logline && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
              {scriptData.logline}
            </p>
          )}
          {scriptData.genre && (
            <span
              style={{
                display: 'inline-block',
                marginTop: '6px',
                padding: '1px 8px',
                background: '#A16207',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {scriptData.genre}
            </span>
          )}
        </div>
      )}

      {/* Acts */}
      {(scriptData.acts || []).map((act, i) => (
        <ActSection key={i} act={act} actIndex={i} />
      ))}

      {/* Empty state */}
      {(!scriptData.acts || scriptData.acts.length === 0) && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#78716C', fontSize: '13px' }}>
          剧本结构为空
        </div>
      )}
    </div>
  );
}

export default ScriptRenderer;
