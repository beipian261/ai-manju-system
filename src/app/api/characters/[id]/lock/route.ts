import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { getSetting } from '@/lib/config/settings';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { buildCharacterSheet } from '@/features/characters/character-prompt';
import { logger } from '@/lib/utils/logger';
import { successResponse, errorResponse, handleApiError, parseJsonBody, notFoundResponse } from '@/lib/api/response';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const character = await prisma.character.findUnique({
      where: { id },
      include: { assets: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
    });
    if (!character) {
      return notFoundResponse('角色不存在');
    }

    let body: { lock?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // body 可选
    }
    const lock = body.lock !== false;

    if (lock) {
      if (character.assets.length === 0 && !character.referenceImg) {
        return errorResponse('锁定 DNA 需要至少 1 张参考图，请先上传', 400);
      }

      let dnaSummary = character.dnaSummary;
      if (!dnaSummary) {
        try {
          const sheet = buildCharacterSheet(character);
          const CHAT_MODEL = await getSetting('AGNES_CHAT_MODEL');

          const summaryResponse = await chatCompletion({
            model: CHAT_MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'You are a character design assistant. Generate a concise English visual summary of this character for AI image generation. Focus on: face shape, hair color and style, eye color, body type, clothing, and any distinctive features. Keep it under 200 words. Output ONLY the summary, no preamble.',
              },
              { role: 'user', content: sheet.englishDescription },
            ],
            temperature: 0.3,
            max_tokens: 300,
          });

          dnaSummary = summaryResponse.choices?.[0]?.message?.content?.trim() || null;
        } catch (e) {
          logger.warn('[character-dna] AI summary generation failed:', e);
        }
      }

      const updated = await prisma.character.update({
        where: { id },
        data: { dnaLocked: true, dnaSummary },
        include: { assets: true },
      });

      return successResponse(
        { character: updated },
        `角色「${character.name}」DNA 已锁定，后续生图将强制注入 ${updated.assets.length} 张参考图`
      );
    } else {
      const updated = await prisma.character.update({
        where: { id },
        data: { dnaLocked: false },
        include: { assets: true },
      });

      return successResponse({ character: updated }, `角色「${character.name}」DNA 已解锁`);
    }
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const character = await prisma.character.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        dnaLocked: true,
        dnaSummary: true,
        referenceImg: true,
        assets: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      },
    });

    if (!character) {
      return notFoundResponse('角色不存在');
    }

    return successResponse({
      character,
      assetCount: character.assets.length,
      canLock: character.assets.length > 0 || !!character.referenceImg,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
