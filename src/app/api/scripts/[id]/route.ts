import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { emitProgress } from '@/lib/bus/progress-bus';
import { logger } from '@/lib/utils/logger';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const script = await prisma.script.findUnique({
    where: { id: id },
    include: { storyboards: true },
  });
  if (!script) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }
  return NextResponse.json(script);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    await prisma.script.delete({ where: { id: id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
  }
}

const MODES = ['rewrite_scene', 'append_scene', 'rewrite_all'] as const;
type RewriteMode = (typeof MODES)[number];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const modeRaw = typeof body.mode === 'string' ? body.mode : '';
  const mode: RewriteMode | null = MODES.includes(modeRaw as RewriteMode)
    ? (modeRaw as RewriteMode)
    : null;
  const targetSceneNum = typeof body.targetSceneNum === 'number' ? Math.floor(body.targetSceneNum) : 0;

  if (!instruction) {
    return NextResponse.json({ error: 'instruction 必填' }, { status: 400 });
  }
  if (instruction.length > 2000) {
    return NextResponse.json({ error: 'instruction 不能超过 2000 字符' }, { status: 400 });
  }
  if (!mode) {
    return NextResponse.json(
      { error: 'mode 必填且为 rewrite_scene/append_scene/rewrite_all' },
      { status: 400 }
    );
  }
  if (mode === 'rewrite_scene' && (!targetSceneNum || targetSceneNum < 1)) {
    return NextResponse.json(
      { error: 'rewrite_scene 模式需要 targetSceneNum >= 1' },
      { status: 400 }
    );
  }

  const script = await prisma.script.findUnique({ where: { id: id } });
  if (!script) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }
  if (script.status !== 'completed') {
    return NextResponse.json({ error: '剧本尚未完成，无法润色' }, { status: 400 });
  }

  emitProgress({ type: 'script', id: script.id, status: 'started', progress: 0, message: '开始润色剧本' });

  try {
    const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

    let parsed: { title?: string; scenes?: Array<Record<string, unknown>> } | null = null;
    try {
      parsed = JSON.parse(script.content);
    } catch {
      emitProgress({
        type: 'script',
        id: script.id,
        status: 'progress',
        progress: 20,
        message: '正在解析文本剧本',
      });
      const converted = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Convert the following comic drama script text into a strict JSON object with fields: title (string), scenes (array). ' +
              'Each scene has: scene_number (integer), description (string), camera_angle (string), dialogue (string), emotion (string). ' +
              'Output ONLY the JSON.',
          },
          { role: 'user', content: script.content },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      try {
        parsed = JSON.parse(converted.choices[0]?.message?.content || '{}');
      } catch {
        parsed = { scenes: [] };
      }
    }

    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
    let newScenes: Array<Record<string, unknown>> = [...scenes];

    if (mode === 'rewrite_scene') {
      emitProgress({
        type: 'script',
        id: script.id,
        status: 'progress',
        progress: 40,
        message: `重写第 ${targetSceneNum} 场`,
      });
      const sysPrompt =
        'You rewrite a single scene in a comic drama. Return a strict JSON object: ' +
        '{ "scene": { "scene_number": N, "description": "...", "camera_angle": "...", "dialogue": "...", "emotion": "..." } }. ' +
        'Output ONLY the JSON.';
      const userPrompt = JSON.stringify({
        original_scene: scenes.find((s) => s.scene_number === targetSceneNum) || null,
        instruction,
      });
      const res = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });
      const obj = JSON.parse(res.choices[0]?.message?.content || '{}');
      const newScene = obj.scene || obj;
      if (newScene) {
        newScenes = newScenes.map((s) =>
          s.scene_number === targetSceneNum ? { ...newScene, scene_number: targetSceneNum } : s
        );
        await prisma.storyboard.deleteMany({
          where: { scriptId: script.id, sceneNum: targetSceneNum },
        });
      }
    } else if (mode === 'append_scene') {
      emitProgress({
        type: 'script',
        id: script.id,
        status: 'progress',
        progress: 40,
        message: '追加新场景',
      });
      const sysPrompt =
        'You append a new scene to the end of a comic drama. Return a strict JSON object: ' +
        '{ "scene": { "description": "...", "camera_angle": "...", "dialogue": "...", "emotion": "..." } }. ' +
        'Output ONLY the JSON.';
      const res = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: sysPrompt },
          {
            role: 'user',
            content: `Instruction: ${instruction}\nLast scene: ${JSON.stringify(scenes[scenes.length - 1] || {})}`,
          },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });
      const obj = JSON.parse(res.choices[0]?.message?.content || '{}');
      const newScene = obj.scene || obj;
      if (newScene && (newScene.description || newScene.dialogue)) {
        const nextNum = (scenes[scenes.length - 1]?.scene_number as number) || scenes.length;
        newScenes.push({ ...newScene, scene_number: nextNum + 1 });
      }
    } else if (mode === 'rewrite_all') {
      emitProgress({
        type: 'script',
        id: script.id,
        status: 'progress',
        progress: 40,
        message: '全局重写',
      });
      const sysPrompt =
        'You rewrite the entire comic drama following the user instruction. Return a strict JSON object: ' +
        '{ "title": "...", "scenes": [ { "scene_number", "description", "camera_angle", "dialogue", "emotion" } ] }. ' +
        'Keep similar scene count unless user asks otherwise. Output ONLY the JSON.';
      const res = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: `Instruction: ${instruction}\nOriginal: ${JSON.stringify(parsed)}` },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });
      const obj = JSON.parse(res.choices[0]?.message?.content || '{}');
      if (Array.isArray(obj.scenes)) {
        newScenes = obj.scenes;
      }
      await prisma.storyboard.deleteMany({ where: { scriptId: script.id } });
    }

    const updatedContent = JSON.stringify({ title: parsed?.title || '', scenes: newScenes }, null, 2);

    await prisma.script.update({
      where: { id: script.id },
      data: { content: updatedContent, status: 'completed' },
    });

    emitProgress({
      type: 'script',
      id: script.id,
      status: 'completed',
      progress: 100,
      message: '润色完成',
    });

    return NextResponse.json({ success: true, newScenesCount: newScenes.length, mode });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Script rewrite failed';
    logger.error('Script rewrite failed:', error);
    emitProgress({ type: 'script', id: script.id, status: 'failed', message: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
