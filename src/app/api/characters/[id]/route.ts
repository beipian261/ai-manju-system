import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { isSafeExternalUrl } from '@/lib/utils/url-guard';
import { getCharacterById, updateCharacter, deleteCharacter } from '@/features/characters/character.service';
import { successResponse, handleApiError, parseJsonBody, notFoundResponse, errorResponse } from '@/lib/api/response';

function sanitizeReferenceImg(refRaw: string): string | null {
  const trimmed = refRaw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('data:image/')) {
    return trimmed.slice(0, 2000);
  }
  if (isSafeExternalUrl(trimmed)) {
    return trimmed.slice(0, 2000);
  }
  throw Object.assign(
    new Error('referenceImg 必须为公开的 HTTPS 图片地址或合法 data URI'),
    { status: 400 }
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const character = await getCharacterById(id);
    if (!character) {
      return notFoundResponse('角色不存在');
    }
    return successResponse(character);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{
      name?: string;
      age?: string;
      gender?: string;
      personality?: string;
      clothing?: string;
      appearance?: string;
      hair?: string;
      eyes?: string;
      build?: string;
      referenceImg?: string | null;
      expressions?: string;
      signaturePose?: string;
      colorScheme?: string;
    }>(req);

    const updateData: Parameters<typeof updateCharacter>[1] = { ...body };

    if (body.referenceImg !== undefined) {
      if (body.referenceImg === null || body.referenceImg === '') {
        updateData.referenceImg = null;
      } else {
        updateData.referenceImg = sanitizeReferenceImg(body.referenceImg);
      }
    }

    const character = await updateCharacter(id, updateData);
    return successResponse(character);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    await deleteCharacter(id);
    return successResponse({ deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
