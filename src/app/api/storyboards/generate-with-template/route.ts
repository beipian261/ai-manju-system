// 智能分镜模板生成 API
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { enqueueJob } from '@/lib/job-queue';
import { STORYBOARD_TEMPLATES } from '@/lib/storyboard-templates';
import '@/lib/jobs';

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const scriptId = typeof body.scriptId === 'string' ? body.scriptId.trim() : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const templateKey = typeof body.template === 'string' ? body.template : 'emotional';
  const customHint = typeof body.hint === 'string' ? body.hint.trim() : '';

  if (!scriptId || !projectId) {
    return NextResponse.json({ error: 'scriptId 和 projectId 必填' }, { status: 400 });
  }

  const template = STORYBOARD_TEMPLATES[templateKey as keyof typeof STORYBOARD_TEMPLATES];
  if (!template) {
    return NextResponse.json({
      error: '无效的模板类型',
      availableTemplates: Object.keys(STORYBOARD_TEMPLATES),
    }, { status: 400 });
  }

  const job = await enqueueJob(
    'storyboard',
    {
      scriptId,
      projectId,
      template: templateKey,
      templateData: template,
      customHint,
    },
    projectId
  );

  return NextResponse.json({
    queued: true,
    scriptId,
    projectId,
    template: template.name,
    templateDescription: template.description,
    jobId: job.id,
  }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  return NextResponse.json({
    templates: Object.entries(STORYBOARD_TEMPLATES).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description,
      avgDuration: value.avgDuration,
      tips: value.tips,
    })),
  });
}
