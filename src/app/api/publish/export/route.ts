import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma-client';
import { checkApiAuth } from '@/lib/auth';
import { createHash } from 'crypto';

// GET: 获取项目可发布的视频列表
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, genre: true, style: true },
    });

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const storyboards = await prisma.storyboard.findMany({
      where: { script: { projectId } },
      orderBy: { sceneNum: 'asc' },
      select: {
        id: true,
        sceneNum: true,
        title: true,
        description: true,
        dialogue: true,
        imageUrls: true,
        videoUrl: true,
        videoStatus: true,
        duration: true,
        emotion: true,
        location: true,
      },
    });

    const totalDuration = storyboards.reduce((sum, sb) => sum + (sb.duration || 5), 0);
    const completedVideos = storyboards.filter(sb => sb.videoStatus === 'completed' && sb.videoUrl);
    const totalImages = storyboards.filter(sb => sb.imageUrls).length;

    return NextResponse.json({
      project,
      storyboards,
      stats: {
        total: storyboards.length,
        videosReady: completedVideos.length,
        imagesReady: totalImages,
        totalDuration,
        allReady: completedVideos.length === storyboards.length && storyboards.length > 0,
      },
      videoUrls: completedVideos.map(sb => ({
        storyboardId: sb.id,
        sceneNum: sb.sceneNum,
        title: sb.title,
        url: sb.videoUrl,
        duration: sb.duration,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load export data';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: 生成清单 或 ZIP 下载
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
  const platforms = Array.isArray(body.platforms) ? body.platforms : [];
  const format = typeof body.format === 'string' ? body.format : 'mp4';
  const quality = typeof body.quality === 'number' ? body.quality : 85;
  const watermark = body.watermark !== false;
  const download = body.download === true;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId 必填' }, { status: 400 });
  }

  try {
    const storyboards = await prisma.storyboard.findMany({
      where: {
        script: { projectId },
        videoStatus: 'completed',
        videoUrl: { not: null },
      },
      orderBy: { sceneNum: 'asc' },
      select: {
        id: true,
        sceneNum: true,
        title: true,
        description: true,
        videoUrl: true,
        imageUrls: true,
        duration: true,
        dialogue: true,
        emotion: true,
        location: true,
        cameraAngle: true,
        imagePrompt: true,
      },
    });

    if (storyboards.length === 0) {
      return NextResponse.json({ error: '没有已完成的视频可导出' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true, genre: true, style: true },
    });

    // 生成导出清单
    const manifest = {
      projectId,
      projectTitle: project?.title || '未命名项目',
      genre: project?.genre || 'unknown',
      style: project?.style || 'anime',
      exportDate: new Date().toISOString(),
      format,
      quality,
      watermark,
      platforms: platforms.map((p: any) => ({
        id: p.id,
        name: p.name,
        ratio: p.ratio,
        resolution: p.resolution,
      })),
      videos: storyboards.map(sb => ({
        sceneNum: sb.sceneNum,
        title: sb.title || `场景${sb.sceneNum}`,
        description: sb.description,
        url: sb.videoUrl,
        imageUrls: sb.imageUrls?.split(',').filter(Boolean) || [],
        duration: sb.duration || 5,
        dialogue: sb.dialogue || '',
        emotion: sb.emotion || '',
        location: sb.location || '',
        cameraAngle: sb.cameraAngle || '',
      })),
      totalDuration: storyboards.reduce((sum, sb) => sum + (sb.duration || 5), 0),
      totalVideos: storyboards.length,
    };

    // 保存 Asset 记录
    await prisma.asset.create({
      data: {
        type: 'export_manifest',
        filePath: JSON.stringify(manifest),
        url: null,
        projectId,
      },
    });

    // 如果请求下载，生成 ZIP
    if (download) {
      try {
        // Dynamic import for JSZip
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // 添加清单
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // 添加分镜信息 CSV
        const csvHeader = 'Scene Number,Title,Description,Dialogue,Emotion,Location,Camera Angle,Duration(s),Video URL,Image URLs\n';
        const csvRows = storyboards.map(sb => {
          const imgUrls = sb.imageUrls?.split(',').filter(Boolean).map(u => u.trim()).join('; ') || '';
          const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
          return [
            sb.sceneNum,
            escape(sb.title || ''),
            escape(sb.description || ''),
            escape(sb.dialogue || ''),
            escape(sb.emotion || ''),
            escape(sb.location || ''),
            escape(sb.cameraAngle || ''),
            sb.duration || 5,
            sb.videoUrl || '',
            escape(imgUrls),
          ].join(',');
        });
        zip.file('storyboards.csv', csvHeader + csvRows.join('\n'));

        // 添加说明文件
        const readme = [
          `# ${project?.title || '漫剧项目'} - 导出包`,
          '',
          `导出时间: ${new Date().toLocaleString('zh-CN')}`,
          `格式: ${format.toUpperCase()}`,
          `画质: ${quality}%`,
          `水印: ${watermark ? '是' : '否'}`,
          '',
          '## 文件说明',
          '- manifest.json — 完整导出清单',
          '- storyboards.csv — 分镜信息表',
          '- README.md — 本文件',
          '',
          '## 目标平台',
          ...platforms.map((p: any) => `- ${p.name} (${p.ratio} · ${p.resolution})`),
          '',
          '## 分镜列表',
          ...storyboards.map(sb => `- [${sb.sceneNum}] ${sb.title || ''}: ${(sb.dialogue || '').slice(0, 50)}`),
        ].join('\n');
        zip.file('README.md', readme);

        // 如果有本地图片（data URL），尝试嵌入
        const imagePromises = storyboards.map(async (sb) => {
          if (!sb.imageUrls) return;
          const urls = sb.imageUrls.split(',').filter(Boolean);
          for (let i = 0; i < urls.length; i++) {
            const url = urls[i].trim();
            if (url.startsWith('data:')) {
              try {
                const [header, b64] = url.split(',', 2);
                const ext = header.includes('png') ? 'png' : 'jpg';
                zip.file(`images/scene${sb.sceneNum}_${i + 1}.${ext}`, b64, { base64: true });
              } catch { /* skip un-parsable data URLs */ }
            }
          }
        });
        await Promise.allSettled(imagePromises);

        // 生成 ZIP buffer
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

        const hash = createHash('sha256').update(zipBuffer).digest('hex').slice(0, 16);
        const filename = `comic-export-${project?.title?.slice(0, 20) || projectId}-${hash}.zip`
          .replace(/[<>:"/\\|?*]/g, '_');

        return new NextResponse(new Uint8Array(zipBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': String(zipBuffer.length),
          },
        });
      } catch (zipErr) {
        // JSZip 可能未安装，回退到纯 JSON 清单
        console.error('[export] ZIP generation failed:', zipErr);
        return NextResponse.json({
          success: true,
          manifest,
          message: `导出清单已生成，包含 ${storyboards.length} 个视频（ZIP 打包需要 jszip 依赖）`,
          note: 'install_javascript_library',
        });
      }
    }

    return NextResponse.json({
      success: true,
      manifest,
      message: `导出清单已生成，包含 ${storyboards.length} 个视频，总时长 ${manifest.totalDuration}s`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to export';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
