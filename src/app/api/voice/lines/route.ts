import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import type { CharacterInfo } from '@/types';

// GET: 获取项目中所有有对话的分镜台词
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
      where: {
        script: { projectId },
        dialogue: { not: null },
      },
      orderBy: { sceneNum: 'asc' },
      select: {
        id: true,
        sceneNum: true,
        title: true,
        dialogue: true,
        emotion: true,
        charactersInScene: true,
      },
    });

    // 获取项目角色
    const characters = await prisma.character.findMany({
      where: { projectId },
      select: { id: true, name: true, gender: true, personality: true },
    });

    // 解析对话，尝试匹配角色
    const lines = storyboards
      .filter(sb => sb.dialogue && sb.dialogue.trim())
      .map(sb => {
        // 尝试从对话中提取角色名（格式: "角色名：台词" 或 "角色名: 台词"）
        const dialogue = sb.dialogue!;
        const colonMatch = dialogue.match(/^(.+?)[：:]\s*(.+)$/);
        let character = '旁白';
        let text = dialogue;
        let characterInfo: CharacterInfo | null = null;

        if (colonMatch) {
          character = colonMatch[1].trim();
          text = colonMatch[2].trim();
          // 匹配项目角色
          characterInfo = characters.find(c => c.name === character) || null;
        }

        // 尝试从 charactersInScene 提取角色
        if (!characterInfo && sb.charactersInScene) {
          const sceneChars = sb.charactersInScene.split(/[,，、]/).map(s => s.trim());
          for (const sc of sceneChars) {
            const match = characters.find(c => c.name === sc);
            if (match) {
              characterInfo = match;
              if (character === '旁白') character = sc;
              break;
            }
          }
        }

        return {
          id: sb.id,
          sceneNum: sb.sceneNum,
          title: sb.title,
          character,
          characterId: characterInfo?.id || null,
          gender: characterInfo?.gender || null,
          personality: characterInfo?.personality || null,
          emotion: sb.emotion || '平静',
          text,
          status: 'pending' as const,
        };
      });

    return NextResponse.json({
      lines,
      characters: characters.map(c => ({
        id: c.id,
        name: c.name,
        gender: c.gender,
        personality: c.personality,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load dialogue lines';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
