// 角色一致性检查与修复 API
// 检查角色信息完整性、定妆照状态、分镜角色匹配
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import prisma from '@/lib/prisma-client';
import { buildCharacterSheet } from '@/lib/character-prompt';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : 'check';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  switch (action) {
    case 'check':
      return await checkConsistency(projectId);
    case 'repair':
      return await repairConsistency(projectId);
    default:
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  }
}

async function checkConsistency(projectId: string) {
  const characters = await prisma.character.findMany({ where: { projectId } });
  const storyboards = await prisma.storyboard.findMany({
    where: { script: { projectId } },
    include: { script: true },
  });

  const issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    characterName?: string;
    storyboardId?: string;
  }> = [];

  const characterNames = new Set(characters.map(c => c.name));

  // 1. 检查角色信息完整性
  for (const char of characters) {
    const sheet = buildCharacterSheet(char);
    
    // 检查定妆照
    if (!char.referenceImg) {
      issues.push({
        type: 'missing_portrait',
        severity: 'error',
        message: `角色「${char.name}」缺少定妆照，会严重影响角色一致性`,
        characterName: char.name,
      });
    }

    // 检查外貌描述
    if (!char.appearance || char.appearance.length < 5) {
      issues.push({
        type: 'missing_appearance',
        severity: 'warning',
        message: `角色「${char.name}」外貌描述不够详细`,
        characterName: char.name,
      });
    }

    // 检查服装描述
    if (!char.clothing || char.clothing.length < 5) {
      issues.push({
        type: 'missing_clothing',
        severity: 'warning',
        message: `角色「${char.name}」服装描述不够详细`,
        characterName: char.name,
      });
    }

    // 检查发型
    if (!char.hair || char.hair.length < 3) {
      issues.push({
        type: 'missing_hair',
        severity: 'warning',
        message: `角色「${char.name}」发型描述不够详细`,
        characterName: char.name,
      });
    }
  }

  // 2. 检查分镜中的角色是否都已定义
  for (const sb of storyboards) {
    if (sb.charactersInScene) {
      const chars = sb.charactersInScene.split(',').map(c => c.trim()).filter(Boolean);
      for (const charName of chars) {
        if (!characterNames.has(charName)) {
          issues.push({
            type: 'undefined_character',
            severity: 'error',
            message: `分镜 #${sb.sceneNum} 中的角色「${charName}」未在角色列表中定义`,
            characterName: charName,
            storyboardId: sb.id,
          });
        }
      }
    }
  }

  // 3. 统计有图片的分镜
  const storyboardsWithImages = storyboards.filter(sb => sb.imageUrls);
  const storyboardsWithoutImages = storyboards.filter(sb => !sb.imageUrls);

  // 4. 统计一致性评分
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const totalIssues = errorCount + warningCount;

  let consistencyScore = 100;
  consistencyScore -= errorCount * 15;
  consistencyScore -= warningCount * 5;
  consistencyScore = Math.max(0, consistencyScore);

  let status: 'excellent' | 'good' | 'warning' | 'critical' = 'good';
  let statusText = '';

  if (consistencyScore >= 90) {
    status = 'excellent';
    statusText = '优秀';
  } else if (consistencyScore >= 70) {
    status = 'good';
    statusText = '良好';
  } else if (consistencyScore >= 50) {
    status = 'warning';
    statusText = '需改进';
  } else {
    status = 'critical';
    statusText = '需修复';
  }

  return NextResponse.json({
    success: true,
    projectId,
    consistencyScore,
    status,
    statusText,
    summary: {
      totalCharacters: characters.length,
      charactersWithPortrait: characters.filter(c => c.referenceImg).length,
      totalStoryboards: storyboards.length,
      storyboardsWithImages: storyboardsWithImages.length,
      storyboardsWithoutImages: storyboardsWithoutImages.length,
    },
    issues,
    totalIssues,
    errorCount,
    warningCount,
  });
}

async function repairConsistency(projectId: string) {
  const characters = await prisma.character.findMany({ where: { projectId } });
  
  if (characters.length === 0) {
    return NextResponse.json({ error: '项目中没有角色，无法修复' }, { status: 400 });
  }

  const repaired: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  // 为缺少定妆照的角色生成定妆照（这里只是标记，实际生成需要调用 portrait API）
  for (const char of characters) {
    if (!char.referenceImg) {
      try {
        // 补充默认描述
        const updates: Record<string, string> = {};
        if (!char.appearance || char.appearance.length < 3) {
          updates.appearance = char.gender === '女' 
            ? 'beautiful face, delicate features, fair skin'
            : 'handsome face, sharp features, healthy skin';
        }
        if (!char.hair || char.hair.length < 2) {
          updates.hair = char.gender === '女' ? 'long straight hair' : 'short neat hair';
        }
        if (!char.eyes || char.eyes.length < 2) {
          updates.eyes = char.gender === '女' ? 'bright expressive eyes' : 'sharp clear eyes';
        }
        if (!char.clothing || char.clothing.length < 3) {
          updates.clothing = char.gender === '女' ? 'elegant dress' : 'casual shirt and pants';
        }

        if (Object.keys(updates).length > 0) {
          await prisma.character.update({
            where: { id: char.id },
            data: updates,
          });
          repaired.push(`${char.name} (补充描述)`);
        }
      } catch (e) {
        failed.push({
          name: char.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    projectId,
    repaired,
    failed,
    message: `已修复 ${repaired.length} 个角色，失败 ${failed.length} 个。请调用 /api/characters/portrait 生成定妆照以获得最佳一致性。`,
  });
}

// GET: 获取一致性检查指南
export async function GET() {
  return NextResponse.json({
    description: '角色一致性检查与修复工具',
    checkItems: [
      { key: 'missing_portrait', name: '缺少定妆照', severity: 'error', description: '角色没有参考图，严重影响一致性' },
      { key: 'missing_appearance', name: '缺少外貌描述', severity: 'warning', description: '外貌描述不够详细' },
      { key: 'missing_clothing', name: '缺少服装描述', severity: 'warning', description: '服装描述不够详细' },
      { key: 'missing_hair', name: '缺少发型描述', severity: 'warning', description: '发型描述不够详细' },
      { key: 'undefined_character', name: '未定义角色', severity: 'error', description: '分镜中的角色未在角色列表定义' },
    ],
    bestPractices: [
      '为每个角色生成标准定妆照',
      '详细填写角色外貌、发型、服装描述',
      '确保分镜中的角色名与角色列表一致',
      '使用相同的艺术风格',
      '生成图片时使用角色参考图',
    ],
  });
}