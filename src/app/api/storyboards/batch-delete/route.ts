import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import { deleteStoryboards } from '@/features/storyboards/storyboard.service';
import { logger } from '@/lib/utils/logger';
import { successResponse, errorResponse, handleApiError, parseJsonBody } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{ ids?: string[] }>(req);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : [];

    if (ids.length === 0) {
      return errorResponse('ids 不能为空', 400);
    }

    const result = await deleteStoryboards(ids);
    return successResponse({ deletedCount: result.count });
  } catch (e) {
    logger.error('[batch-delete] Failed to delete storyboards:', e);
    return handleApiError(e);
  }
}
