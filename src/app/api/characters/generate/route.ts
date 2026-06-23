import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { generateFullCharacter, CharacterSeed, CharacterRole } from '@/lib/character-generator';

// ============================================================
// POST /api/characters/generate
// 智能角色生成：从零生成完整角色设定（外观/性格/服装/表情/标志动作/色调）
//
// Body: {
//   name: string           (必填)
//   gender?: string
//   age?: string
//   genre?: string         (题材：fantasy/scifi/romance/mystery/action/horror/comedy)
//   role?: CharacterRole   (protagonist/antagonist/supporting/npc)
//   style?: string         (艺术风格：anime/cyberpunk/...)
//   hint?: string          (自由描述，如"冷酷的剑客")
//   projectId?: string     (如果提供，生成后自动写入 DB)
//   saveToDb?: boolean     (是否写入 DB，默认 false；提供 projectId 时默认 true)
// }
// ============================================================

const VALID_ROLES: CharacterRole[] = ['protagonist', 'antagonist', 'supporting', 'npc'];

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max).trim();
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const name = trimStr(body.name, 50);
  if (!name) {
    return NextResponse.json({ error: '角色名(name)必填' }, { status: 400 });
  }

  const roleRaw = trimStr(body.role, 20);
  const role: CharacterRole = VALID_ROLES.includes(roleRaw as CharacterRole)
    ? (roleRaw as CharacterRole)
    : 'protagonist';

  const seed: CharacterSeed = {
    name,
    gender: trimStr(body.gender, 20) || undefined,
    age: trimStr(body.age, 20) || undefined,
    genre: trimStr(body.genre, 50) || undefined,
    role,
    style: trimStr(body.style, 50) || undefined,
    hint: trimStr(body.hint, 500) || undefined,
  };

  try {
    const generated = await generateFullCharacter(seed);

    // 如果提供了 projectId，写入数据库
    const projectId = trimStr(body.projectId, 64);
    const saveToDb = body.saveToDb !== false && projectId.length > 0;

    let savedCharacter = null;
    if (saveToDb && projectId) {
      // 验证项目存在
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 });
      }

      savedCharacter = await prisma.character.create({
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
    }

    return NextResponse.json({
      generated,
      saved: savedCharacter,
      projectId: projectId || null,
    }, { status: savedCharacter ? 201 : 200 });

  } catch (e) {
    console.error('[character-generate] error:', e);
    const msg = e instanceof Error ? e.message : '角色生成失败';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
