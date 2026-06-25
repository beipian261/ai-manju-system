import prisma from '@/lib/db/prisma';
import type { Script } from '@prisma/client';

export interface CreateScriptInput {
  projectId: string;
  outline: string;
  content?: string;
}

export interface UpdateScriptInput {
  outline?: string;
  content?: string;
  status?: string;
}

export class ScriptValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'ScriptValidationError';
  }
}

export async function listScriptsByProject(projectId: string) {
  return prisma.script.findMany({
    where: { projectId },
    include: { storyboards: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getScriptById(id: string) {
  return prisma.script.findUnique({
    where: { id },
    include: {
      storyboards: { orderBy: { sceneNum: 'asc' } },
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  });
}

export async function getScriptWithVersions(id: string) {
  return prisma.script.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  });
}

export async function createScript(input: CreateScriptInput): Promise<Script> {
  return prisma.script.create({
    data: {
      outline: input.outline,
      content: input.content ?? '',
      projectId: input.projectId,
      status: 'draft',
    },
  });
}

export async function updateScript(id: string, input: UpdateScriptInput): Promise<Script> {
  const data: Record<string, unknown> = {};

  if (input.outline !== undefined) data.outline = input.outline;
  if (input.content !== undefined) data.content = input.content;
  if (input.status !== undefined) data.status = input.status;

  if (Object.keys(data).length > 0 && input.content !== undefined) {
    const current = await prisma.script.findUnique({ where: { id } });
    if (current && current.content !== input.content) {
      const versionCount = await prisma.scriptVersion.count({ where: { scriptId: id } });
      await prisma.scriptVersion.create({
        data: {
          scriptId: id,
          outline: current.outline,
          content: current.content,
          versionNumber: versionCount + 1,
        },
      });
    }
  }

  if (Object.keys(data).length === 0) {
    throw new ScriptValidationError('没有可更新的字段');
  }

  return prisma.script.update({ where: { id }, data });
}

export async function deleteScript(id: string): Promise<void> {
  await prisma.script.delete({ where: { id } });
}

export async function getScriptVersions(scriptId: string) {
  return prisma.scriptVersion.findMany({
    where: { scriptId },
    orderBy: { versionNumber: 'desc' },
  });
}

export async function restoreScriptVersion(scriptId: string, versionId: string): Promise<Script> {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    throw new ScriptValidationError('版本不存在', 404);
  }

  return prisma.script.update({
    where: { id: scriptId },
    data: { outline: version.outline, content: version.content },
  });
}
