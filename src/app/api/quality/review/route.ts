// 智能质量评审助手 API
// AI 自动检查作品质量，提供改进建议
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import prisma from '@/lib/prisma-client';
import type { StoryboardSnapshot } from '@/types';

// 质量检查项
const QUALITY_CHECKS = {
  characterConsistency: {
    name: '角色一致性',
    description: '检查角色在不同分镜中的外观和设定是否一致',
    weight: 3,
  },
  timingConsistency: {
    name: '时长一致性',
    description: '检查分镜时长与配音时长是否匹配',
    weight: 3,
  },
  emotionConsistency: {
    name: '情绪一致性',
    description: '检查情绪表达是否连贯',
    weight: 2,
  },
  visualQuality: {
    name: '画面质量',
    description: '检查图片质量是否符合要求',
    weight: 2,
  },
  contentCompleteness: {
    name: '内容完整性',
    description: '检查是否有缺失的内容',
    weight: 3,
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

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 获取项目数据
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scripts: true,
      characters: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // 获取分镜
  const storyboards = await prisma.storyboard.findMany({
    where: { script: { projectId } },
    orderBy: { sceneNum: 'asc' },
  });

  if (storyboards.length === 0) {
    return NextResponse.json({ error: '没有分镜数据' }, { status: 400 });
  }

  // 执行质量检查
  const results = await performQualityChecks(project, storyboards);

  // 生成综合报告
  const report = generateReport(results);

  return NextResponse.json({
    success: true,
    projectId,
    projectName: project.title,
    report,
    checks: results,
  });
}

async function performQualityChecks(project: { characters: Array<{ name: string }>; scripts: Array<{ id: string }> }, storyboards: StoryboardSnapshot[]) {
  const results: Record<string, { passed: boolean; issues: string[]; suggestions: string[] }> = {};

  // 1. 角色一致性检查
  results.characterConsistency = checkCharacterConsistency(project.characters, storyboards);

  // 2. 时长一致性检查
  results.timingConsistency = checkTimingConsistency(storyboards);

  // 3. 情绪一致性检查
  results.emotionConsistency = checkEmotionConsistency(storyboards);

  // 4. 画面质量检查
  results.visualQuality = checkVisualQuality(storyboards);

  // 5. 内容完整性检查
  results.contentCompleteness = checkContentCompleteness(project.scripts, storyboards);

  return results;
}

function checkCharacterConsistency(characters: Array<{ name: string }>, storyboards: StoryboardSnapshot[]) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 检查每个分镜中的角色是否在角色列表中定义
  for (const sb of storyboards) {
    if (sb.charactersInScene) {
      const chars = sb.charactersInScene.split(',').map((c: string) => c.trim()).filter(Boolean);
      for (const char of chars) {
        if (!characters.some(c => c.name === char)) {
          issues.push(`分镜 #${sb.sceneNum} 中的角色「${char}」未在角色列表中定义`);
          suggestions.push(`请在角色管理中添加「${char}」的设定`);
        }
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  };
}

function checkTimingConsistency(storyboards: StoryboardSnapshot[]) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  for (const sb of storyboards) {
    const dialogue = sb.dialogue || '';
    const dialogueDuration = Math.ceil(dialogue.length / 3.5); // 约3.5字/秒
    const actualDuration = sb.duration || 5;

    // 检查时长是否合理
    if (actualDuration < 2 && dialogue.length > 0) {
      issues.push(`分镜 #${sb.sceneNum} 时长(${actualDuration}s)过短，可能无法完整播放台词(${dialogue.length}字)`);
      suggestions.push(`建议将分镜 #${sb.sceneNum} 的时长调整为至少 ${Math.max(2, dialogueDuration)} 秒`);
    }

    if (actualDuration > 30) {
      issues.push(`分镜 #${sb.sceneNum} 时长(${actualDuration}s)过长，建议拆分`);
      suggestions.push(`考虑将分镜 #${sb.sceneNum} 拆分为多个分镜`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  };
}

function checkEmotionConsistency(storyboards: StoryboardSnapshot[]) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 检查情绪是否有突然变化
  for (let i = 1; i < storyboards.length; i++) {
    const prevEmotion = storyboards[i - 1].emotion || 'neutral';
    const currEmotion = storyboards[i].emotion || 'neutral';
    
    const conflictingEmotions: Record<string, string[]> = {
      happy: ['sad', 'angry', 'fear'],
      sad: ['happy', 'excited'],
      angry: ['happy', 'peaceful'],
      peaceful: ['angry', 'fear'],
      fear: ['happy', 'peaceful'],
    };

    if (conflictingEmotions[prevEmotion]?.includes(currEmotion)) {
      issues.push(`分镜 #${storyboards[i - 1].sceneNum} 到 #${storyboards[i].sceneNum} 情绪变化过于突然(${prevEmotion} → ${currEmotion})`);
      suggestions.push(`建议在分镜 #${storyboards[i - 1].sceneNum} 和 #${storyboards[i].sceneNum} 之间添加过渡场景`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  };
}

function checkVisualQuality(storyboards: StoryboardSnapshot[]) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  for (const sb of storyboards) {
    if (!sb.imageUrls || (typeof sb.imageUrls === 'string' && !sb.imageUrls)) {
      issues.push(`分镜 #${sb.sceneNum} 缺少图片`);
      suggestions.push(`请为分镜 #${sb.sceneNum} 生成图片`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  };
}

function checkContentCompleteness(scripts: Array<{ id: string }>, storyboards: StoryboardSnapshot[]) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 检查是否有剧本
  if (scripts.length === 0) {
    issues.push('项目缺少剧本');
    suggestions.push('请先生成或导入剧本');
  }

  // 检查分镜数量
  if (storyboards.length < 3) {
    issues.push('分镜数量较少，可能无法完整表达故事');
    suggestions.push('建议增加分镜数量以丰富故事内容');
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  };
}

function generateReport(checks: Record<string, { passed: boolean; issues: string[]; suggestions: string[] }>) {
  const totalWeight = Object.values(QUALITY_CHECKS).reduce((acc, c) => acc + c.weight, 0);
  let score = 0;
  let totalIssues = 0;

  for (const [key, result] of Object.entries(checks)) {
    if (result.passed) {
      score += QUALITY_CHECKS[key as keyof typeof QUALITY_CHECKS].weight;
    }
    totalIssues += result.issues.length;
  }

  const percentage = Math.round((score / totalWeight) * 100);
  
  let status: 'excellent' | 'good' | 'warning' | 'error' = 'good';
  let statusText = '';
  
  if (percentage >= 90) {
    status = 'excellent';
    statusText = '优秀';
  } else if (percentage >= 70) {
    status = 'good';
    statusText = '良好';
  } else if (percentage >= 50) {
    status = 'warning';
    statusText = '需改进';
  } else {
    status = 'error';
    statusText = '需修复';
  }

  return {
    score: percentage,
    status,
    statusText,
    totalIssues,
    summary: totalIssues === 0 
      ? '作品质量优秀，没有发现明显问题' 
      : `发现 ${totalIssues} 个问题需要修复`,
    recommendations: Object.values(checks)
      .flatMap(c => c.suggestions)
      .slice(0, 5),
  };
}

// GET: 获取质量检查项列表
export async function GET() {
  return NextResponse.json({
    checks: Object.entries(QUALITY_CHECKS).map(([key, value]) => ({
      key,
      ...value,
    })),
  });
}