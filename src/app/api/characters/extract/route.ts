// 智能角色生成器 API
// 从剧本自动提取角色并完善设定
import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth';
import { chatCompletion } from '@/lib/agnes-client';
import { getSetting } from '@/lib/settings';
import prisma from '@/lib/prisma-client';

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
  const scriptId = typeof body.scriptId === 'string' ? body.scriptId.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const autoCreate = body.autoCreate !== false;

  if (!projectId && !content) {
    return NextResponse.json({ error: 'projectId 或 content 必填' }, { status: 400 });
  }

  let scriptContent = content;
  
  // 如果提供了 scriptId，从数据库获取内容
  if (scriptId && !content) {
    const script = await prisma.script.findUnique({ where: { id: scriptId } });
    if (script) {
      scriptContent = script.content;
    }
  }

  if (!scriptContent) {
    return NextResponse.json({ error: '无法获取剧本内容' }, { status: 400 });
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  try {
    // 第一步：提取角色列表
    const extractResponse = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: '你是一位专业的角色分析专家。请从剧本中提取角色信息。输出 JSON 格式。' },
        { role: 'user', content: `请从以下剧本中提取角色信息：\n\n${scriptContent}\n\n输出格式：{"characters": [{"name": "角色名", "gender": "男/女/未知", "age": "年龄段", "personality": "性格描述", "role": "主角/配角/反派", "relationships": ["与其他角色的关系"]}]}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const extractResult = extractResponse.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(extractResult);
    } catch {
      return NextResponse.json({ error: '角色提取失败' }, { status: 500 });
    }

    const characters = parsed.characters || [];
    if (characters.length === 0) {
      return NextResponse.json({ error: '未提取到角色' }, { status: 400 });
    }

    // 第二步：完善角色设定
    const enrichedCharacters = await Promise.all(
      characters.map(async (char: any) => {
        const detailResponse = await chatCompletion({
          model: TEXT_MODEL,
          messages: [
            { role: 'system', content: '你是一位角色设定专家。请根据角色基本信息完善详细设定。' },
            { role: 'user', content: `请为角色「${char.name}」完善详细设定：\n\n基本信息：\n- 性别：${char.gender}\n- 年龄：${char.age}\n- 性格：${char.personality || '待完善'}\n- 角色类型：${char.role}\n\n请提供：外貌描述、服装风格、发型、眼睛颜色、身高体型、独特特征。输出 JSON 格式。` },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        });

        const detailResult = detailResponse.choices[0]?.message?.content || '{}';
        let detailParsed;
        try {
          detailParsed = JSON.parse(detailResult);
        } catch {
          detailParsed = {};
        }

        return {
          name: char.name,
          gender: char.gender || '未知',
          age: char.age || '未知',
          personality: char.personality || detailParsed.personality || '待完善',
          appearance: detailParsed.appearance || '',
          clothing: detailParsed.clothing || '',
          hair: detailParsed.hair || '',
          eyes: detailParsed.eyes || '',
          build: detailParsed.build || '',
          role: char.role || '配角',
          relationships: char.relationships || [],
        };
      })
    );

    // 自动创建到数据库
    if (projectId && autoCreate) {
      for (const char of enrichedCharacters) {
        // 检查是否已存在同名角色
        const existing = await prisma.character.findFirst({
          where: { projectId, name: char.name },
        });
        
        if (existing) {
          // 更新现有角色
          await prisma.character.update({
            where: { id: existing.id },
            data: {
              gender: char.gender === '未知' ? undefined : char.gender,
              age: char.age === '未知' ? undefined : char.age,
              personality: char.personality,
              appearance: char.appearance,
              clothing: char.clothing,
              hair: char.hair,
              eyes: char.eyes,
              build: char.build,
            },
          });
        } else {
          // 创建新角色
          await prisma.character.create({
            data: {
              projectId,
              name: char.name,
              gender: char.gender,
              age: char.age,
              personality: char.personality,
              appearance: char.appearance,
              clothing: char.clothing,
              hair: char.hair,
              eyes: char.eyes,
              build: char.build,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      characters: enrichedCharacters,
      created: autoCreate && projectId,
      count: enrichedCharacters.length,
    });
  } catch (e) {
    console.error('[character-extractor] error:', e);
    return NextResponse.json({
      error: '角色提取失败',
      message: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}

// GET: 获取角色提取模板
export async function GET() {
  return NextResponse.json({
    description: '智能角色生成器 - 从剧本自动提取并完善角色设定',
    features: [
      '自动识别角色名称',
      '推断性别和年龄段',
      '分析性格特征',
      '识别角色关系',
      '生成详细外貌描述',
      '自动创建到数据库',
    ],
    outputFields: [
      { field: 'name', description: '角色名称' },
      { field: 'gender', description: '性别' },
      { field: 'age', description: '年龄/年龄段' },
      { field: 'personality', description: '性格描述' },
      { field: 'appearance', description: '外貌描述' },
      { field: 'clothing', description: '服装风格' },
      { field: 'hair', description: '发型' },
      { field: 'eyes', description: '眼睛颜色' },
      { field: 'build', description: '身高体型' },
      { field: 'role', description: '角色类型（主角/配角/反派）' },
      { field: 'relationships', description: '与其他角色的关系' },
    ],
  });
}