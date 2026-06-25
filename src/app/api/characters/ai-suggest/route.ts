import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { logger } from '@/lib/utils/logger';

// ============================================================
// POST /api/characters/ai-suggest
// 功能：基于用户输入的角色基础信息（name/gender/age/简介等），
//       用 AI 自动生成合理的 personality/clothing/appearance/hair/eyes/build
//       等详细字段，便于后续高质量定妆照生成
// ============================================================

const MAX_LEN = 200;
function trimStr(v: unknown, max = MAX_LEN): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return '';
  return v.slice(0, max).trim();
}

// 风格到描述的映射
const STYLE_GUIDES: Record<string, string> = {
  anime: '日式动漫风格，角色要有鲜明的视觉特征，色彩鲜艳但不俗气',
  comic: '美式漫画风格，角色轮廓清晰，色彩对比强烈',
  realistic: '写实风格，接近真人，细节真实',
  scifi: '科幻风格，服装可以有科技感元素，面料现代',
  fantasy: '奇幻风格，服装可以有魔法元素，材质梦幻',
  cyberpunk: '赛博朋克风格，霓虹灯光、机械元素、暗黑色调',
  gothic: '哥特风格，暗黑、华丽、神秘感',
  pastel: '马卡龙/糖果色风格，柔和、甜美、梦幻',
};

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }

  const name = trimStr(body.name, 50);
  const gender = trimStr(body.gender, 20);
  const age = trimStr(body.age, 20);
  const personality = trimStr(body.personality, 300);
  const clothing = trimStr(body.clothing, 300);
  const appearance = trimStr(body.appearance, 300);
  const hair = trimStr(body.hair, 200);
  const eyes = trimStr(body.eyes, 200);
  const build = trimStr(body.build, 200);

  if (!name) {
    return NextResponse.json({ error: '角色名必填' }, { status: 400 });
  }

  // 获取项目风格（可选）
  let projectStyle = '';
  let projectGenre = '';
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { style: true, genre: true },
    });
    if (project) {
      projectStyle = project.style || '';
      projectGenre = project.genre || '';
    }
  }

  const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');

  const fieldsToFill: string[] = [];
  if (!personality) fieldsToFill.push('personality');
  if (!clothing) fieldsToFill.push('clothing');
  if (!appearance) fieldsToFill.push('appearance');
  if (!hair) fieldsToFill.push('hair');
  if (!eyes) fieldsToFill.push('eyes');
  if (!build) fieldsToFill.push('build');

  // 如果所有字段都已填，直接返回原数据
  if (fieldsToFill.length === 0) {
    return NextResponse.json({
      name,
      gender,
      age,
      personality,
      clothing,
      appearance,
      hair,
      eyes,
      build,
      filled: [],
    });
  }

  // 构建风格指南
  const styleGuide = STYLE_GUIDES[projectStyle] || STYLE_GUIDES.anime;
  
  // 构建用户提示词
  const userPrompt =
    `请为角色「${name}」生成高质量的视觉描述，用于制作动漫/漫画风格的定妆照。\n\n` +
    `【基础信息】\n` +
    `- 名字: ${name}\n` +
    (gender ? `- 性别: ${gender}\n` : '') +
    (age ? `- 年龄: ${age}\n` : '') +
    (projectGenre ? `- 题材: ${projectGenre}\n` : '') +
    (projectStyle ? `- 风格: ${projectStyle}（${styleGuide}）\n` : '') +
    `\n【输出格式要求】\n` +
    `输出 JSON 对象，包含以下字段，每个字段用 1-2 句话描述，语言生动有画面感：\n\n` +
    `{\n` +
    `  "personality": "用 3-4 个形容词概括性格，加一句有趣的描述",\n` +
    `  "clothing": "具体服装款式 + 颜色 + 材质 + 标志性配饰（用自然语言描述，不要用+号）",\n` +
    `  "appearance": "脸型 + 肤色 + 面部特征 + 独特标记（如疤痕、纹身）+ 整体气质",\n` +
    `  "hair": "发型长度 + 颜色 + 层次感 + 有趣的细节（呆毛、刘海、发饰等）",\n` +
    `  "eyes": "眼睛颜色 + 形状 + 眼神神态 + 让人印象深刻的细节",\n` +
    `  "build": "身高感 + 身材类型 + 体态特征"\n` +
    `}\n\n` +
    `【优秀示例参考】\n` +
    `personality: "开朗乐观，有点冒失，总是把事情搞砸却能化险为夷"\n` +
    `clothing: "穿着一件洗得发白的牛仔夹克，内搭米色衬衫，下身是磨破的牛仔裤和棕色皮靴，头上永远歪戴着一顶宽边帽"\n` +
    `appearance: "方形脸，小麦色皮肤，高颧骨，下巴上留着没刮干净的胡茬，笑容阳光灿烂但带着一丝呆萌"\n` +
    `hair: "金棕色的中长发自然卷曲，两侧鬓角修剪得参差不齐，头顶总有一撮不服帖的呆毛翘着"\n` +
    `eyes: "琥珀色的圆眼睛清澈明亮，眼神里总是带着好奇和一丝迷茫"\n` +
    `build: "身高约178cm，身材瘦削但骨架匀称，站姿挺拔却总显得有些笨拙"\n\n` +
    `【注意事项】\n` +
    `- 使用自然流畅的中文描述，不要用+号连接\n` +
    `- 描述要有辨识度，让人能想象出角色的样子\n` +
    `- 语言要生动有趣，避免呆板\n` +
    `- 不要使用Markdown格式\n` +
    `- 只输出纯JSON，不要加任何解释文字`;

  try {
    const response = await chatCompletion({
      model: TEXT_MODEL,
      messages: [
        {
          role: 'system',
          content: `你是一位资深角色设定师，擅长为动漫/漫画设计有辨识度、有深度的角色。

你的任务是根据给定的角色信息，生成详细的视觉描述。

【输出格式】
只输出一个 JSON 对象，包含以下六个字段，每个字段值为 1-2 句中文描述：
- personality: 性格（2-3个关键词 + 一句描述）
- clothing: 服装（款式+颜色+材质+标志性配饰）
- appearance: 外貌（脸型+肤色+面部特征+气质）
- hair: 发型（长度+颜色+细节）
- eyes: 眼睛（颜色+形状+神态）
- build: 体型（身材+身高感）

【设计原则】
1. 每个描述都要具体、可视化，避免空泛的形容词
2. 服装是最重要的辨识特征，要写得非常详细
3. 外貌要体现角色的独特性（疤痕、胎记、面具等）
4. 眼睛是灵魂，要写出眼神的感觉
5. 体型要符合角色身份（武林高手 vs 文弱书生）

只输出 JSON 对象，不要任何其他文字或 markdown 代码块。`,
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices[0]?.message?.content || '';
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = {};
        }
      } else {
        // 尝试按行解析
        parsed = {};
        const lines = rawContent.split(/\n/);
        for (const line of lines) {
          const m = line.match(/(personality|clothing|appearance|hair|eyes|build)\s*[:：]\s*(.+)/i);
          if (m) {
            const key = m[1].toLowerCase();
            let val = m[2].trim();
            val = val.replace(/^["'`]+|["'`]+$/g, '').replace(/[,，]\s*$/, '').trim();
            if (val && val.length < 600) {
              parsed[key] = val;
            }
          }
        }
      }
    }

    // 确保每个字段都有值
    const result = {
      name,
      gender,
      age,
      personality: typeof parsed.personality === 'string' && parsed.personality.length > 5 
        ? trimStr(parsed.personality, 300) 
        : personality || '性格待定',
      clothing: typeof parsed.clothing === 'string' && parsed.clothing.length > 5 
        ? trimStr(parsed.clothing, 300) 
        : clothing || '服装待定',
      appearance: typeof parsed.appearance === 'string' && parsed.appearance.length > 5 
        ? trimStr(parsed.appearance, 300) 
        : appearance || '外貌待定',
      hair: typeof parsed.hair === 'string' && parsed.hair.length > 3 
        ? trimStr(parsed.hair, 200) 
        : hair || '发型待定',
      eyes: typeof parsed.eyes === 'string' && parsed.eyes.length > 3 
        ? trimStr(parsed.eyes, 200) 
        : eyes || '眼睛待定',
      build: typeof parsed.build === 'string' && parsed.build.length > 3 
        ? trimStr(parsed.build, 200) 
        : build || '体型待定',
      filled: fieldsToFill,
    };

    return NextResponse.json(result);
  } catch (e) {
    logger.error('AI suggest failed:', e);
    const msg = e instanceof Error ? e.message : 'AI 生成失败';
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  }
}
