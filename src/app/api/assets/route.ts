import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';

export async function GET() {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;
  try {
    const assets = await prisma.asset.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(assets);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load assets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;
  const body = await req.json();
  const asset = await prisma.asset.create({
    data: {
      type: body.type,
      filePath: body.filePath,
      url: body.url,
      projectId: body.projectId,
    },
  });
  return NextResponse.json(asset, { status: 201 });
}
