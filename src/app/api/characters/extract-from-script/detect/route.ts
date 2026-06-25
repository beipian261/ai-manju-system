import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkApiAuth } from '@/lib/auth/auth';
import { parseScriptToStoryboards } from '@/features/scripts/script-parser';
import { chatCompletion } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { logger } from '@/lib/utils/logger';

// ============================================================
// POST /api/characters/extract-from-script/detect
// 仅检测剧本中的角色名称（不生成完整设定）
//
// Body: {
//   scriptId: string    (必填)
//   projectId: string   (必填)
// }
//
// 返回: { characters: string[] }
// ============================================================

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max).trim();
}

// 判断字符串是否看起来像人名
function looksLikeName(name: string): boolean {
  const trimmed = name.trim();
  
  // 长度检查：人名通常是2-8个字符
  if (trimmed.length < 2 || trimmed.length > 12) return false;
  
  // 不应该包含数字
  if (/\d/.test(trimmed)) return false;
  
  // 不应该包含特殊符号（除了中文名字中的点）
  if (/[!@#$%^&*()+\-=\[\]{}|;':",./<>?`~]/.test(trimmed) && !trimmed.includes('·')) return false;
  
  // 不应该是常见的非人名词汇
  const nonNameWords = [
    '旁白', '旁白者', '叙述者', '作者', '读者', '观众', '镜头', '画面', 
    '场景', '地点', '时间', '旁白音', '旁白声', '画外音', '声音',
    '扩音器', '广播', '音乐', '音效', '字幕', '标题', '正文', '剧本',
    '开始', '结束', '幕', '章', '节', '部分', '全体', '所有人', '大家',
    '某人', '有人', '众人', '人们', '大家', '群众', '人群', '士兵',
    '商人', '领袖', '队长', '首领', '头目', '老板', '经理', '员工',
    '服务员', '顾客', '客人', '路人', '乘客', '司机', '警察', '医生',
    '老师', '学生', '教授', '校长', '主任', '秘书', '助手', '手下',
    '朋友', '敌人', '对手', '同伴', '伙伴', '盟友', '敌人', '仇人',
    '父亲', '母亲', '儿子', '女儿', '兄弟', '姐妹', '亲戚', '家人',
    '男人', '女人', '小孩', '老人', '青年', '少年', '少女', '少年',
    '男孩', '女孩', '婴儿', '成人', '大人', '小孩', '孩子',
  ];
  
  const lowerName = trimmed.toLowerCase();
  for (const word of nonNameWords) {
    if (lowerName === word || lowerName.includes(word)) {
      return false;
    }
  }
  
  // 中文字符检查：人名应该主要是中文字符
  const chineseCharCount = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (chineseCharCount === 0) return false;
  
  return true;
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

  if (!scriptId || !projectId) {
    return NextResponse.json({ error: 'scriptId 和 projectId 必填' }, { status: 400 });
  }

  const script = await prisma.script.findUnique({ where: { id: scriptId } });
  if (!script) {
    return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
  }
  if (script.status !== 'completed') {
    return NextResponse.json({ error: '剧本未完成' }, { status: 400 });
  }

  const nameSet = new Set<string>();

  // 先尝试从结构化数据提取
  try {
    const frames = parseScriptToStoryboards(script.content);
    frames.forEach(f => {
      f.characters_in_scene?.forEach(name => {
        const trimmed = name.trim();
        if (trimmed && looksLikeName(trimmed)) {
          nameSet.add(trimmed);
        }
      });
    });
  } catch { /* ignore parsing errors */ }

  // 如果结构化提取失败，用 AI 提取
  if (nameSet.size === 0) {
    try {
      const TEXT_MODEL = await getSetting('AGNES_TEXT_MODEL');
      const scriptPreview = script.content.slice(0, 6000);
      
      const aiRes = await chatCompletion({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: '你是一个剧本分析助手。从剧本内容中提取所有出现的角色名。仔细分析对话、场景描述、角色对话等内容，找出所有人物名称。只输出一个 JSON 数组，格式为 {"characters": ["角色1", "角色2"]}。不要任何其他文字。注意：只提取具体的人名，不要提取职位、称呼、旁白、声音等非人名内容。' },
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
        const match = aiRaw.match(/["'“”]([^"'"“”]+)["'“”]/g);
        aiParsed = match ? { characters: match.map(m => m.replace(/["'“”]/g, '').trim()) } : { characters: [] };
      }
      
      const aiNames = Array.isArray(aiParsed) ? aiParsed :
                      Array.isArray(aiParsed.characters) ? aiParsed.characters :
                      Array.isArray(aiParsed.names) ? aiParsed.names : [];
      aiNames.forEach((n: string) => { 
        if (typeof n === 'string' && n.trim() && looksLikeName(n.trim())) {
          nameSet.add(n.trim()); 
        }
      });

      // 如果第一次提取失败，尝试第二次
      if (nameSet.size === 0) {
        const aiRes2 = await chatCompletion({
          model: TEXT_MODEL,
          messages: [
            { role: 'system', content: '你是一个剧本分析专家。请仔细阅读以下剧本内容，找出所有出现的人物角色。角色可能出现在对话前的冒号前（如「张三：你好」）、场景描述中、或者旁白描述中。只列出具体的人名，不要职位、称呼、旁白、声音等。用换行分隔每个名字。' },
            { role: 'user', content: `剧本内容：\n${scriptPreview}` },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        });
        
        const aiRaw2 = aiRes2.choices[0]?.message?.content || '';
        const lines = aiRaw2.split('\n').map(line => {
          const clean = line.replace(/^\s*[\d.\-*•○●◆▶]+\s*/, '').trim();
          return clean.replace(/^["'“”](.*)["'“”]$/, '$1').trim();
        }).filter(line => line.length > 1 && looksLikeName(line));
        
        lines.forEach(name => nameSet.add(name));
      }
    } catch (e) {
      logger.warn('[detect-characters] AI detection failed:', e);
    }
  }

  // 过滤已存在的角色
  const existingChars = await prisma.character.findMany({
    where: { projectId, name: { in: Array.from(nameSet) } },
    select: { name: true },
  });
  const existingNames = new Set(existingChars.map(c => c.name));
  const characters = Array.from(nameSet).filter(name => !existingNames.has(name));

  return NextResponse.json({ characters }, { status: 200 });
}