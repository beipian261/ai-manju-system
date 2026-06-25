import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import { reorderStoryboards } from '@/features/storyboards/storyboard.service';
import { logger } from '@/lib/utils/logger';
import { successResponse, errorResponse, handleApiError, parseJsonBody } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{ storyboardIds?: string[] }>(req);
    const storyboardIds = Array.isArray(body.storyboardIds)
      ? body.storyboardIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (storyboardIds.length === 0) {
      return errorResponse('storyboardIds 不能为空', 400);
    }

    await reorderStoryboards(storyboardIds);
    return successResponse({ ok: true });
  } catch (e) {
    logger.error('[reorder] Failed to reorder storyboards:', e);
    return handleApiError(e);
  }
}
