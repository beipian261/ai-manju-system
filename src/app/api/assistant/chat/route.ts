import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { runAssistant, AssistantMessage, AssistantContext } from '@/lib/smart-assistant';
import prisma from '@/lib/prisma-client';

// ============================================================
// POST /api/assistant/chat
// 智能助手对话接口
//
// Request body:
// {
//   message: string;              // 用户消息
//   history?: AssistantMessage[]; // 对话历史（最多 6 条）
//   projectId?: string;           // 关联项目（用于上下文感知）
// }
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message 不能为空' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: '消息过长（最多 2000 字符）' }, { status: 400 });
  }

  // 解析历史记录
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history: AssistantMessage[] = rawHistory
    .slice(-6)
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        role: (obj.role === 'user' || obj.role === 'assistant') ? obj.role : 'user',
        content: typeof obj.content === 'string' ? obj.content.slice(0, 1000) : '',
      } as AssistantMessage;
    })
    .filter((m) => m.content.length > 0);

  // 构建上下文（如果传了 projectId，从 DB 读取项目状态）
  let context: AssistantContext | undefined;
  const projectId = typeof body.projectId === 'string' ? body.projectId : null;

  if (projectId) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          title: true,
          genre: true,
        },
      });

      if (project) {
        // 分别查各表的数量
        const [characterCount, scriptCount] = await Promise.all([
          prisma.character.count({ where: { projectId } }),
          prisma.script.count({ where: { projectId } }),
        ]);

        // 分镜数需要通过 Script 关联
        const storyboardCount = await prisma.storyboard.count({
          where: { script: { projectId } },
        });

        // 判断当前步骤（简单状态机）
        let currentStep = 'script';
        if (scriptCount > 0 && characterCount === 0) {
          currentStep = 'characters';
        } else if (characterCount > 0 && storyboardCount === 0) {
          currentStep = 'storyboards';
        } else if (storyboardCount > 0) {
          currentStep = 'images';
        }

        context = {
          projectId,
          projectTitle: project.title,
          genre: project.genre || undefined,
          currentStep,
          hasScript: scriptCount > 0,
          characterCount,
          storyboardCount,
        };
      }
    } catch {
      // 上下文读取失败不影响主流程
    }
  }

  try {
    const result = await runAssistant({
      userMessage: message,
      history,
      context,
    });

    return NextResponse.json({
      intent: result.intent,
      reply: result.reply,
      suggestedActions: result.suggestedActions,
      followUpQuestions: result.followUpQuestions,
      confidence: result.confidence,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `助手调用失败: ${msg}` }, { status: 500 });
  }
}
