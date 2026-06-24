import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { chatCompletion, chatCompletionStream } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { updateProjectStatus } from '@/lib/project-status';
import { emitProgress } from '@/lib/progress-bus';
import { buildCharacterConsistencyInstructions, buildCharacterSheet } from '@/lib/character-prompt';
import { SCRIPT_PROMPTS } from '@/lib/prompt-library';
import { enqueueJob } from '@/lib/job-queue';
// 剧本质量增强（Multi-Agent 批评-改写闭环）
import { enhanceScriptQuality } from '@/lib/script-refiner';
// 触发 job handler 注册（必须在 enqueueJob 前 import）
import '@/lib/jobs';

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const where = projectId ? { projectId } : {};
    const scripts = await prisma.script.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(scripts);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 });
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
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const outline = typeof body.outline === 'string' ? body.outline.trim() : '';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }
  if (!outline) {
    return NextResponse.json({ error: 'outline 必填且非空' }, { status: 400 });
  }
  if (outline.length > 5000) {
    return NextResponse.json({ error: 'outline 长度不能超过 5000' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // 并发保护：同一项目下若已有 generating 状态的 script，拒绝新请求
  const existing = await prisma.script.count({
    where: { projectId, status: 'generating' },
  });
  if (existing > 0) {
    return NextResponse.json(
      { error: '该项目已有正在生成的剧本，请等待完成或清理超时任务' },
      { status: 409 }
    );
  }

  const pendingScript = await prisma.script.create({
    data: { outline, content: '', status: 'generating', projectId },
  });

  await updateProjectStatus(projectId, 'scripting');
  emitProgress({
    type: 'script',
    id: pendingScript.id,
    status: 'started',
    progress: 0,
    message: '开始生成剧本',
  });

  // ===== 流式生成路径 =====
  if (wantStream) {
    return streamScriptGeneration(pendingScript.id, projectId, outline, project.style || 'anime');
  }

  // ===== 后台非流式生成：通过 Job 队列调度（worker 进程内消费，不再 fire-and-forget）=====
  const job = await enqueueJob(
    'script',
    { scriptId: pendingScript.id, projectId, outline, style: project.style || 'anime' },
    projectId
  );

  return NextResponse.json({ ...pendingScript, jobId: job.id }, { status: 202 });
}

// 注：非流式剧本生成的多轮逻辑（Pass 1-3、validateScriptStructure）
// 已迁移到 src/lib/jobs/generate-script.ts，由 job-queue worker 调度。
// 下面仅保留流式生成路径（streamScriptGeneration）。

// ============================================================
// 错误信息人性化处理
// ============================================================
function formatScriptError(raw: string): string {
  // 检测内容过滤
  const filterPatterns = [
    /cannot provide/i, /violen/i, /illegal/i,
    /safety|harmful|inappropriate/i,
    /content.*policy/i,
  ];
  const isFiltered = filterPatterns.some(p => p.test(raw));

  if (isFiltered) {
    return '剧本因内容安全策略被拦截。建议将大纲中的敏感描述（如：谋杀→秘密，纵火→意外，死亡→消失）替换为非敏感表达后重试。';
  }

  // 超时
  if (raw.includes('timeout') || raw.includes('超时')) {
    return '剧本生成超时，请简化故事大纲后重试。';
  }

  // API 错误
  if (raw.includes('422') || raw.includes('500') || raw.includes('API')) {
    return 'AI 服务暂时不可用，请稍后重试。';
  }

  // 截断过长消息
  return raw.length > 100 ? raw.slice(0, 100) + '...' : raw;
}

// ============================================================
// 流式剧本生成：边生成边推送，用户实时看到剧本内容
// 通过 progress bus 发送 script_content 事件，前端 SSE 接收
// ============================================================
async function streamScriptGeneration(
  scriptId: string,
  projectId: string,
  outline: string,
  style: string
) {
  // 构建编码器，用于 SSE 推送
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send('script_id', { id: scriptId });

        // Pass 0: 加载角色
        emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 5, message: '加载角色与世界观' });
        send('progress', { progress: 5, message: '加载角色与世界观' });

        const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
        const characters = await prisma.character.findMany({ where: { projectId } });
        const characterSheets = characters.map((c) =>
                buildCharacterSheet({ name: c.name, age: c.age, gender: c.gender, personality: c.personality, clothing: c.clothing, appearance: c.appearance, hair: c.hair, eyes: c.eyes, build: c.build, referenceImg: c.referenceImg, dnaSummary: c.dnaSummary })
        );
        const characterInstructions = buildCharacterConsistencyInstructions(characters);

        emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 15, message: 'AI 创作剧本中...' });
        send('progress', { progress: 15, message: 'AI 创作剧本中（实时生成）...' });

        // 构建提示词
        const systemPrompt = SCRIPT_PROMPTS.outline_to_full;
        let userPrompt = `【故事大纲】\n${outline}\n\n【整体画风】${style}\n\n`;
        if (characterSheets.length > 0) {
          userPrompt += `【登场角色】（共 ${characterSheets.length} 位）\n`;
          characterSheets.forEach((cs) => {
            const apprDesc = cs.face || cs.signature_look || '标准外貌';
            userPrompt += `- ${cs.name}：${apprDesc}；穿着 ${cs.outfit_main || '日常服饰'}；性格 ${cs.personality || '开朗'}\n`;
          });
        }
        if (characterInstructions) userPrompt += `\n${characterInstructions}\n\n`;
        userPrompt += '\n请输出一个高质量、结构完整的漫剧剧本（严格的 JSON 格式，无任何说明文本）。';

        // 流式调用 AI，边收边推
        let fullContent = '';
        let lastEmitTime = 0;
        let chunkCount = 0;

        await chatCompletionStream(
          {
            model: TEXT_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 6000,
          },
          async (chunk, done) => {
            if (!done && chunk) {
              fullContent += chunk;
              chunkCount++;
              // 节流：每 10 个 chunk 或 200ms 推一次
              const now = Date.now();
              if (chunkCount % 10 === 0 || now - lastEmitTime > 200) {
                // 通过 progress bus 广播
                emitProgress({
                  type: 'script',
                  id: scriptId,
                  status: 'progress',
                  progress: 15 + Math.min(65, Math.floor(chunkCount / 5)),
                  message: '生成中...',
                });
                send('chunk', {
                  content: fullContent,
                  progress: Math.min(80, 15 + Math.floor(chunkCount / 5)),
                  chunkCount,
                });
                lastEmitTime = now;
              }
            }

            if (done) {
              // JSON 验证 + 修复
              emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 85, message: '整理与验证剧本' });
              send('progress', { progress: 85, message: '整理与验证剧本...' });

              let finalContent = fullContent;

              // 尝试解析
              try {
                JSON.parse(fullContent);
              } catch {
                const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) finalContent = jsonMatch[0];
              }

              // ===== Multi-Agent 质量增强（批评-改写闭环）=====
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
                  emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 95, message: `AI 改写完成（评分: ${critiqueScore}→${Math.min(critiqueScore + 15, 100)}）` });
                  send('progress', { progress: 95, message: `AI 改写完成` });
                } else if (qualityResult.critique) {
                  critiqueScore = qualityResult.critique.overall_score;
                  emitProgress({ type: 'script', id: scriptId, status: 'progress', progress: 95, message: `剧本质量达标（评分: ${critiqueScore}）` });
                  send('progress', { progress: 95, message: `剧本质量达标` });
                }
              } catch (e) {
                console.warn('[scripts] Quality enhancement skipped:', e);
              }

              // 保存到数据库（包装为 async IIFE，因为 onChunk 回调不是 async）
              await (async () => {
                await prisma.script.update({
                  where: { id: scriptId },
                  data: { content: finalContent, status: 'completed' },
                });
                await updateProjectStatus(projectId, 'storyboarding');
              })();

              emitProgress({ type: 'script', id: scriptId, status: 'completed', progress: 100, message: '剧本生成完成' });
              send('completed', {
                content: finalContent,
                progress: 100,
                message: '剧本生成完成' + (qualityRefined ? '（已 AI 优化）' : ''),
                qualityScore: critiqueScore,
                refined: qualityRefined,
              });

              controller.close();
            }
          }
        );
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : '未知错误';
        const friendlyMsg = formatScriptError(errMsg);
        console.error('Stream script generation error:', error);
        await prisma.script
          .update({ where: { id: scriptId }, data: { status: 'failed' } })
          .catch(() => null);
        emitProgress({ type: 'script', id: scriptId, status: 'failed', message: '生成失败: ' + friendlyMsg });
        send('error', { message: friendlyMsg, raw: errMsg.slice(0, 200) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
