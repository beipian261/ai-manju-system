import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import { createProject, listProjects } from '@/features/projects/project.service';
import { successResponse, createdResponse, handleApiError, parseJsonBody } from '@/lib/api/response';

export async function GET() {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const projects = await listProjects();
    return successResponse(projects);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{
      title?: string;
      description?: string;
      genre?: string;
      style?: string;
      outline?: string;
    }>(req);

    const project = await createProject({
      title: body.title ?? '',
      description: body.description,
      genre: body.genre,
      style: body.style,
      outline: body.outline,
    });
    return createdResponse(project);
  } catch (e) {
    return handleApiError(e);
  }
}
