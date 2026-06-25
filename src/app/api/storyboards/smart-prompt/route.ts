import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { emitProgress } from '@/lib/bus/progress-bus';
import {
  generateSmartStoryboardPrompt,
  generateSmartPromptsBatch,
  SmartPromptInput,
} from '@/features/generation/smart-prompt-engine';
import { logger } from '@/lib/utils/logger';

// ============================================================
// POST /api/storyboards/smart-prompt
// 智能分镜提示词生成
//
// 两种模式：
// 1. 单个：{ storyboardId } 或 { sceneDescription, projectId, ... } → 生成一个场景的智能提示词
// 2. 批量：{ batch: [storyboardId, ...] } → 一键优化整个剧本的所有分镜
//
// 批量模式支持 SSE 进度推送
// ============================================================

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max).trim();
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

  // ---------- 批量模式 ----------
  if (Array.isArray(body.batch) && body.batch.length > 0) {
    const storyboardIds = (body.batch as unknown[])
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 100); // 上限保护

    if (storyboardIds.length === 0) {
      return NextResponse.json({ error: 'batch 数组为空' }, { status: 400 });
    }

    // 异步处理 + 进度推送
    const projectId = typeof body.projectId === 'string' ? body.projectId : undefined;

    // 先返回 202，后台处理
    const batchId = `smart-batch:${Date.now()}`;
    emitProgress({
      type: 'storyboard',
      id: batchId,
      status: 'started',
      message: `开始批量智能优化 ${storyboardIds.length} 个分镜`,
      projectId,
    });

    // 后台执行（不 await，立即返回）
    generateSmartPromptsBatch(storyboardIds)
      .then((batchResult) => {
        emitProgress({
          type: 'storyboard',
          id: batchId,
          status: 'completed',
          progress: 100,
          message: `批量智能优化完成：成功 ${batchResult.succeeded}，降级 ${batchResult.fallbacked}，失败 ${batchResult.failed}`,
          projectId,
        });
      })
      .catch((e) => {
        emitProgress({
          type: 'storyboard',
          id: batchId,
          status: 'failed',
          message: `批量优化失败: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300),
          projectId,
        });
      });

    return NextResponse.json(
      {
        accepted: true,
        batchId,
        count: storyboardIds.length,
        message: '批量优化已提交，通过 SSE 接收进度',
      },
      { status: 202 }
    );
  }

  // ---------- 单个模式 ----------
  const storyboardId = trimStr(body.storyboardId, 100);
  const input: SmartPromptInput = {
    storyboardId: storyboardId || undefined,
    sceneDescription: trimStr(body.sceneDescription, 2000) || undefined,
    emotion: trimStr(body.emotion, 50) || undefined,
    location: trimStr(body.location, 200) || undefined,
    timeOfDay: trimStr(body.timeOfDay, 50) || undefined,
    cameraAngle: trimStr(body.cameraAngle, 50) || undefined,
    visualKeywords: trimStr(body.visualKeywords, 500) || undefined,
    artStyle: trimStr(body.artStyle, 50) || undefined,
    projectId: trimStr(body.projectId, 100) || undefined,
    prevCameraAngle: trimStr(body.prevCameraAngle, 50) || undefined,
    prevEmotion: trimStr(body.prevEmotion, 50) || undefined,
  };

  if (!input.storyboardId && !input.sceneDescription) {
    return NextResponse.json(
      { error: '需要提供 storyboardId 或 sceneDescription' },
      { status: 400 }
    );
  }

  try {
    const result = await generateSmartStoryboardPrompt(input);

    // 如果有 storyboardId，写回数据库
    if (storyboardId) {
      await prisma.storyboard.update({
        where: { id: storyboardId },
        data: {
          imagePrompt: result.finalPrompt,
          promptMode: 'smart',
          lighting: result.lighting || null,
          composition: result.composition || null,
          cameraMovement: result.cameraMovement || null,
          colorPalette: result.colorPalette || null,
          atmosphere: result.atmosphere || null,
        },
      });
    }

    return NextResponse.json({
      storyboardId: storyboardId || null,
      ...result,
    });
  } catch (e) {
    logger.error('[smart-prompt] error:', e);
    const msg = e instanceof Error ? e.message : '智能提示词生成失败';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
