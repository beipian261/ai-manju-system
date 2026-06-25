import prisma from '@/lib/db/prisma';
import { parseScriptToStoryboards } from '@/features/scripts/script-parser';
import { batchGenerateCharacters } from '@/features/characters/character-batch-generator';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { logger } from '@/lib/utils/logger';

export interface ExtractCharactersResult {
  created: number;
  characterNames: string[];
  skipped: boolean;
}

/**
 * 从已完成剧本中提取角色并写入数据库（供 API 与 full_workflow Job 复用）
 */
export async function extractAndCreateCharacters(
  scriptId: string,
  projectId: string,
  hint = ''
): Promise<ExtractCharactersResult> {
  const script = await prisma.script.findUnique({ where: { id: scriptId } });
  if (!script || script.status !== 'completed') {
    return { created: 0, characterNames: [], skipped: true };
  }

  const nameSet = new Set<string>();
  const frames = parseScriptToStoryboards(script.content);
  frames.forEach((f) => {
    f.characters_in_scene?.forEach((name) => {
      const trimmed = name.trim();
      if (trimmed) nameSet.add(trimmed);
    });
  });

  let characterNames = Array.from(nameSet);

  if (characterNames.length === 0) {
    try {
      const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
      const scriptPreview = script.content.slice(0, 6000);
      const aiRes = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              '你是一个剧本分析助手。从剧本内容中提取所有出现的角色名。只输出 JSON：{"characters": ["角色1", "角色2"]}。',
          },
          { role: 'user', content: `剧本内容：\n${scriptPreview}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });
      const aiRaw = aiRes.choices[0]?.message?.content || '{"characters": []}';
      const aiParsed = JSON.parse(aiRaw) as { characters?: string[] };
      const aiNames = Array.isArray(aiParsed.characters) ? aiParsed.characters : [];
      aiNames.forEach((n) => {
        if (typeof n === 'string' && n.trim()) nameSet.add(n.trim());
      });
      characterNames = Array.from(nameSet);
    } catch (e) {
      logger.warn('[extract-characters] AI extraction failed:', e);
    }
  }

  if (characterNames.length === 0) {
    return { created: 0, characterNames: [], skipped: true };
  }

  const existingChars = await prisma.character.findMany({
    where: { projectId, name: { in: characterNames } },
    select: { name: true },
  });
  const existingNames = new Set(existingChars.map((c) => c.name));
  characterNames = characterNames.filter((name) => !existingNames.has(name));

  if (characterNames.length === 0) {
    return { created: 0, characterNames: Array.from(nameSet), skipped: true };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const generatedCharacters = await batchGenerateCharacters(characterNames, {
    genre: project?.genre,
    style: project?.style,
    hint,
  });

  let created = 0;
  for (const generated of generatedCharacters) {
    try {
      await prisma.character.create({
        data: {
          name: generated.name,
          gender: generated.gender || null,
          age: generated.age || null,
          personality: generated.personality || null,
          clothing: generated.clothing || null,
          appearance: generated.appearance || null,
          hair: generated.hair || null,
          eyes: generated.eyes || null,
          build: generated.build || null,
          expressions: generated.expressions || null,
          signaturePose: generated.signaturePose || null,
          colorScheme: generated.colorScheme || null,
          projectId,
        },
      });
      created += 1;
    } catch (e) {
      logger.warn(`[extract-characters] failed to create ${generated.name}:`, e);
    }
  }

  return { created, characterNames, skipped: false };
}
