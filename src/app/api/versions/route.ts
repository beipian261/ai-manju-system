// 版本控制与历史记录 API
// 追踪创作历史，支持版本对比和回滚
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

function safeParseJSON(json: string | null | undefined, context: string): any {
  try {
    return JSON.parse(json || '{}');
  } catch (e) {
    logger.error(`[versions] JSON.parse failed (${context})`, e);
    return {};
  }
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

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : 'save';
  const versionName = typeof body.versionName === 'string' ? body.versionName : '';
  const description = typeof body.description === 'string' ? body.description : '';
  const targetVersionId = typeof body.targetVersionId === 'string' ? body.targetVersionId : '';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  switch (action) {
    case 'save':
      return await saveVersion(projectId, versionName, description);
    case 'rollback':
      return await rollbackToVersion(projectId, targetVersionId);
    case 'compare':
      return await compareVersions(projectId, body);
    default:
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  }
}

async function saveVersion(projectId: string, versionName: string, description: string) {
  // 获取当前项目数据
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scripts: true,
      characters: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // 获取分镜
  const storyboards = await prisma.storyboard.findMany({
    where: { script: { projectId } },
    orderBy: { sceneNum: 'asc' },
  });

  // 生成版本名称
  const name = versionName || `版本 ${Date.now()}`;

  // 使用 Job 表存储版本数据
  const job = await prisma.job.create({
    data: {
      type: 'version',
      status: 'completed',
      projectId,
      payload: JSON.stringify({
        versionName: name,
        description: description || '自动保存',
        timestamp: new Date().toISOString(),
      }),
      result: JSON.stringify({
        project: {
          id: project.id,
          title: project.title,
          style: project.style,
          genre: project.genre,
          status: project.status,
        },
        scripts: project.scripts,
        characters: project.characters,
        storyboards,
      }),
    },
  });

  return NextResponse.json({
    success: true,
    versionId: job.id,
    name,
    createdAt: job.createdAt,
    description: description || '自动保存',
  });
}

async function rollbackToVersion(projectId: string, versionId: string) {
  // 获取版本数据（从 Job 表）
  const job = await prisma.job.findUnique({
    where: { id: versionId },
  });

  if (!job) {
    return NextResponse.json({ error: '版本不存在' }, { status: 404 });
  }

  if (job.projectId !== projectId || job.type !== 'version') {
    return NextResponse.json({ error: '版本不属于该项目' }, { status: 400 });
  }

  const data = safeParseJSON(job.result, 'rollbackToVersion-result');

  // 更新项目
  if (data.project) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        title: data.project.title,
        style: data.project.style,
        genre: data.project.genre,
        status: data.project.status,
      },
    });
  }

  // 更新脚本
  if (data.scripts) {
    for (const script of data.scripts) {
      const existing = await prisma.script.findUnique({ where: { id: script.id } });
      if (existing) {
        await prisma.script.update({ where: { id: script.id }, data: script });
      }
    }
  }

  // 更新角色
  if (data.characters) {
    for (const char of data.characters) {
      const existing = await prisma.character.findUnique({ where: { id: char.id } });
      if (existing) {
        await prisma.character.update({ where: { id: char.id }, data: char });
      }
    }
  }

  // 更新分镜
  if (data.storyboards) {
    // 先删除当前分镜
    await prisma.storyboard.deleteMany({ where: { script: { projectId } } });
    
    // 重新创建分镜
    for (const sb of data.storyboards) {
      const script = await prisma.script.findFirst({ where: { projectId } });
      if (script) {
        await prisma.storyboard.create({
          data: {
            ...sb,
            scriptId: script.id,
            id: undefined, // 让数据库生成新ID
          },
        });
      }
    }
  }

  // 创建回滚记录
  const payload = safeParseJSON(job.payload, 'rollbackToVersion-payload');
  await prisma.job.create({
    data: {
      type: 'version',
      status: 'completed',
      projectId,
      payload: JSON.stringify({
        versionName: `回滚到 ${payload.versionName || versionId}`,
        description: `从版本 ${versionId} 恢复`,
        timestamp: new Date().toISOString(),
      }),
      result: job.result,
    },
  });

  return NextResponse.json({
    success: true,
    message: `已成功回滚到版本 "${payload.versionName || versionId}"`,
    versionId,
  });
}

async function compareVersions(projectId: string, body: Record<string, unknown>) {
  const versionId1 = typeof body.versionId1 === 'string' ? body.versionId1 : '';
  const versionId2 = typeof body.versionId2 === 'string' ? body.versionId2 : '';

  if (!versionId1 || !versionId2) {
    return NextResponse.json({ error: 'versionId1 和 versionId2 必填' }, { status: 400 });
  }

  const v1 = await prisma.job.findUnique({ where: { id: versionId1 } });
  const v2 = await prisma.job.findUnique({ where: { id: versionId2 } });

  if (!v1 || !v2) {
    return NextResponse.json({ error: '版本不存在' }, { status: 404 });
  }

  const payload1 = safeParseJSON(v1.payload, 'compareVersions-payload1');
  const payload2 = safeParseJSON(v2.payload, 'compareVersions-payload2');
  const data1 = safeParseJSON(v1.result, 'compareVersions-data1');
  const data2 = safeParseJSON(v2.result, 'compareVersions-data2');

  const differences = {
    project: compareObjects(data1.project, data2.project),
    scripts: compareArrays(data1.scripts, data2.scripts),
    characters: compareArrays(data1.characters, data2.characters),
    storyboards: compareArrays(data1.storyboards, data2.storyboards),
  };

  return NextResponse.json({
    success: true,
    version1: { id: v1.id, name: payload1.versionName, createdAt: v1.createdAt },
    version2: { id: v2.id, name: payload2.versionName, createdAt: v2.createdAt },
    differences,
  });
}

function compareObjects(obj1: Record<string, unknown>, obj2: Record<string, unknown>): Record<string, { before: unknown; after: unknown }> {
  const result: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  
  for (const key of keys) {
    if ((obj1 && obj1[key]) !== (obj2 && obj2[key])) {
      result[key] = {
        before: obj1?.[key],
        after: obj2?.[key],
      };
    }
  }
  
  return result;
}

function compareArrays(arr1: Array<{ id: string } & Record<string, unknown>>, arr2: Array<{ id: string } & Record<string, unknown>>): { added: number; removed: number; changed: number } {
  const ids1 = new Set((arr1 || []).map((item: { id: string }) => item.id));
  const ids2 = new Set((arr2 || []).map((item: { id: string }) => item.id));
  
  const added = [...ids2].filter(id => !ids1.has(id)).length;
  const removed = [...ids1].filter(id => !ids2.has(id)).length;
  const changed = [...ids1].filter(id => ids2.has(id)).length;
  
  return { added, removed, changed };
}

// GET: 获取项目的版本列表
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  const jobs = await prisma.job.findMany({
    where: { projectId, type: 'version' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const versions = jobs.map((job) => {
    const payload = safeParseJSON(job.payload, 'GET-versions-list');
    return {
      id: job.id,
      name: payload.versionName || `版本 ${job.createdAt}`,
      description: payload.description || '',
      createdAt: job.createdAt,
      dataSize: job.result?.length || 0,
    };
  });

  return NextResponse.json({
    projectId,
    versions,
    count: versions.length,
  });
}