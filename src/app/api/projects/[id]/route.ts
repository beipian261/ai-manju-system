import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/auth/auth';
import { getProjectById, updateProject, deleteProject } from '@/features/projects/project.service';
import { successResponse, handleApiError, parseJsonBody, notFoundResponse } from '@/lib/api/response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const project = await getProjectById(id);
    if (!project) {
      return notFoundResponse('项目不存在');
    }
    return successResponse(project);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    const body = await parseJsonBody<{
      title?: string;
      description?: string;
      genre?: string;
      style?: string;
      status?: string;
    }>(req);

    const project = await updateProject(id, body);
    return successResponse(project);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await checkApiAuth();
  if (!auth.ok) return auth.response!;

  try {
    await deleteProject(id);
    return successResponse({ deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
