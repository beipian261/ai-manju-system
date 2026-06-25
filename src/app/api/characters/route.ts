import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { isSafeExternalUrl } from '@/lib/utils/url-guard';
import { listCharactersByProject, createCharacter } from '@/features/characters/character.service';
import { successResponse, createdResponse, errorResponse, handleApiError, parseJsonBody } from '@/lib/api/response';

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

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (projectId) {
      const characters = await listCharactersByProject(projectId);
      return successResponse(characters);
    }
    const characters = await prisma.character.findMany({ orderBy: { createdAt: 'desc' } });
    return successResponse(characters);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{
      name?: string;
      projectId?: string;
      age?: string;
      gender?: string;
      personality?: string;
      clothing?: string;
      appearance?: string;
      hair?: string;
      eyes?: string;
      build?: string;
      referenceImg?: string;
    }>(req);

    if (!body.projectId) {
      return errorResponse('projectId 必填', 400);
    }

    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) {
      return errorResponse('项目不存在', 404);
    }

    let referenceImg: string | undefined;
    if (body.referenceImg !== undefined) {
      referenceImg = sanitizeReferenceImg(body.referenceImg) ?? undefined;
    }

    const character = await createCharacter({
      projectId: body.projectId,
      name: body.name ?? '',
      age: body.age,
      gender: body.gender,
      personality: body.personality,
      clothing: body.clothing,
      appearance: body.appearance,
      hair: body.hair,
      eyes: body.eyes,
      build: body.build,
    });

    if (referenceImg) {
      await prisma.character.update({
        where: { id: character.id },
        data: { referenceImg },
      });
    }

    const result = await prisma.character.findUnique({ where: { id: character.id } });
    return createdResponse(result);
  } catch (e) {
    return handleApiError(e);
  }
}
