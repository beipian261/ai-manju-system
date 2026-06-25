import prisma from '@/lib/db/prisma';
import { ALLOWED_GENRES, ALLOWED_STYLES, ALLOWED_STATUSES } from '@/lib/config/constants';
import type { Project } from '@prisma/client';

export interface CreateProjectInput {
  title: string;
  description?: string;
  genre?: string;
  style?: string;
  outline?: string;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  genre?: string;
  style?: string;
  status?: string;
}

export class ProjectValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'ProjectValidationError';
  }
}

function validateGenre(genre?: string): string {
  if (!genre) return 'unknown';
  return ALLOWED_GENRES.includes(genre) ? genre : 'unknown';
}

function validateStyle(style?: string): string {
  if (!style) return 'anime';
  return ALLOWED_STYLES.includes(style) ? style : 'anime';
}

function validateStatus(status?: string): string | null {
  if (!status) return null;
  return ALLOWED_STATUSES.includes(status) ? status : null;
}

function validateTitle(title?: string): string {
  if (!title) {
    throw new ProjectValidationError('标题必填');
  }
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ProjectValidationError('标题不能为空');
  }
  if (trimmed.length > 100) {
    throw new ProjectValidationError('标题不能超过 100 字符');
  }
  return trimmed;
}

export async function listProjects(): Promise<Project[]> {
  return prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: { characters: true, scripts: true },
  });
}

export async function getProjectWithDetails(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      characters: true,
      scripts: {
        include: { storyboards: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const title = validateTitle(input.title);
  const genre = validateGenre(input.genre);
  const style = validateStyle(input.style);
  const description = input.description?.slice(0, 1000) ?? null;
  const outline = input.outline?.slice(0, 5000) ?? null;

  const project = await prisma.project.create({
    data: { title, description, genre, style },
  });

  if (outline) {
    await prisma.script.create({
      data: {
        outline,
        content: '',
        status: 'generating',
        projectId: project.id,
      },
    });
  }

  return project;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) {
    data.title = validateTitle(input.title);
  }
  if (input.description !== undefined) {
    data.description = input.description.slice(0, 1000);
  }
  if (input.genre !== undefined) {
    data.genre = input.genre.slice(0, 100);
  }
  if (input.style !== undefined) {
    data.style = validateStyle(input.style);
  }
  if (input.status !== undefined) {
    const validStatus = validateStatus(input.status);
    if (validStatus) data.status = validStatus;
  }

  if (Object.keys(data).length === 0) {
    throw new ProjectValidationError('没有可更新的字段');
  }

  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(id: string): Promise<void> {
  await prisma.project.delete({ where: { id } });
}
