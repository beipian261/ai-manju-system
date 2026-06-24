import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { parseScriptToStoryboards } from '@/lib/script-parser';
import { batchGenerateCharacters } from '@/lib/character-batch-generator';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import { logger } from '@/lib/logger';

// ============================================================
// POST /api/characters/extract-from-script
// 从剧本内容自动提取并创建角色
//
// Body: {
//   scriptId: string    (必填)
//   projectId: string   (必填)
//   hint?: string       (可选：角色提取提示，如"提取主角和主要配角，忽略路人")
// }
//
// 流程：
// 1. 解析剧本 JSON 提取 scenes 中的 characters_in_scene
// 2. 如果没有提取到，用 AI 从剧本文本中提取角色名
// 3. 对每个不重复的角色名，调用 AI 生成完整角色设定
// 4. 批量写入数据库
// ============================================================

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

  const scriptId = trimStr(body.scriptId, 64);
  const projectId = trimStr(body.projectId, 64);
  const hint = trimStr(body.hint, 500);
  const selectedNames = Array.isArray(body.selectedNames) ? body.selectedNames.filter((n: unknown) => typeof n === 'string') as string[] : [];

  if (!scriptId || !projectId) {
    return NextResponse.json({ error: 'scriptId 和 projectId 必填' }, { status: 400 });
  }

  // 1. 加载剧本
  const script = await prisma.script.findUnique({ where: { id: scriptId } });
  if (!script) {
    return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
  }
  if (script.status !== 'completed') {
    return NextResponse.json({ error: '剧本未完成，请等待生成结束' }, { status: 400 });
  }

  // 2. 解析剧本，提取角色名
  const nameSet = new Set<string>();
  let characterNames: string[];

  // 如果提供了选中的角色名，直接使用
  if (selectedNames.length > 0) {
    characterNames = selectedNames;
    selectedNames.forEach(n => nameSet.add(n));
  } else {
    // 从 scenes 中收集角色名
    const frames = parseScriptToStoryboards(script.content);
    frames.forEach(f => {
      f.characters_in_scene?.forEach(name => {
        const trimmed = name.trim();
        if (trimmed) nameSet.add(trimmed);
      });
    });

    // 也尝试从 JSON 内容中提取 title/logline 级别的角色暗示
    // 如果 parseScriptToStoryboards 没有提取到角色，试试 AI 提取
    characterNames = Array.from(nameSet);
  }

  // 3. 去重：过滤掉已存在的角色
  const existingChars = await prisma.character.findMany({
    where: { projectId, name: { in: characterNames } },
    select: { name: true },
  });
  const existingNames = new Set(existingChars.map(c => c.name));
  characterNames = characterNames.filter(name => !existingNames.has(name));

  // 4. 如果没有提取到角色且没有提供 selectedNames，用 AI 从剧本内容中提取
  if (characterNames.length === 0 && selectedNames.length === 0) {
    try {
      const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
      const scriptPreview = script.content.slice(0, 6000);
      
      // 第一次尝试：从结构化内容提取
      let aiRes = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: '你是一个剧本分析助手。从剧本内容中提取所有出现的角色名。仔细分析对话、场景描述、角色对话等内容，找出所有人物名称。只输出一个 JSON 数组，格式为 {"characters": ["角色1", "角色2"]}。不要任何其他文字。' },
          { role: 'user', content: `剧本内容：\n${scriptPreview}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });
      
      let aiRaw = aiRes.choices[0]?.message?.content || '{"characters": []}';
      let aiParsed;
      try {
        aiParsed = JSON.parse(aiRaw);
      } catch {
        // 如果解析失败，尝试直接提取字符串数组
        const match = aiRaw.match(/["'“”]([^"'"“”]+)["'“”]/g);
        aiParsed = match ? { characters: match.map(m => m.replace(/["'“”]/g, '').trim()) } : { characters: [] };
      }
      
      const aiNames = Array.isArray(aiParsed) ? aiParsed :
                      Array.isArray(aiParsed.characters) ? aiParsed.characters :
                      Array.isArray(aiParsed.names) ? aiParsed.names : [];
      aiNames.forEach((n: string) => { if (typeof n === 'string' && n.trim()) nameSet.add(n.trim()); });
      characterNames = Array.from(nameSet);

      // 如果第一次提取失败，尝试第二次更宽松的提取
      if (characterNames.length === 0) {
        aiRes = await chatCompletion({
          model: TEXT_MODEL,
          messages: [
            { role: 'system', content: '你是一个剧本分析专家。请仔细阅读以下剧本内容，找出所有出现的人物角色。角色可能出现在对话前的冒号前（如「张三：你好」）、场景描述中、或者旁白描述中。列出所有不重复的角色名称。只输出角色名，用换行分隔。' },
            { role: 'user', content: `剧本内容：\n${scriptPreview}` },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        });
        
        aiRaw = aiRes.choices[0]?.message?.content || '';
        // 解析纯文本输出，支持多种格式
        const lines = aiRaw.split('\n').map(line => {
          // 移除序号、符号等
          const clean = line.replace(/^\s*[\d.\-*•○●◆▶]+\s*/, '').trim();
          // 移除引号
          return clean.replace(/^["'“”](.*)["'“”]$/, '$1').trim();
        }).filter(line => line.length > 1 && line.length < 30);
        
        lines.forEach(name => nameSet.add(name));
        characterNames = Array.from(nameSet);
      }

      // 再次去重
      if (characterNames.length > 0) {
        const existingChars2 = await prisma.character.findMany({
          where: { projectId, name: { in: characterNames } },
          select: { name: true },
        });
        const existingNames2 = new Set(existingChars2.map(c => c.name));
        characterNames = characterNames.filter(name => !existingNames2.has(name));
      }
    } catch (e) { 
      logger.warn('[extract-from-script] AI extraction failed:', e);
    }

    if (characterNames.length === 0) {
      return NextResponse.json({
        characters: [],
        message: '未从剧本中解析出角色信息。请先生成分镜数据，或在「AI 生成」中手动添加角色。',
        totalExtracted: 0,
        skipped: 0,
      });
    }
  }

  // 5. 获取项目信息（用于风格/题材上下文）
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  // 6. 单次批量生成所有角色设定（一次 AI 调用，相比串行提升 5-10 倍速度）
  const generatedCharacters = await batchGenerateCharacters(characterNames, {
    genre: project?.genre,
    style: project?.style,
    hint,
  });

  // 7. 批量创建数据库记录
  const results: Array<{ name: string; success: boolean; id?: string; error?: string }> = [];
  
  for (const generated of generatedCharacters) {
    try {
      const created = await prisma.character.create({
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
      results.push({ name: created.name, success: true, id: created.id });
    } catch (e) {
      results.push({
        name: generated.name,
        success: false,
        error: e instanceof Error ? e.message : '创建失败',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return NextResponse.json({
    characters: results,
    totalExtracted: nameSet.size,
    created: successCount,
    failed: results.length - successCount,
    projectId,
  }, { status: 201 });
}