import prisma from '@/lib/db/prisma';
import type { Storyboard } from '@prisma/client';

export interface CreateStoryboardInput {
  scriptId: string;
  sceneNum: number;
  title?: string;
  description: string;
  cameraAngle?: string;
  emotion?: string;
  location?: string;
  timeOfDay?: string;
  dialogue?: string;
  imagePrompt?: string;
  duration?: number;
}

export interface UpdateStoryboardInput {
  sceneNum?: number;
  title?: string | null;
  description?: string;
  cameraAngle?: string | null;
  emotion?: string | null;
  location?: string | null;
  timeOfDay?: string | null;
  visualKeywords?: string | null;
  charactersInScene?: string | null;
  lighting?: string | null;
  composition?: string | null;
  cameraMovement?: string | null;
  colorPalette?: string | null;
  atmosphere?: string | null;
  dialogue?: string | null;
  imagePrompt?: string | null;
  promptMode?: string;
  imageUrls?: string | null;
  qualityScore?: number;
  duration?: number;
  reviewStatus?: string;
  videoUrl?: string;
  videoTaskId?: string;
  videoStatus?: string;
}

export class StoryboardValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'StoryboardValidationError';
  }
}

export async function listStoryboardsByScript(scriptId: string): Promise<Storyboard[]> {
  return prisma.storyboard.findMany({
    where: { scriptId },
    orderBy: { sceneNum: 'asc' },
  });
}

export async function getStoryboardById(id: string) {
  return prisma.storyboard.findUnique({
    where: { id },
    include: { comments: true },
  });
}

export async function createStoryboard(input: CreateStoryboardInput): Promise<Storyboard> {
  return prisma.storyboard.create({
    data: {
      scriptId: input.scriptId,
      sceneNum: input.sceneNum,
      title: input.title?.slice(0, 200) ?? null,
      description: input.description,
      cameraAngle: input.cameraAngle ?? 'medium shot',
      emotion: input.emotion?.slice(0, 200) ?? null,
      location: input.location?.slice(0, 200) ?? null,
      timeOfDay: input.timeOfDay?.slice(0, 100) ?? null,
      dialogue: input.dialogue?.slice(0, 2000) ?? null,
      imagePrompt: input.imagePrompt?.slice(0, 2000) ?? null,
      duration: input.duration ?? null,
    },
  });
}

export async function createStoryboardsBatch(
  scriptId: string,
  items: Omit<CreateStoryboardInput, 'scriptId'>[]
): Promise<{ count: number }> {
  const result = await prisma.storyboard.createMany({
    data: items.map(item => ({
      scriptId,
      sceneNum: item.sceneNum,
      title: item.title?.slice(0, 200) ?? null,
      description: item.description,
      cameraAngle: item.cameraAngle ?? 'medium shot',
      emotion: item.emotion?.slice(0, 200) ?? null,
      location: item.location?.slice(0, 200) ?? null,
      timeOfDay: item.timeOfDay?.slice(0, 100) ?? null,
      dialogue: item.dialogue?.slice(0, 2000) ?? null,
      imagePrompt: item.imagePrompt?.slice(0, 2000) ?? null,
      duration: item.duration ?? null,
      reviewStatus: 'pending' as const,
    })),
  });
  return result;
}

export async function updateStoryboard(id: string, input: UpdateStoryboardInput): Promise<Storyboard> {
  const data: Record<string, unknown> = {};

  const strOrNull = (val: string | null | undefined, max: number): string | null | undefined => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    return val.slice(0, max);
  };

  if (input.sceneNum !== undefined) data.sceneNum = input.sceneNum;
  if (input.title !== undefined) data.title = strOrNull(input.title, 200);
  if (input.description !== undefined) data.description = input.description;
  if (input.cameraAngle !== undefined) data.cameraAngle = input.cameraAngle?.slice(0, 100) ?? null;
  if (input.emotion !== undefined) data.emotion = strOrNull(input.emotion, 200);
  if (input.location !== undefined) data.location = strOrNull(input.location, 200);
  if (input.timeOfDay !== undefined) data.timeOfDay = strOrNull(input.timeOfDay, 100);
  if (input.visualKeywords !== undefined) data.visualKeywords = strOrNull(input.visualKeywords, 500);
  if (input.charactersInScene !== undefined) data.charactersInScene = strOrNull(input.charactersInScene, 500);
  if (input.lighting !== undefined) data.lighting = strOrNull(input.lighting, 100);
  if (input.composition !== undefined) data.composition = strOrNull(input.composition, 100);
  if (input.cameraMovement !== undefined) data.cameraMovement = strOrNull(input.cameraMovement, 100);
  if (input.colorPalette !== undefined) data.colorPalette = strOrNull(input.colorPalette, 100);
  if (input.atmosphere !== undefined) data.atmosphere = strOrNull(input.atmosphere, 500);
  if (input.dialogue !== undefined) data.dialogue = strOrNull(input.dialogue, 2000);
  if (input.imagePrompt !== undefined) data.imagePrompt = strOrNull(input.imagePrompt, 2000);
  if (input.promptMode !== undefined) data.promptMode = input.promptMode;
  if (input.imageUrls !== undefined) data.imageUrls = input.imageUrls;
  if (input.qualityScore !== undefined) data.qualityScore = input.qualityScore;
  if (input.duration !== undefined) data.duration = input.duration;
  if (input.reviewStatus !== undefined) data.reviewStatus = input.reviewStatus;
  if (input.videoUrl !== undefined) data.videoUrl = input.videoUrl;
  if (input.videoTaskId !== undefined) data.videoTaskId = input.videoTaskId;
  if (input.videoStatus !== undefined) data.videoStatus = input.videoStatus;

  if (Object.keys(data).length === 0) {
    throw new StoryboardValidationError('没有可更新的字段');
  }

  return prisma.storyboard.update({ where: { id }, data });
}

export async function deleteStoryboard(id: string): Promise<void> {
  await prisma.storyboard.delete({ where: { id } });
}

export async function deleteStoryboards(ids: string[]): Promise<{ count: number }> {
  return prisma.storyboard.deleteMany({ where: { id: { in: ids } } });
}

export async function reorderStoryboards(
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    prisma.storyboard.update({
      where: { id },
      data: { sceneNum: index + 1 },
    })
  );
  await prisma.$transaction(updates);
}
