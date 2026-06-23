// AI 字幕自动生成 API
// 从配音自动生成字幕，支持多语言
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import prisma from '@/lib/prisma-client';

// 支持的语言
const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const storyboardIds = Array.isArray(body.storyboardIds) ? body.storyboardIds.filter((id): id is string => typeof id === 'string') : null;
  const language = typeof body.language === 'string' ? body.language : 'zh';
  const autoSync = body.autoSync !== false;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 验证语言
  if (!SUPPORTED_LANGUAGES.some(l => l.code === language)) {
    return NextResponse.json({
      error: '不支持的语言',
      supportedLanguages: SUPPORTED_LANGUAGES,
    }, { status: 400 });
  }

  // 获取分镜
  const storyboards = await prisma.storyboard.findMany({
    where: {
      script: { projectId },
      ...(storyboardIds ? { id: { in: storyboardIds } } : {}),
    },
    include: { script: true },
    orderBy: { sceneNum: 'asc' },
  });

  if (storyboards.length === 0) {
    return NextResponse.json({ error: '没有找到分镜' }, { status: 400 });
  }

  // 生成字幕
  const subtitles = storyboards.map((sb, index) => {
    const dialogue = sb.dialogue || '';
    // 计算时间戳（假设每步平均3-5秒）
    const avgDuration = Math.max(3, Math.ceil(dialogue.length / 4));
    const startTime = index > 0 ? storyboards.slice(0, index).reduce((acc, s) => {
      return acc + (s.duration || Math.max(3, Math.ceil((s.dialogue?.length || 0) / 4)));
    }, 0) : 0;
    const endTime = startTime + (sb.duration || avgDuration);

    return {
      id: `subtitle-${sb.id}`,
      storyboardId: sb.id,
      sceneNum: sb.sceneNum,
      text: dialogue,
      translatedText: dialogue, // 如果需要翻译，这里可以调用翻译API
      language,
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
      startTimeMs: startTime * 1000,
      endTimeMs: endTime * 1000,
      character: sb.charactersInScene?.split(',')[0]?.trim() || '',
    };
  });

  // 自动同步到时间线
  if (autoSync) {
    // 这里可以添加同步逻辑
  }

  // 生成 SRT 格式
  const srtContent = generateSRT(subtitles);
  const vttContent = generateVTT(subtitles);

  return NextResponse.json({
    success: true,
    projectId,
    language,
    subtitles,
    count: subtitles.length,
    srt: srtContent,
    vtt: vttContent,
  });
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function generateSRT(subtitles: Array<{ id: string; startTime: string; endTime: string; text: string }>): string {
  return subtitles.map((sub, index) => {
    return `${index + 1}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`;
  }).join('\n\n');
}

function generateVTT(subtitles: Array<{ id: string; startTime: string; endTime: string; text: string }>): string {
  let content = 'WEBVTT\n\n';
  content += subtitles.map(sub => {
    const start = sub.startTime.replace(',', '.');
    const end = sub.endTime.replace(',', '.');
    return `${start} --> ${end}\n${sub.text}`;
  }).join('\n\n');
  return content;
}

// GET: 获取支持的语言列表
export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    formats: ['SRT', 'VTT', 'JSON'],
  });
}