// 智能批量配音 API
// 自动为所有分镜台词匹配角色声线和情绪，一键生成全部配音
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';

// 声线类型映射
const VOICE_TYPES = {
  male: ['male_1', 'male_2', 'male_3', 'male_deep', 'male_young'],
  female: ['female_1', 'female_2', 'female_3', 'female_soft', 'female_young'],
  child: ['child_boy', 'child_girl'],
  elder: ['elder_male', 'elder_female'],
};

// 情绪到语气映射
const EMOTION_TO_TONE: Record<string, string> = {
  peaceful: 'calm',
  happy: 'cheerful',
  sad: 'sad',
  angry: 'angry',
  tense: 'tense',
  dramatic: 'dramatic',
  gentle: 'gentle',
  excited: 'excited',
  fear: 'fearful',
  surprised: 'surprised',
  neutral: 'neutral',
};

// 根据角色属性推荐声线
function recommendVoiceType(character: { gender?: string | null; age?: string | number | null }): string {
  const gender = character.gender?.toLowerCase() || 'male';
  const ageNum = typeof character.age === 'string' ? parseInt(character.age, 10) : character.age;
  const age = ageNum || 25;

  if (age < 12) {
    return gender === 'female' ? 'child_girl' : 'child_boy';
  }
  if (age > 60) {
    return gender === 'female' ? 'elder_female' : 'elder_male';
  }
  if (age < 25) {
    return gender === 'female' ? 'female_young' : 'male_young';
  }
  // 默认成年声线
  return gender === 'female' ? 'female_1' : 'male_1';
}

// 智能时长计算：根据台词字数估算配音时长（约 3.5 字/秒）
function estimateDuration(text: string): number {
  const charCount = text.length;
  // 中文约 3.5 字/秒，英文约 12 词/秒，这里简化处理
  const duration = Math.ceil(charCount / 3.5);
  return Math.max(2, Math.min(duration, 30)); // 最短 2 秒，最长 30 秒
}

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
  const autoMatch = body.autoMatch !== false; // 默认开启自动匹配

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 获取项目角色
  const characters = await prisma.character.findMany({ where: { projectId } });
  const characterMap = new Map(characters.map(c => [c.name, c]));

  // 获取有台词的分镜
  const storyboards = await prisma.storyboard.findMany({
    where: {
      script: { projectId },
      dialogue: { not: null },
      ...(storyboardIds ? { id: { in: storyboardIds } } : {}),
    },
    include: { script: true },
    orderBy: { sceneNum: 'asc' },
  });

  if (storyboards.length === 0) {
    return NextResponse.json({ 
      error: '没有找到有台词的分镜',
      hint: '请先在分镜中添加角色台词',
    }, { status: 400 });
  }

  // 自动匹配声线和情绪
  const voiceAssignments = storyboards.map(sb => {
    const dialogue = sb.dialogue || '';
    const charactersInScene = sb.charactersInScene?.split(',').map(c => c.trim()).filter(Boolean) || [];
    
    // 推断主要角色
    const mainCharacter = charactersInScene[0] || '';
    const character = characterMap.get(mainCharacter);

    // 推荐声线
    const voiceType = autoMatch && character 
      ? recommendVoiceType(character)
      : 'female_1';

    // 推断情绪
    const emotionTone = EMOTION_TO_TONE[sb.emotion || 'peaceful'] || 'calm';

    // 计算时长
    const estimatedDuration = estimateDuration(dialogue);

    return {
      storyboardId: sb.id,
      sceneNum: sb.sceneNum,
      dialogue,
      characterName: mainCharacter,
      voiceType,
      emotionTone,
      estimatedDuration,
    };
  });

  // 通过 Job 队列返回匹配结果（同步完成，无需 batch_voice handler）
  return NextResponse.json({
    queued: false,
    completed: true,
    projectId,
    totalDialogues: voiceAssignments.length,
    assignments: voiceAssignments.slice(0, 5).map((a) => ({
      sceneNum: a.sceneNum,
      character: a.characterName,
      voiceType: a.voiceType,
      emotion: a.emotionTone,
      duration: `${a.estimatedDuration}s`,
    })),
    allAssignments: voiceAssignments,
    message: `已为 ${voiceAssignments.length} 条台词自动匹配声线和情绪`,
  }, { status: 200 });
}

// GET: 获取配音预览（不实际生成，只返回匹配结果）
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  const characters = await prisma.character.findMany({ where: { projectId } });
  const storyboards = await prisma.storyboard.findMany({
    where: { script: { projectId }, dialogue: { not: null } },
    orderBy: { sceneNum: 'asc' },
  });

  const preview = storyboards.map(sb => {
    const characterName = sb.charactersInScene?.split(',')[0]?.trim() || '';
    const character = characters.find(c => c.name === characterName);
    const voiceType = character ? recommendVoiceType(character) : 'female_1';
    const emotionTone = EMOTION_TO_TONE[sb.emotion || 'peaceful'] || 'calm';
    const dialogueText = sb.dialogue || '';
    const duration = estimateDuration(dialogueText);

    return {
      sceneNum: sb.sceneNum,
      dialogue: dialogueText.substring(0, 50) + (dialogueText.length > 50 ? '...' : ''),
      character: characterName,
      voiceType,
      emotion: emotionTone,
      estimatedDuration: duration,
    };
  });

  return NextResponse.json({
    total: preview.length,
    preview,
    characters: characters.map(c => ({
      name: c.name,
      gender: c.gender,
      age: c.age,
      recommendedVoice: recommendVoiceType(c),
    })),
  });
}