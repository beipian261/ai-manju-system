// 智能背景音乐推荐 API
// 根据场景情绪推荐合适的背景音乐
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { logger } from '@/lib/logger';

// 背景音乐风格库
const BGM_STYLES = {
  peaceful: {
    name: '宁静祥和',
    tags: ['钢琴', '轻音乐', '自然声', '治愈', '冥想'],
    tempo: 'slow',
    instruments: ['piano', 'violin', 'flute', 'cello'],
  },
  happy: {
    name: '欢快愉悦',
    tags: ['流行', '轻快', '动感', '节日', '欢乐'],
    tempo: 'fast',
    instruments: ['guitar', 'drums', 'bass', 'keyboard'],
  },
  sad: {
    name: '悲伤忧郁',
    tags: ['钢琴', '大提琴', '悲伤', '怀念', '孤独'],
    tempo: 'slow',
    instruments: ['piano', 'cello', 'violin', 'harp'],
  },
  tense: {
    name: '紧张悬疑',
    tags: ['悬疑', '紧张', '神秘', '惊悚', '紧迫'],
    tempo: 'medium-fast',
    instruments: ['strings', 'piano', 'synth', 'percussion'],
  },
  dramatic: {
    name: '戏剧激昂',
    tags: ['史诗', '大气', '激昂', '壮丽', '宏伟'],
    tempo: 'medium-fast',
    instruments: ['orchestra', 'choir', 'brass', 'drums'],
  },
  romantic: {
    name: '浪漫温馨',
    tags: ['浪漫', '爱情', '甜蜜', '温馨', '温柔'],
    tempo: 'slow-medium',
    instruments: ['piano', 'violin', 'guitar', 'flute'],
  },
  action: {
    name: '动感激情',
    tags: ['动作', '激情', '能量', '激烈', '追逐'],
    tempo: 'fast',
    instruments: ['guitar', 'drums', 'bass', 'synth'],
  },
  mysterious: {
    name: '神秘奇幻',
    tags: ['奇幻', '神秘', '魔法', '冒险', '探索'],
    tempo: 'medium',
    instruments: ['synth', 'harp', 'flute', 'strings'],
  },
};

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const emotion = typeof body.emotion === 'string' ? body.emotion : 'peaceful';
  const sceneDescription = typeof body.sceneDescription === 'string' ? body.sceneDescription : '';
  const duration = typeof body.duration === 'number' ? body.duration : 60;
  const style = typeof body.style === 'string' ? body.style : 'anime';

  // 获取匹配的背景音乐风格
  const bgmStyle = BGM_STYLES[emotion as keyof typeof BGM_STYLES] || BGM_STYLES.peaceful;

  // 如果有场景描述，使用 AI 进一步细化推荐
  const recommendations = generateRecommendations(bgmStyle, emotion, duration);

  if (sceneDescription) {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
    try {
      const response = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: '你是一位音乐推荐专家。根据场景描述推荐合适的背景音乐。' },
          { role: 'user', content: `请为以下场景推荐背景音乐：\n\n场景描述：${sceneDescription}\n情绪：${bgmStyle.name}\n时长：${duration}秒\n风格：${style}\n\n请推荐3首合适的背景音乐，并描述每首音乐的特点和适合的场景氛围。` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiAnalysis = response.choices[0]?.message?.content || '';
      return NextResponse.json({
        success: true,
        emotion,
        recommendedStyle: bgmStyle,
        recommendations: {
          ...recommendations,
          aiAnalysis,
        },
        duration,
      });
    } catch (e) {
      logger.warn('[bgm-recommend] AI analysis failed:', e);
    }
  }

  return NextResponse.json({
    success: true,
    emotion,
    recommendedStyle: bgmStyle,
    recommendations,
    duration,
  });
}

function generateRecommendations(style: typeof BGM_STYLES[keyof typeof BGM_STYLES], emotion: string, duration: number) {
  const recommendations = [];

  // 根据风格生成推荐
  switch (style.tempo) {
    case 'slow':
      recommendations.push(
        {
          id: 'bgm-1',
          name: `${style.name}氛围曲`,
          description: `舒缓的${style.tags[0]}背景音乐，适合${duration}秒的${style.name}场景`,
          tempo: '慢',
          instruments: style.instruments.slice(0, 3),
          duration: duration,
          mood: emotion,
        },
        {
          id: 'bgm-2',
          name: `${style.name}情感曲`,
          description: `充满${style.name}情感的背景音乐，适合需要表达细腻情感的场景`,
          tempo: '慢',
          instruments: style.instruments.slice(1, 4),
          duration: duration,
          mood: emotion,
        }
      );
      break;
    case 'medium':
    case 'medium-fast':
      recommendations.push(
        {
          id: 'bgm-1',
          name: `${style.name}氛围曲`,
          description: `适中节奏的${style.name}背景音乐，适合中等节奏的场景`,
          tempo: style.tempo,
          instruments: style.instruments.slice(0, 3),
          duration: duration,
          mood: emotion,
        },
        {
          id: 'bgm-2',
          name: `${style.name}动感曲`,
          description: `带有${style.tags[0]}元素的动感背景音乐`,
          tempo: style.tempo,
          instruments: style.instruments.slice(1, 4),
          duration: duration,
          mood: emotion,
        }
      );
      break;
    case 'fast':
      recommendations.push(
        {
          id: 'bgm-1',
          name: `${style.name}快节奏曲`,
          description: `充满活力的${style.name}背景音乐，适合快节奏场景`,
          tempo: '快',
          instruments: style.instruments.slice(0, 3),
          duration: duration,
          mood: emotion,
        },
        {
          id: 'bgm-2',
          name: `${style.name}激情曲`,
          description: `动感十足的${style.name}背景音乐，适合激烈动作场景`,
          tempo: '快',
          instruments: style.instruments.slice(1, 4),
          duration: duration,
          mood: emotion,
        }
      );
      break;
  }

  return {
    count: recommendations.length,
    items: recommendations,
    suggestedTags: style.tags,
    suggestedInstruments: style.instruments,
  };
}

// GET: 获取可用的背景音乐风格
export async function GET() {
  return NextResponse.json({
    styles: Object.entries(BGM_STYLES).map(([key, value]) => ({
      key,
      name: value.name,
      tags: value.tags,
      tempo: value.tempo,
      instruments: value.instruments,
    })),
  });
}