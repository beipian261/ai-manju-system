import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';

// GET: 获取分镜的评论列表
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storyboardId = searchParams.get('storyboardId');
  const projectId = searchParams.get('projectId');

  try {
    if (storyboardId) {
      // 获取单个分镜的评论
      const comments = await prisma.reviewComment.findMany({
        where: { storyboardId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ comments });
    }

    if (projectId) {
      // 获取项目所有分镜的评论统计
      const storyboards = await prisma.storyboard.findMany({
        where: { script: { projectId } },
        select: {
          id: true,
          sceneNum: true,
          title: true,
          reviewStatus: true,
          imageUrls: true,
          _count: { select: { comments: true } },
        },
        orderBy: { sceneNum: 'asc' },
      });

      const frames = storyboards.map(sb => ({
        id: sb.id,
        sceneNum: sb.sceneNum,
        name: `第${sb.sceneNum}场 - ${sb.title || '未命名场景'}`,
        status: sb.reviewStatus || 'pending',
        comments: sb._count.comments,
        hasImage: !!sb.imageUrls,
      }));

      return NextResponse.json({ frames });
    }

    return NextResponse.json({ error: '请提供 storyboardId 或 projectId' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load comments';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: 添加评论
export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const storyboardId = typeof body.storyboardId === 'string' ? body.storyboardId.trim() : '';
  const author = typeof body.author === 'string' ? body.author.trim().slice(0, 50) : '';
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  const annotationX = typeof body.annotationX === 'number' ? body.annotationX : null;
  const annotationY = typeof body.annotationY === 'number' ? body.annotationY : null;

  if (!storyboardId || !author || !text) {
    return NextResponse.json({ error: 'storyboardId, author, text 必填' }, { status: 400 });
  }

  try {
    // 如果分镜状态是 pending，添加评论后自动变为 reviewing
    const storyboard = await prisma.storyboard.findUnique({ where: { id: storyboardId } });
    if (storyboard && (!storyboard.reviewStatus || storyboard.reviewStatus === 'pending')) {
      await prisma.storyboard.update({
        where: { id: storyboardId },
        data: { reviewStatus: 'reviewing' },
      });
    }

    const comment = await prisma.reviewComment.create({
      data: {
        storyboardId,
        author,
        text,
        annotationX,
        annotationY,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create comment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: 删除评论
export async function DELETE(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get('commentId');

  if (!commentId) {
    return NextResponse.json({ error: 'commentId 必填' }, { status: 400 });
  }

  try {
    await prisma.reviewComment.delete({ where: { id: commentId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to delete comment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
