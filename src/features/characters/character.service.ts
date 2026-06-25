import prisma from '@/lib/db/prisma';
import type { Character } from '@prisma/client';

export interface CreateCharacterInput {
  projectId: string;
  name: string;
  age?: string;
  gender?: string;
  personality?: string;
  clothing?: string;
  appearance?: string;
  hair?: string;
  eyes?: string;
  build?: string;
  expressions?: string;
  signaturePose?: string;
  colorScheme?: string;
  dnaSummary?: string;
}

export interface UpdateCharacterInput {
  name?: string;
  age?: string | null;
  gender?: string | null;
  personality?: string | null;
  clothing?: string | null;
  appearance?: string | null;
  hair?: string | null;
  eyes?: string | null;
  build?: string | null;
  referenceImg?: string | null;
  expressions?: string | null;
  signaturePose?: string | null;
  colorScheme?: string | null;
  dnaLocked?: boolean;
  dnaSummary?: string | null;
}

export class CharacterValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'CharacterValidationError';
  }
}

function validateName(name?: string): string {
  if (!name) {
    throw new CharacterValidationError('角色名称必填');
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new CharacterValidationError('角色名称不能为空');
  }
  if (trimmed.length > 50) {
    throw new CharacterValidationError('角色名称不能超过 50 字符');
  }
  return trimmed;
}

export async function listCharactersByProject(projectId: string): Promise<Character[]> {
  return prisma.character.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getCharacterById(id: string) {
  return prisma.character.findUnique({
    where: { id },
    include: { assets: true },
  });
}

export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const name = validateName(input.name);
  
  return prisma.character.create({
    data: {
      name,
      age: input.age?.slice(0, 20) ?? null,
      gender: input.gender?.slice(0, 20) ?? null,
      personality: input.personality?.slice(0, 1000) ?? null,
      clothing: input.clothing?.slice(0, 500) ?? null,
      appearance: input.appearance?.slice(0, 1000) ?? null,
      hair: input.hair?.slice(0, 200) ?? null,
      eyes: input.eyes?.slice(0, 200) ?? null,
      build: input.build?.slice(0, 200) ?? null,
      expressions: input.expressions?.slice(0, 500) ?? null,
      signaturePose: input.signaturePose?.slice(0, 200) ?? null,
      colorScheme: input.colorScheme?.slice(0, 100) ?? null,
      dnaSummary: input.dnaSummary?.slice(0, 2000) ?? null,
      projectId: input.projectId,
    },
  });
}

export async function updateCharacter(id: string, input: UpdateCharacterInput): Promise<Character> {
  const data: Record<string, unknown> = {};

  const strOrNull = (val: string | null | undefined, max: number): string | null | undefined => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    return val.slice(0, max);
  };

  if (input.name !== undefined) data.name = input.name ? validateName(input.name) : null;
  if (input.age !== undefined) data.age = strOrNull(input.age, 20);
  if (input.gender !== undefined) data.gender = strOrNull(input.gender, 20);
  if (input.personality !== undefined) data.personality = strOrNull(input.personality, 1000);
  if (input.clothing !== undefined) data.clothing = strOrNull(input.clothing, 500);
  if (input.appearance !== undefined) data.appearance = strOrNull(input.appearance, 1000);
  if (input.hair !== undefined) data.hair = strOrNull(input.hair, 200);
  if (input.eyes !== undefined) data.eyes = strOrNull(input.eyes, 200);
  if (input.build !== undefined) data.build = strOrNull(input.build, 200);
  if (input.referenceImg !== undefined) data.referenceImg = input.referenceImg;
  if (input.expressions !== undefined) data.expressions = strOrNull(input.expressions, 500);
  if (input.signaturePose !== undefined) data.signaturePose = strOrNull(input.signaturePose, 200);
  if (input.colorScheme !== undefined) data.colorScheme = strOrNull(input.colorScheme, 100);
  if (input.dnaLocked !== undefined) data.dnaLocked = input.dnaLocked;
  if (input.dnaSummary !== undefined) data.dnaSummary = strOrNull(input.dnaSummary, 2000);

  if (Object.keys(data).length === 0) {
    throw new CharacterValidationError('没有可更新的字段');
  }

  return prisma.character.update({ where: { id }, data });
}

export async function deleteCharacter(id: string): Promise<void> {
  await prisma.character.delete({ where: { id } });
}

export async function deleteCharacters(ids: string[]): Promise<{ count: number }> {
  return prisma.character.deleteMany({ where: { id: { in: ids } } });
}

export async function lockCharacterDNA(id: string, locked: boolean): Promise<Character> {
  return prisma.character.update({
    where: { id },
    data: { dnaLocked: locked },
  });
}
