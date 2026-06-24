// ============================================================
// Job handler：生成分镜
// 从 src/app/api/storyboards/route.ts 的 generateStoryboardsInBackground 抽出，
// 改为 job handler 形式（由 worker 调度，不再 fire-and-forget）
// ============================================================

import prisma from '../prisma-client';
import { chatCompletion } from '../agnes-client';
import { parseScriptToStoryboards, StoryboardFrame } from '../script-parser';
import { buildCharacterSheet, CharacterSheet } from '../character-prompt';
import { CAMERA_ANGLES, EMOTION_TONES, ART_STYLES, QUALITY_TAGS, normalizeCameraKey, normalizeEmotionKey, normalizeStyleKey } from '../prompt-library';
import { emitProgress } from '../progress-bus';
import { updateProjectStatus } from '../project-status';
import { getSetting } from '../settings';
import { registerJobHandler } from '../job-queue';
import { logger } from '../logger';
import type { SceneOrderItem } from '@/types';

// AI JSON 解析：从剧本中提取的分镜帧原始结构（字段名可能不统一）
interface RawFrame {
  scene_number?: number;
  title?: string;
  description?: string;
  scene_description?: string;
  camera_angle?: string;
  cameraAngle?: string;
  emotion?: string;
  location?: string;
  time_of_day?: string;
  weather?: string;
  dialogue?: string;
  visual_keywords?: string;
  visualKeywords?: string;
  characters_in_scene?: string[];
  characters?: string[];
  [key: string]: unknown;
}

registerJobHandler('storyboard', async (job) => {
  const scriptId = job.payload.scriptId as string;
  const projectId = job.payload.projectId as string;
  const sceneOrder: SceneOrderItem[] | null = Array.isArray(job.payload.sceneOrder) ? job.payload.sceneOrder as SceneOrderItem[] : null;

  if (!scriptId || !projectId) {
    throw new Error('storyboard job 缺少必要参数 scriptId/projectId');
  }

  await generateStoryboardsInBackground(scriptId, projectId, sceneOrder, job.setProgress, job.projectId);
  return { scriptId, projectId };
});

// ============================================================
// 分镜生成逻辑（与原 generateStoryboardsInBackground 一致）
// ============================================================
async function generateStoryboardsInBackground(
  scriptId: string,
  projectId: string,
  sceneOrder: SceneOrderItem[] | null,
  setProgress: (pct: number, message?: string) => Promise<void>,
  progressProjectId: string | null
) {
  const perfStart = Date.now();
  try {
    const script = await prisma.script.findUnique({
      where: { id: scriptId },
      include: { project: true },
    });
    if (!script) return;

    emitProgress({ type: 'storyboard', id: scriptId, status: 'progress', progress: 10, message: '解析剧本', projectId: progressProjectId || undefined });
    await setProgress(10, '解析剧本');

    const characters = await prisma.character.findMany({ where: { projectId } });
    const characterSheets: CharacterSheet[] = characters.map((c) =>
      buildCharacterSheet({
        name: c.name, age: c.age, gender: c.gender, personality: c.personality,
        clothing: c.clothing, appearance: c.appearance, hair: c.hair, eyes: c.eyes,
        build: c.build, referenceImg: c.referenceImg,
      })
    );

    const sharedCharactersPart =
      characterSheets.length > 0
        ? 'characters: ' + characterSheets.map((c) => `${c.name} (${c.gender}, age ${c.age}): ${c.englishDescription}`).join('; ')
        : '';

    const artStyleRaw = script.project?.style || 'anime';
    const styleKey = normalizeStyleKey(artStyleRaw);
    const styleDescription = ART_STYLES[styleKey] || ART_STYLES.anime;
    const sharedStylePart = `art style: ${styleDescription}. ${QUALITY_TAGS.base}. ${QUALITY_TAGS.composition}. lighting: ${QUALITY_TAGS.lighting}.`;

    emitProgress({ type: 'storyboard', id: scriptId, status: 'progress', progress: 20, message: '解析剧本中...', projectId: progressProjectId || undefined });
    await setProgress(20, '解析剧本中');

    // 解析分镜（三路径：用户自定义 → JSON → AI → 正则）
    let frames: RawFrame[] = [];
    let parseSource: 'user_order' | 'direct_json' | 'ai_extraction' | 'regex' = 'direct_json';

    if (sceneOrder && sceneOrder.length > 0) {
      parseSource = 'user_order';
      frames = sceneOrder.map((s, i: number) => ({
        scene_number: i + 1,
        title: typeof s.title === 'string' ? s.title : '',
        description: typeof s.description === 'string' ? s.description : '',
        emotion: typeof s.emotion === 'string' ? s.emotion : 'dramatic',
        camera_angle: typeof s.cameraAngle === 'string' ? s.cameraAngle : 'medium_shot',
        location: typeof s.location === 'string' ? s.location : '',
        time_of_day: typeof s.timeOfDay === 'string' ? s.timeOfDay : 'morning',
        characters_in_scene: Array.isArray(s.characters) ? s.characters as string[] : [],
        dialogue: typeof s.dialogue === 'string' ? s.dialogue : '',
        visual_keywords: '',
        characters: Array.isArray(s.characters) ? s.characters as string[] : [],
      }));
    } else {
      try {
        const parsedScript = JSON.parse(script.content);
        if (Array.isArray(parsedScript.acts) && parsedScript.acts.length > 0 && parsedScript.acts.every((a: Record<string, unknown>) => Array.isArray(a.scenes))) {
          parseSource = 'direct_json';
          for (const act of parsedScript.acts) frames.push(...act.scenes);
        } else if (Array.isArray(parsedScript.scenes) && parsedScript.scenes.length > 0) {
          parseSource = 'direct_json';
          frames = parsedScript.scenes;
        } else {
          throw new Error('No valid scenes found in JSON');
        }
      } catch {
        const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
        try {
          parseSource = 'ai_extraction';
          const extractPrompt =
            `Extract storyboards from this script. Output a JSON object with a "scenes" array. ` +
            `Each item in scenes: scene_num (integer), description (string), camera_angle (string), dialogue (string, optional), emotion (string).\n\n` +
            `Script:\n${script.content.slice(0, 4000)}`;
          const response = await chatCompletion({
            model: TEXT_MODEL,
            messages: [
              { role: 'system', content: 'You are a storyboard extraction expert. Output only valid JSON with a "scenes" array.' },
              { role: 'user', content: extractPrompt },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
            max_tokens: 4000,
          });
          const raw = response.choices[0]?.message?.content || '';
          const parsed = JSON.parse(raw || '{}');
          if (Array.isArray(parsed.scenes)) frames = parsed.scenes;
          else if (Array.isArray(parsed.frames)) frames = parsed.frames;
          else if (Array.isArray(parsed)) frames = parsed;
          else if (Array.isArray(parsed.storyboards)) frames = parsed.storyboards;
        } catch {
          parseSource = 'regex';
          frames = parseScriptToStoryboards(script.content) as unknown as RawFrame[];
        }
      }
    }

    logger.info(`[storyboard:${scriptId}] frames: ${frames.length} (source: ${parseSource}, took ${Date.now() - perfStart}ms)`);

    if (frames.length === 0) {
      const msg = '剧本解析未提取到任何分镜';
      emitProgress({ type: 'storyboard', id: scriptId, status: 'failed', message: msg, projectId: progressProjectId || undefined });
      throw new Error(msg);
    }

    emitProgress({ type: 'storyboard', id: scriptId, status: 'progress', progress: 55, message: `提取到 ${frames.length} 个分镜，正在生成提示词`, projectId: progressProjectId || undefined });
    await setProgress(55, `提取到 ${frames.length} 个分镜`);

    const usedSceneNums = new Set<number>();
    const dbCreatePromises: Promise<unknown>[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      let sceneNum = typeof frame.scene_number === 'number' && frame.scene_number > 0 ? Math.floor(frame.scene_number) : i + 1;
      while (usedSceneNums.has(sceneNum)) sceneNum += 1;
      usedSceneNums.add(sceneNum);

      const title = typeof frame.title === 'string' ? String(frame.title).trim() : '';
      const description = typeof frame.description === 'string' ? frame.description : String(frame.scene_description || '').trim();
      const cameraAngleRaw = typeof frame.camera_angle === 'string' ? frame.camera_angle : String(frame.cameraAngle || 'medium shot').trim();
      const emotionRaw = typeof frame.emotion === 'string' ? frame.emotion : 'peaceful';
      const location = typeof frame.location === 'string' ? String(frame.location).trim() : '';
      const timeOfDay = typeof frame.time_of_day === 'string' ? String(frame.time_of_day).trim() : 'morning';
      const weather = typeof frame.weather === 'string' ? String(frame.weather).trim() : '';
      const dialogue = typeof frame.dialogue === 'string' ? frame.dialogue : '';
      const visualKeywords = typeof frame.visual_keywords === 'string'
        ? frame.visual_keywords
        : typeof frame.visualKeywords === 'string' ? frame.visualKeywords : '';
      const charactersInScene = Array.isArray(frame.characters_in_scene)
        ? frame.characters_in_scene
        : Array.isArray(frame.characters) ? frame.characters : [];

      const camKey = normalizeCameraKey(cameraAngleRaw);
      const emoKey = normalizeEmotionKey(emotionRaw);

      const sceneParts: string[] = [];
      sceneParts.push(CAMERA_ANGLES[camKey]);
      if (description) sceneParts.push(description.slice(0, 500));
      if (visualKeywords) sceneParts.push(visualKeywords.slice(0, 300));
      if (sharedCharactersPart) sceneParts.push(sharedCharactersPart.slice(0, 1000));
      sceneParts.push(EMOTION_TONES[emoKey]);
      sceneParts.push(sharedStylePart);
      const imagePrompt = sceneParts.join('. ').slice(0, 3500);

      dbCreatePromises.push(
        prisma.storyboard
          .create({
            data: {
              sceneNum,
              title: title || null,
              description: String(description || '').slice(0, 2000),
              cameraAngle: camKey,
              emotion: emoKey,
              location: location || null,
              timeOfDay: timeOfDay || null,
              visualKeywords: visualKeywords || null,
              charactersInScene: Array.isArray(charactersInScene) ? charactersInScene.join(', ') : null,
              dialogue: dialogue ? String(dialogue).slice(0, 2000) : null,
              imagePrompt,
              scriptId,
            },
          })
          .catch((e) => {
            logger.error(`[storyboard:${scriptId}] failed to create scene ${sceneNum}:`, e.message || e);
            return null;
          })
      );

      if (frames.length > 3 && (i + 1) % Math.max(1, Math.floor(frames.length / 4)) === 0) {
        const pct = 55 + Math.floor(((i + 1) / frames.length) * 40);
        emitProgress({ type: 'storyboard', id: scriptId, status: 'progress', progress: Math.min(pct, 95), message: `已保存 ${i + 1}/${frames.length}`, projectId: progressProjectId || undefined });
        await setProgress(Math.min(pct, 95), `已保存 ${i + 1}/${frames.length}`);
      }
    }

    const results = await Promise.all(dbCreatePromises);
    const created = results.filter(Boolean).length;

    logger.info(`[storyboard:${scriptId}] done, created ${created}/${frames.length}, total ${Date.now() - perfStart}ms`);

    if (created === 0) {
      emitProgress({ type: 'storyboard', id: scriptId, status: 'failed', message: '分镜保存失败（数据库写入全部失败）', projectId: progressProjectId || undefined });
      throw new Error('分镜保存失败（数据库写入全部失败）');
    } else {
      emitProgress({ type: 'storyboard', id: scriptId, status: 'completed', progress: 100, message: `分镜生成完成（${created} 个）`, projectId: progressProjectId || undefined });
      await setProgress(100, `分镜生成完成（${created} 个）`);
      await updateProjectStatus(projectId, 'producing');
    }
  } catch (e) {
    logger.error(`[storyboard:${scriptId}] generate error (took ${Date.now() - perfStart}ms):`, e);
    emitProgress({ type: 'storyboard', id: scriptId, status: 'failed', message: '分镜生成失败: ' + (e instanceof Error ? e.message : String(e)).slice(0, 300), projectId: progressProjectId || undefined });
    throw e;
  }
}
