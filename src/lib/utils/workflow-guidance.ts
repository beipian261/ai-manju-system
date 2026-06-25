import type { Project, Character, Script, Storyboard } from '@prisma/client';
import type { TabKey } from '@/lib/config/constants';

export interface StepProgress {
  key: TabKey;
  label: string;
  icon: string;
  percent: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'locked';
  issues: string[];
  suggestions: string[];
}

export interface WorkflowGuidance {
  overallPercent: number;
  currentStep: TabKey;
  recommendedNextStep: TabKey;
  recommendationReason: string;
  recommendedAction: string;
  actionButtonText: string;
  steps: StepProgress[];
  quickActions: Array<{
    label: string;
    icon: string;
    tab: TabKey;
    action?: string;
    primary?: boolean;
  }>;
}

export function analyzeWorkflow(
  project: Project,
  characters: Character[],
  scripts: Script[],
  storyboards: Storyboard[]
): WorkflowGuidance {
  const steps: StepProgress[] = [];

  // 1. 概览（总是完成/活跃）
  steps.push({
    key: 'overview',
    label: '概览',
    icon: '📊',
    percent: 100,
    status: 'completed',
    issues: [],
    suggestions: []
  });

  // 2. 剧本阶段
  const completedScripts = scripts.filter(s => s.status === 'completed').length;
  const hasAnyScript = scripts.length > 0;
  const scriptPercent = hasAnyScript ? (completedScripts > 0 ? 100 : 50) : 0;
  const scriptIssues: string[] = [];
  const scriptSuggestions: string[] = [];
  if (!hasAnyScript) {
    scriptIssues.push('还没有创建剧本');
    scriptSuggestions.push('点击"AI生成剧本"开始创作');
  } else if (completedScripts === 0) {
    scriptIssues.push('剧本还在生成中或未完成');
    scriptSuggestions.push('等待剧本生成完成，或手动编辑');
  }
  steps.push({
    key: 'script',
    label: '剧本',
    icon: '📝',
    percent: scriptPercent,
    status: !hasAnyScript ? 'not_started' : completedScripts > 0 ? 'completed' : 'in_progress',
    issues: scriptIssues,
    suggestions: scriptSuggestions
  });

  // 3. 角色阶段
  const charsWithRef = characters.filter(c => c.referenceImg).length;
  const charsLocked = characters.filter(c => c.dnaLocked).length;
  const charPercent = characters.length === 0 ? 0 : Math.round((charsLocked / Math.max(characters.length, 1)) * 100);
  const charIssues: string[] = [];
  const charSuggestions: string[] = [];
  if (characters.length === 0) {
    charIssues.push('还没有创建角色');
    charSuggestions.push('从剧本中提取角色，或手动创建');
  } else {
    if (charsWithRef < characters.length) {
      charIssues.push(`${characters.length - charsWithRef} 个角色还没有参考图`);
      charSuggestions.push('为角色上传参考图或AI生成形象');
    }
    if (charsWithRef > 0 && charsLocked < characters.length) {
      charIssues.push(`${characters.length - charsLocked} 个角色 DNA 未锁定`);
      charSuggestions.push('锁定角色DNA以保证出图一致性');
    }
  }
  steps.push({
    key: 'characters',
    label: '角色',
    icon: '🎭',
    percent: charPercent,
    status: characters.length === 0 ? 'not_started' : charsLocked === characters.length ? 'completed' : 'in_progress',
    issues: charIssues,
    suggestions: charSuggestions
  });

  // 4. 分镜阶段
  const storyboardsWithImage = storyboards.filter(s => s.imageUrls).length;
  const storyboardsWithApproved = storyboards.filter(s => s.reviewStatus === 'approved').length;
  const storyPercent = storyboards.length === 0 ? 0 : Math.round((storyboardsWithApproved / Math.max(storyboards.length, 1)) * 100);
  const storyIssues: string[] = [];
  const storySuggestions: string[] = [];
  if (storyboards.length === 0) {
    storyIssues.push('还生成分镜');
    storySuggestions.push('AI一键生成分镜');
  } else {
    if (storyboardsWithImage < storyboards.length) {
      storyIssues.push(`${storyboards.length - storyboardsWithImage} 个分镜还没有图片`);
      storySuggestions.push('批量生成所有分镜图片');
    }
    if (storyboardsWithImage > 0 && storyboardsWithApproved < storyboardsWithImage) {
      storyIssues.push(`${storyboardsWithImage - storyboardsWithApproved} 张图片待审核`);
      storySuggestions.push('检查并通过/重生成不满意的分镜');
    }
  }
  steps.push({
    key: 'storyboard',
    label: '分镜',
    icon: '🎬',
    percent: storyPercent,
    status: storyboards.length === 0 ? 'not_started' : storyboardsWithApproved === storyboards.length ? 'completed' : 'in_progress',
    issues: storyIssues,
    suggestions: storySuggestions
  });

  // 5. 配音阶段
  const storyboardsWithDialogue = storyboards.filter(s => s.dialogue).length;
  const voicePercent = storyboards.length === 0 ? 0 : Math.round((storyboardsWithDialogue / Math.max(storyboards.length, 1)) * 100);
  const voiceIssues: string[] = [];
  const voiceSuggestions: string[] = [];
  if (storyboards.length > 0 && storyboardsWithDialogue < storyboards.length * 0.8) {
    voiceIssues.push('大部分分镜还没有配音');
    voiceSuggestions.push('一键为所有台词生成配音');
  }
  steps.push({
    key: 'voice',
    label: '配音',
    icon: '🎙️',
    percent: Math.min(voicePercent, 100),
    status: storyboards.length === 0 ? 'locked' : storyboardsWithDialogue >= storyboards.length * 0.8 ? 'completed' : 'in_progress',
    issues: voiceIssues,
    suggestions: voiceSuggestions
  });

  // 6. 时间线阶段
  const timelineReady = storyboardsWithApproved > 0;
  steps.push({
    key: 'timeline',
    label: '时间线',
    icon: '🎞️',
    percent: timelineReady ? 50 : 0,
    status: !timelineReady ? 'locked' : 'in_progress',
    issues: timelineReady ? ['调整分镜顺序和时长，添加转场'] : [],
    suggestions: timelineReady ? ['预览并调整剪辑节奏'] : ['完成分镜图片后自动解锁']
  });

  // 7. 评审阶段
  const reviewReady = storyboardsWithApproved > 0;
  steps.push({
    key: 'review',
    label: '评审',
    icon: '✅',
    percent: reviewReady ? (project.status === 'completed' ? 100 : 30) : 0,
    status: !reviewReady ? 'locked' : 'in_progress',
    issues: reviewReady ? ['最终检查所有内容'] : [],
    suggestions: reviewReady ? ['预览完整视频，添加评审意见'] : ['完成内容制作后开始评审']
  });

  // 8. 发布阶段
  const publishReady = storyboardsWithApproved > 0;
  steps.push({
    key: 'publish',
    label: '发布',
    icon: '🚀',
    percent: publishReady ? (project.status === 'completed' ? 100 : 0) : 0,
    status: !publishReady ? 'locked' : 'in_progress',
    issues: [],
    suggestions: publishReady ? ['导出适配各平台的视频'] : ['制作完成后即可导出发布']
  });

  // 计算总体进度
  const totalPercent = steps.reduce((sum, s) => sum + s.percent, 0) / steps.length;
  const overallPercent = Math.round(totalPercent);

  // 找到推荐的下一步
  let recommendedNextStep: TabKey = 'overview';
  let recommendationReason = '';
  let recommendedAction = '';
  let actionButtonText = '开始';

  const notCompleted = steps.find(s => s.status !== 'completed' && s.status !== 'locked');
  if (notCompleted) {
    recommendedNextStep = notCompleted.key;
    if (notCompleted.issues.length > 0) {
      recommendationReason = notCompleted.issues[0];
      recommendedAction = notCompleted.suggestions[0] || '';
      actionButtonText = notCompleted.key === 'script' ? '写剧本' :
        notCompleted.key === 'characters' ? '设置角色' :
        notCompleted.key === 'storyboard' ? '生成分镜' :
        notCompleted.key === 'voice' ? '生成配音' :
        notCompleted.key === 'timeline' ? '去剪辑' :
        notCompleted.key === 'review' ? '去评审' : '去发布';
    } else {
      recommendationReason = `继续完成${notCompleted.label}阶段`;
      recommendedAction = '';
      actionButtonText = `去${notCompleted.label}`;
    }
  } else {
    recommendedNextStep = 'publish';
    recommendationReason = '🎉 所有制作步骤已完成，可以导出发布了！';
    recommendedAction = '导出多平台视频';
    actionButtonText = '立即发布';
  }

  // 确定当前步骤（第一个未完成的非锁定步骤）
  const currentStep = steps.find(s => s.status === 'in_progress')?.key || recommendedNextStep;

  // 快捷操作
  const quickActions: WorkflowGuidance['quickActions'] = [];
  
  if (scripts.length === 0) {
    quickActions.push({ label: 'AI生成剧本', icon: '✨', tab: 'script', primary: true });
  }
  if (scripts.length > 0 && characters.length === 0) {
    quickActions.push({ label: '提取角色', icon: '🎭', tab: 'characters', primary: true });
  }
  if (characters.length > 0 && charsWithRef < characters.length) {
    quickActions.push({ label: '生成角色形象', icon: '🖼️', tab: 'characters' });
  }
  if (characters.length > 0 && storyboards.length === 0) {
    quickActions.push({ label: '一键生成分镜', icon: '🎬', tab: 'storyboard', primary: true });
  }
  if (storyboards.length > 0 && storyboardsWithImage < storyboards.length) {
    quickActions.push({ label: '批量生图', icon: '🖼️', tab: 'storyboard' });
  }
  if (storyboardsWithApproved > 0 && storyboardsWithDialogue < storyboards.length * 0.8) {
    quickActions.push({ label: '批量配音', icon: '🎙️', tab: 'voice' });
  }
  if (storyboardsWithApproved > 0) {
    quickActions.push({ label: '预览视频', icon: '▶️', tab: 'timeline' });
  }
  if (storyboardsWithApproved === storyboards.length && storyboards.length > 0) {
    quickActions.push({ label: '导出发布', icon: '🚀', tab: 'publish', primary: true });
  }

  return {
    overallPercent,
    currentStep,
    recommendedNextStep,
    recommendationReason,
    recommendedAction,
    actionButtonText,
    steps,
    quickActions
  };
}
