import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import { BUILT_IN_TEMPLATES } from '@/features/scripts/script-templates';

export type { ScriptTemplate } from '@/features/scripts/script-templates';

// GET /api/templates — 获取模板列表
export async function GET(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const genre = searchParams.get('genre');

  let result = BUILT_IN_TEMPLATES;

  if (id) {
    const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }
    result = [tpl];
  } else if (genre) {
    result = BUILT_IN_TEMPLATES.filter((t) => t.genre === genre);
  }

  return NextResponse.json({
    templates: result,
    total: result.length,
  });
}
