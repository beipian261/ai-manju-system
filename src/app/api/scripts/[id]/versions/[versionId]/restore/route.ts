import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';

// POST: 将剧本恢复到指定版本
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { id: scriptId, versionId } = await params;

  try {
    // 获取目标版本
    const targetVersion = await prisma.scriptVersion.findUnique({
      where: { id: versionId },
    });

    if (!targetVersion || targetVersion.scriptId !== scriptId) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    // 获取当前剧本
    const script = await prisma.script.findUnique({
      where: { id: scriptId },
      select: { id: true, content: true, outline: true },
    });

    if (!script) {
      return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
    }

    // 保存当前版本（如果与目标版本内容不同）
    if (script.content !== targetVersion.content) {
      const lastVersion = await prisma.scriptVersion.findFirst({
        where: { scriptId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      await prisma.scriptVersion.create({
        data: {
          scriptId,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          outline: script.outline,
          content: script.content,
          source: 'restore',
        },
      });
    }

    // 恢复目标版本内容
    await prisma.script.update({
      where: { id: scriptId },
      data: {
        content: targetVersion.content,
        outline: targetVersion.outline,
      },
    });

    return NextResponse.json({
      success: true,
      restoredFromVersion: targetVersion.versionNumber,
      content: targetVersion.content,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to restore version';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
