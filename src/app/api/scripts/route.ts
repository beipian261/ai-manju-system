import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { chatCompletionStream } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { updateProjectStatus } from '@/lib/utils/project-status';
import { emitProgress } from '@/lib/bus/progress-bus';
import { buildCharacterConsistencyInstructions, buildCharacterSheet } from '@/features/characters/character-prompt';
import { SCRIPT_PROMPTS } from '@/features/generation/prompt-library';
import { enqueueJob } from '@/lib/queue/job-queue';
import { enhanceScriptQuality } from '@/features/scripts/script-refiner';
import '@/lib/queue/jobs';
import { logger } from '@/lib/utils/logger';
import { listScriptsByProject, createScript } from '@/features/scripts/script.service';
import { successResponse, errorResponse, handleApiError, notFoundResponse } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (projectId) {
      const scripts = await listScriptsByProject(projectId);
      return successResponse(scripts);
    }
    const scripts = await prisma.script.findMany({ orderBy: { createdAt: 'desc' } });
    return successResponse(scripts);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const url = new URL(req.url);
  const wantStream = url.searchParams.get('stream') === 'true' ||
    (req.headers.get('accept') || '').includes('text/event-stream');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('请求体必须为 JSON', 400);
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const outline = typeof body.outline === 'string' ? body.outline.trim() : '';

  if (!projectId) return errorResponse('projectId 必填', 400);
  if (!outline) return errorResponse('outline 必填且非空', 400);
  if (outline.length > 5000) return errorResponse('outline 长度不能超过 5000', 400);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return notFoundResponse('项目不存在');

  const existing = await prisma.script.count({ where: { projectId, status: 'generating' } });
  if (existing > 0) {
    return errorResponse('该项目已有正在生成的剧本，请等待完成或清理超时任务', 409);
  }

  const pendingScript = await createScript({ projectId, outline, content: '' });
  await prisma.script.update({ where: { id: pendingScript.id }, data: { status: 'generating' } });

  await updateProjectStatus(projectId, 'scripting');
  emitProgress({ type: 'script', id: pendingScript.id, status: 'started', progress: 0, message: '开始生成剧本' });

  if (wantStream) {
    return streamScriptGeneration(pendingScript.id, projectId, outline, project.style || 'anime');
  }

  const job = await enqueueJob(
    'script',
    { scriptId: pendingScript.id, projectId, outline, style: project.style || 'anime' },
    projectId
  );

  return NextResponse.json({ ...pendingScript, jobId: job.id }, { status: 202 });
}

function formatScriptError(raw: string): string {
  const filterPatterns = [/cannot provide/i, /violen/i, /illegal/i, /safety|harmful|inappropriate/i, /content.*policy/i];
  if (filterPatterns.some(p => p.test(raw))) {
    return '剧本因内容安全策略被拦截。建议将大纲中的敏感描述替换为非敏感表达后重试。';
  }
  if (raw.includes('timeout') || raw.includes('超时')) return '剧本生成超时，请简化故事大纲后重试。';
  if (raw.includes('422') || raw.includes('500') || raw.includes('API')) return 'AI 服务暂时不可用，请稍后重试。';
  return raw.length > 100 ? raw.slice(0, 100) + '...' : raw;
}

async function streamScriptGeneration(scriptId: string, projectId: string, outline: string, style: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send('script_id', { id: scriptId });
        emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 5, message: '加载角色与世界观' });
        send('progress', { progress: 5, message: '加载角色与世界观' });

        const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
        const characters = await prisma.character.findMany({ where: { projectId } });
        const characterSheets = characters.map(c => buildCharacterSheet({ name: c.name, age: c.age, gender: c.gender, personality: c.personality, clothing: c.clothing, appearance: c.appearance, hair: c.hair, eyes: c.eyes, build: c.build, referenceImg: c.referenceImg, dnaSummary: c.dnaSummary }));
        const characterInstructions = buildCharacterConsistencyInstructions(characters);

        emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 15, message: 'AI 创作剧本中...' });
        send('progress', { progress: 15, message: 'AI 创作剧本中（实时生成）...' });

        const systemPrompt = SCRIPT_PROMPTS.outline_to_full;
        let userPrompt = `【故事大纲】\n${outline}\n\n【整体画风】${style}\n\n`;
        if (characterSheets.length > 0) {
          userPrompt += `【登场角色】（共 ${characterSheets.length} 位）\n`;
          characterSheets.forEach(cs => {
            const apprDesc = cs.face || cs.signature_look || '标准外貌';
            userPrompt += `- ${cs.name}：${apprDesc}；穿着 ${cs.outfit_main || '日常服饰'}；性格 ${cs.personality || '开朗'}\n`;
          });
        }
        if (characterInstructions) userPrompt += `\n${characterInstructions}\n\n`;
        userPrompt += '\n请输出一个高质量、结构完整的漫剧剧本（严格的 JSON 格式，无任何说明文本）。';

        let fullContent = '';
        let lastEmitTime = 0;
        let chunkCount = 0;

        await chatCompletionStream({
          model: TEXT_MODEL,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.7,
          max_tokens: 6000,
        }, async (chunk, done) => {
          if (!done && chunk) {
            fullContent += chunk;
            chunkCount++;
            const now = Date.now();
            if (chunkCount % 10 === 0 || now - lastEmitTime > 200) {
              emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 15 + Math.min(65, Math.floor(chunkCount / 5)), message: '生成中...' });
              send('chunk', { content: fullContent, progress: Math.min(80, 15 + Math.floor(chunkCount / 5)), chunkCount });
              lastEmitTime = now;
            }
          }
          if (done) {
            emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 85, message: '整理与验证剧本' });
            send('progress', { progress: 85, message: '整理与验证剧本...' });
            let finalContent = fullContent;
            try { JSON.parse(fullContent); } catch { const jsonMatch = fullContent.match(/\{[\s\S]*\}/); if (jsonMatch) finalContent = jsonMatch[0]; }

            emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 90, message: 'AI 审稿中...' });
            send('progress', { progress: 90, message: 'AI 审稿中（质量分析）...' });
            let qualityRefined = false;
            let critiqueScore = 0;
            try {
              const qualityResult = await enhanceScriptQuality(finalContent);
              if (qualityResult.refined && qualityResult.critique) {
                finalContent = qualityResult.finalScript;
                qualityRefined = true;
                critiqueScore = qualityResult.critique.overall_score;
              } else if (qualityResult.critique) {
                critiqueScore = qualityResult.critique.overall_score;
              }
            } catch (e) { logger.warn('[scripts] Quality enhancement skipped:', e); }

            await prisma.script.update({ where: { id: scriptId }, data: { content: finalContent, status: 'completed' } });
            await updateProjectStatus(projectId, 'storyboarding');
            emitProgress({ type: 'script', id: scriptId, status: 'completed', progress: 100, message: '剧本生成完成' });
            send('completed', { content: finalContent, progress: 100, message: '剧本生成完成' + (qualityRefined ? '（已 AI 优化）' : ''), qualityScore: critiqueScore, refined: qualityRefined });
            controller.close();
          }
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : '未知错误';
        const friendlyMsg = formatScriptError(errMsg);
        logger.error('Stream script generation error:', error);
        await prisma.script.update({ where: { id: scriptId }, data: { status: 'failed' } }).catch(() => null);
        emitProgress({ type: 'script', id: scriptId, status: 'failed', message: '生成失败: ' + friendlyMsg });
        send('error', { message: friendlyMsg, raw: errMsg.slice(0, 200) });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
