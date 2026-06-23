// 快速预览模式 API
// 低分辨率快速预览整个作品
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import prisma from '@/lib/prisma-client';

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
  const resolution = typeof body.resolution === 'string' ? body.resolution : 'low';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  // 获取项目和分镜
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const storyboards = await prisma.storyboard.findMany({
    where: { script: { projectId } },
    orderBy: { sceneNum: 'asc' },
  });

  // 生成预览数据
  const previewData = await generatePreviewData(storyboards, resolution);

  // 生成故事梗概
  const summary = generateStorySummary(storyboards);

  return NextResponse.json({
    success: true,
    projectId,
    projectName: project.title,
    resolution,
    totalScenes: storyboards.length,
    preview: previewData,
    summary,
    estimatedDuration: calculateTotalDuration(storyboards),
  });
}

async function generatePreviewData(storyboards: any[], resolution: string) {
  const size = resolution === 'low' ? '256x144' : resolution === 'medium' ? '512x288' : '1024x576';
  
  return storyboards.map(sb => {
    const imageUrl = sb.imageUrls 
      ? (typeof sb.imageUrls === 'string' ? sb.imageUrls.split(',')[0] : sb.imageUrls[0])
      : null;
    
    return {
      sceneNum: sb.sceneNum,
      id: sb.id,
      description: sb.description || '无描述',
      dialogue: sb.dialogue || '',
      emotion: sb.emotion || 'neutral',
      duration: sb.duration || 5,
      imageUrl: imageUrl ? `${imageUrl}&size=${size}` : null,
      thumbnailUrl: imageUrl ? `${imageUrl}&size=${size}` : null,
      characters: sb.charactersInScene?.split(',').map((c: string) => c.trim()).filter(Boolean) || [],
    };
  });
}

function generateStorySummary(storyboards: any[]): string {
  if (storyboards.length === 0) return '暂无内容';
  
  const firstScene = storyboards[0];
  const lastScene = storyboards[storyboards.length - 1];
  
  let summary = '';
  
  // 根据分镜描述生成简单梗概
  const descriptions = storyboards.map(sb => sb.description).filter(Boolean);
  
  if (descriptions.length >= 3) {
    summary = `${descriptions[0]}。接着，${descriptions[Math.floor(descriptions.length / 2)]}。最后，${descriptions[descriptions.length - 1]}。`;
  } else if (descriptions.length === 2) {
    summary = `${descriptions[0]}，然后${descriptions[1]}。`;
  } else if (descriptions.length === 1) {
    summary = descriptions[0];
  }
  
  return summary || '故事围绕多个场景展开...';
}

function calculateTotalDuration(storyboards: any[]): number {
  return storyboards.reduce((acc, sb) => acc + (sb.duration || 5), 0);
}

// GET: 获取预览选项
export async function GET() {
  return NextResponse.json({
    resolutions: [
      { key: 'low', name: '低分辨率', size: '256x144', description: '最快加载速度' },
      { key: 'medium', name: '中等分辨率', size: '512x288', description: '平衡质量与速度' },
      { key: 'high', name: '高分辨率', size: '1024x576', description: '最佳预览质量' },
    ],
    features: [
      '快速渲染所有分镜缩略图',
      '提供故事梗概预览',
      '支持快速跳转',
      '低带宽友好',
    ],
  });
}