import prisma from './prisma-client';

// 项目状态自动流转工具
// 状态机：draft -> scripting -> storyboarding -> producing -> completed
export const PROJECT_STATUS = {
  DRAFT: 'draft',
  SCRIPTING: 'scripting',
  STORYBOARDING: 'storyboarding',
  PRODUCING: 'producing',
  COMPLETED: 'completed',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

const STATUS_ORDER: Record<ProjectStatus, number> = {
  draft: 0,
  scripting: 1,
  storyboarding: 2,
  producing: 3,
  completed: 4,
};

export async function updateProjectStatus(
  projectId: string,
  target: ProjectStatus
): Promise<void> {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;
    const current = project.status as ProjectStatus;
    // 单向流转：不倒退（防止覆盖正在进行的标记）
    if (
      STATUS_ORDER[target] > STATUS_ORDER[current] ||
      (current as string) === 'failed' ||
      (current as string) === 'unknown'
    ) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: target },
      });
    }
  } catch (e) {
    console.error('updateProjectStatus failed:', e);
  }
}
