import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

// 获取项目的分镜列表（用于导演模式场景选择）
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  try {
    const storyboards = await prisma.storyboard.findMany({
      where: { script: { projectId } },
      orderBy: { sceneNum: 'asc' },
      select: {
        id: true,
        sceneNum: true,
        title: true,
        description: true,
        dialogue: true,
        emotion: true,
        location: true,
        timeOfDay: true,
        cameraAngle: true,
        visualKeywords: true,
        imageUrls: true,
        lighting: true,
        composition: true,
        colorPalette: true,
      },
    });

    // 判断每个场景的状态
    const scenes = storyboards.map(sb => {
      const hasImage = !!sb.imageUrls;
      const hasLighting = !!sb.lighting;
      let status: 'reviewed' | 'analyzing' | 'pending' = 'pending';
      if (hasImage && hasLighting) status = 'reviewed';
      else if (hasImage || hasLighting) status = 'analyzing';

      return {
        id: sb.id,
        sceneNum: sb.sceneNum,
        name: `第${sb.sceneNum}场 - ${sb.title || '未命名场景'}`,
        status,
        description: sb.description,
        dialogue: sb.dialogue,
        emotion: sb.emotion,
        location: sb.location,
        timeOfDay: sb.timeOfDay,
        cameraAngle: sb.cameraAngle,
        visualKeywords: sb.visualKeywords,
        hasImage,
      };
    });

    return NextResponse.json({ scenes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load scenes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
