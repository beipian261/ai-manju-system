import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { isSafeExternalUrl } from '@/lib/utils/url-guard';
import { getStoryboardById, updateStoryboard, deleteStoryboard } from '@/features/storyboards/storyboard.service';
import { successResponse, handleApiError, parseJsonBody, notFoundResponse, errorResponse } from '@/lib/api/response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const storyboard = await getStoryboardById(id);
    if (!storyboard) return notFoundResponse('分镜不存在');
    return successResponse(storyboard);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const data: Parameters<typeof updateStoryboard>[1] = {};

    if (typeof body.sceneNum === 'number') data.sceneNum = Math.max(0, Math.floor(body.sceneNum));
    if (typeof body.title === 'string') data.title = body.title.slice(0, 200);
    if (typeof body.description === 'string') data.description = body.description.slice(0, 2000);
    if (typeof body.cameraAngle === 'string') data.cameraAngle = body.cameraAngle.slice(0, 200);
    if (typeof body.dialogue === 'string') data.dialogue = body.dialogue.slice(0, 2000);
    else if (body.dialogue === null) data.dialogue = null;
    if (typeof body.emotion === 'string') data.emotion = body.emotion.slice(0, 100);
    else if (body.emotion === null) data.emotion = null;
    if (typeof body.imagePrompt === 'string') data.imagePrompt = body.imagePrompt.slice(0, 4000);
    else if (body.imagePrompt === null) data.imagePrompt = null;
    if (typeof body.location === 'string') data.location = body.location.slice(0, 300);
    else if (body.location === null) data.location = null;
    if (typeof body.timeOfDay === 'string') data.timeOfDay = body.timeOfDay.slice(0, 50);
    else if (body.timeOfDay === null) data.timeOfDay = null;
    if (typeof body.visualKeywords === 'string') data.visualKeywords = body.visualKeywords.slice(0, 500);
    else if (body.visualKeywords === null) data.visualKeywords = null;
    if (typeof body.lighting === 'string') data.lighting = body.lighting.slice(0, 50);
    else if (body.lighting === null) data.lighting = null;
    if (typeof body.composition === 'string') data.composition = body.composition.slice(0, 50);
    else if (body.composition === null) data.composition = null;
    if (typeof body.cameraMovement === 'string') data.cameraMovement = body.cameraMovement.slice(0, 50);
    else if (body.cameraMovement === null) data.cameraMovement = null;
    if (typeof body.colorPalette === 'string') data.colorPalette = body.colorPalette.slice(0, 50);
    else if (body.colorPalette === null) data.colorPalette = null;
    if (typeof body.atmosphere === 'string') data.atmosphere = body.atmosphere.slice(0, 500);
    else if (body.atmosphere === null) data.atmosphere = null;
    if (typeof body.charactersInScene === 'string') data.charactersInScene = body.charactersInScene.slice(0, 1000);
    else if (body.charactersInScene === null) data.charactersInScene = null;
    if (typeof body.promptMode === 'string' && ['rule', 'smart'].includes(body.promptMode)) {
      data.promptMode = body.promptMode;
    }
    if (typeof body.duration === 'number') data.duration = Math.max(0, body.duration);
    if (typeof body.reviewStatus === 'string') data.reviewStatus = body.reviewStatus;
    if (typeof body.qualityScore === 'number') data.qualityScore = body.qualityScore;
    if (typeof body.videoUrl === 'string') data.videoUrl = body.videoUrl;
    if (typeof body.videoTaskId === 'string') data.videoTaskId = body.videoTaskId;
    if (typeof body.videoStatus === 'string') data.videoStatus = body.videoStatus;

    if (body.imageUrls !== undefined) {
      const raw = typeof body.imageUrls === 'string' ? body.imageUrls.trim() : '';
      if (raw.length === 0) {
        data.imageUrls = null;
      } else if (raw.startsWith('data:image/') || isSafeExternalUrl(raw)) {
        data.imageUrls = raw.slice(0, 50000);
      } else {
        return errorResponse('imageUrls 必须为合法 HTTPS 图片地址或 data URI', 400);
      }
    }

    const storyboard = await updateStoryboard(id, data);
    return successResponse(storyboard);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    await deleteStoryboard(id);
    return successResponse({ deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
