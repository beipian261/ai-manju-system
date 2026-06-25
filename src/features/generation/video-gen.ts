import prisma from '@/lib/db/prisma';
import { generateVideo as agnesGenerateVideo, getVideoTask } from '@/lib/ai/agnes-client';
import { getSetting } from '@/lib/config/settings';
import { updateProjectStatus } from '@/lib/utils/project-status';
import { isSafeExternalUrl } from '@/lib/utils/url-guard';

export interface GenerateVideoOptions {
  storyboardId: string;
  duration?: number;
}

export interface GenerateVideoResult {
  videoUrl?: string;
  videoTaskId?: string;
  videoStatus?: string;
  duration?: number;
}

export type VideoTaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

// 对分镜图片生成视频的完整流程（异步）
// Agnes:
// 1. 读取 storyboard, 拿分镜图片 + 描述
// 2. 调用 Agnes Video API 创建任务，返回 task_id
// 3. 保存 videoTaskId 到数据库（前端轮询）
export async function generateStoryboardVideo(
  options: GenerateVideoOptions
): Promise<GenerateVideoResult> {
  const { storyboardId, duration: inputDuration } = options;

  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
    include: { script: true },
  });
  if (!storyboard) {
    throw new Error('Storyboard not found');
  }
  if (!storyboard.imageUrls) {
    throw new Error('分镜还未生成图片，无法生成视频');
  }

  const VIDEO_MODEL = (await getSetting('AGNES_VIDEO_MODEL')) || 'agnes-video-v2.0';

  // imageUrls 可以是多个 URL 用逗号或 JSON 字符串 - 只取第一个合法 HTTPS URL
  const imageUrl = storyboard.imageUrls.split(',').map((u) => u.trim()).filter((u) => isSafeExternalUrl(u))[0] || '';
  if (!imageUrl) {
    throw new Error('未找到有效的分镜图片 URL');
  }

  const prompt = buildVideoPrompt(storyboard.description, storyboard.emotion || '', storyboard.timeOfDay || '', storyboard.cameraAngle || '');

  // Agnes 默认 seconds 字段为字符串，如 "5.0" / "10.0"
  const duration = typeof inputDuration === 'number' && inputDuration > 0 && inputDuration <= 10 ? inputDuration : 8;

  const response = await agnesGenerateVideo({
    model: VIDEO_MODEL,
    prompt,
    images: [imageUrl],
    seconds: String(duration),
  });

  // 保存异步任务 ID 到数据库，前端通过 /api/agnes/video/task/{taskId} 轮询
  await prisma.storyboard.update({
    where: { id: storyboardId },
    data: {
      videoTaskId: response.task_id,
      videoStatus: response.status || 'queued',
      duration,
    },
  });
  await updateProjectStatus(storyboard.script.projectId, 'producing');

  return {
    videoTaskId: response.task_id,
    videoStatus: response.status || 'queued',
    duration,
  };
}

// 轮询 Agnes 视频任务状态
export async function pollVideoTask(taskId: string): Promise<GenerateVideoResult> {
  const task = await getVideoTask(taskId);

  if (task.error) {
    throw new Error(`视频生成失败：${task.error}`);
  }
  if (task.status === 'failed') {
    throw new Error('视频生成任务失败');
  }

  // Agnes 把视频 URL 放在 remixed_from_video_id 字段中
  const videoUrl = task.remixed_from_video_id;
  if (task.status === 'completed' && videoUrl) {
    return {
      videoUrl,
      videoTaskId: task.task_id,
      videoStatus: 'completed',
    };
  }

  return {
    videoTaskId: task.task_id,
    videoStatus: task.status,
  };
}

// 根据 storyboard 的 videoTaskId 更新状态并保存 URL
export async function syncStoryboardVideo(storyboardId: string): Promise<GenerateVideoResult> {
  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
    include: { script: true },
  });
  if (!storyboard) throw new Error('Storyboard not found');
  if (!storyboard.videoTaskId) throw new Error('该分镜没有视频任务');

  const result = await pollVideoTask(storyboard.videoTaskId);

  if (result.videoUrl) {
    await prisma.storyboard.update({
      where: { id: storyboardId },
      data: { videoUrl: result.videoUrl, videoStatus: 'completed' },
    });
  } else {
    await prisma.storyboard.update({
      where: { id: storyboardId },
      data: { videoStatus: result.videoStatus },
    });
  }

  return result;
}

// 构建视频生成 prompt（更详细的描述 = 更好的视频质量）
function buildVideoPrompt(description: string, emotion: string, timeOfDay: string, cameraAngle: string): string {
  const parts: string[] = [];
  parts.push('High quality anime-style cinematic animation sequence');
  if (description) parts.push(`Scene: ${description}`);
  if (emotion) parts.push(`Mood/Atmosphere: ${emotion}`);
  if (timeOfDay) parts.push(`Time of day: ${timeOfDay}`);
  if (cameraAngle) parts.push(`Camera angle: ${cameraAngle}`);
  parts.push('Masterpiece quality, smooth motion, cinematic lighting, vibrant colors, detailed animation, fluid character movement, professional production quality, stunning visuals, highly detailed background');
  return parts.join('. ');
}
