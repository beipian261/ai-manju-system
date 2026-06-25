import { logger } from '@/lib/utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  character_ref?: string;
  negative_prompt?: string;
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  images: string[];
  seconds?: string;
  size?: string;
}

export interface VideoGenerationResponse {
  id: string;
  task_id: string;
  video_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  model: string;
  seconds?: string;
  size?: string;
  created_at?: number;
  completed_at?: number | null;
  error?: string | null;
  remixed_from_video_id?: string;
}

import { getSetting } from '@/lib/config/settings';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';
import { isAllowedApiBase } from '@/lib/utils/url-guard';

// 校验 API base URL（异步 DNS 解析 + 私有 IP 检测）
// 确保是 https 协议 + 非私有 IP + 非本地 + 域名白名单
async function validateApiBase(raw: string): Promise<string> {
  if (!raw || typeof raw !== 'string') {
    throw new Error('AGNES_API_BASE 未配置，请前往 /settings 页面配置');
  }
  const base = raw.trim().replace(/\/$/, '');
  const result = await isAllowedApiBase(base);
  if (!result.ok) {
    throw new Error(`AGNES_API_BASE 校验失败 (${result.reason})：${base}`);
  }
  return base;
}

function validateApiKey(raw: string): string {
  if (!raw || typeof raw !== 'string' || raw.length < 3) {
    throw new Error('AGNES_API_KEY 未配置或无效，请前往 /settings 页面配置');
  }
  return raw.trim();
}

// 共享错误解析：从 Response 中提取可读的错误消息
async function parseApiError(res: Response, label = 'agnes request'): Promise<string> {
  let errMsg = `Agnes API 返回 ${res.status}`;
  let errBody = '';
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const jsonErr = await res.json();
      errBody = JSON.stringify(jsonErr).slice(0, 500);
      if (jsonErr && typeof jsonErr === 'object') {
        const extracted =
          jsonErr.error?.message || jsonErr.message || jsonErr.error || errBody;
        errMsg = `${res.status}: ${String(extracted).slice(0, 500)}`;
      }
    } else {
      errBody = (await res.text()).slice(0, 500);
      errMsg = `${res.status}: ${errBody}`;
    }
  } catch {
    errMsg = `Agnes API 返回 ${res.status}`;
  }
  logger.error(`[${label} error] ${res.status}`, errBody || errMsg);
  return errMsg;
}

async function request<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs = 90_000,
  maxRetries = 2
): Promise<T> {
  const API_BASE = await validateApiBase(await getSetting('AGNES_API_BASE'));
  const API_KEY = validateApiKey(await getSetting('AGNES_API_KEY'));

  const res = await fetchWithRetry(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    timeoutMs,
    maxRetries,
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  return res.json() as Promise<T>;
}

/**
 * 共享的 GET 请求（与 request() 共享鉴权/校验/错误处理链路）
 * 避免 getVideoTask 等 GET 端点重复实现 fetch + 错误处理。
 */
async function requestGet<T>(
  endpoint: string,
  timeoutMs = 30_000,
  maxRetries = 1
): Promise<T> {
  const API_BASE = await validateApiBase(await getSetting('AGNES_API_BASE'));
  const API_KEY = validateApiKey(await getSetting('AGNES_API_KEY'));

  const res = await fetchWithRetry(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${API_KEY}` },
    timeoutMs,
    maxRetries,
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res, 'agnes get'));
  }

  return res.json() as Promise<T>;
}

export async function chatCompletion(params: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  // 将特定请求类型转为 Record<string, unknown> 以适配通用 request() 函数签名
  return request<ChatCompletionResponse>(
    '/chat/completions',
    params as unknown as Record<string, unknown>,
    90_000,
    2
  );
}

export async function generateImage(params: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  // 将特定请求类型转为 Record<string, unknown> 以适配通用 request() 函数签名
  return request<ImageGenerationResponse>(
    '/images/generations',
    params as unknown as Record<string, unknown>,
    120_000,
    2
  );
}

export async function generateVideo(params: VideoGenerationRequest): Promise<VideoGenerationResponse> {
  // 将特定请求类型转为 Record<string, unknown> 以适配通用 request() 函数签名
  return request<VideoGenerationResponse>(
    '/video/generations',
    params as unknown as Record<string, unknown>,
    180_000,
    1
  );
}

export async function getVideoTask(taskId: string): Promise<VideoGenerationResponse> {
  return requestGet<VideoGenerationResponse>(`/videos/${taskId}`);
}

// ============================================================
// 流式文本生成（用于剧本/分镜内容快速预览）
// 返回 ReadableStream，可直接传给 Next.js StreamingResponse
// ============================================================
export async function chatCompletionStream(
  params: ChatCompletionRequest,
  onChunk?: (text: string, done: boolean) => void | Promise<void>
): Promise<string> {
  const API_BASE = await validateApiBase(await getSetting('AGNES_API_BASE'));
  const API_KEY = validateApiKey(await getSetting('AGNES_API_KEY'));

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ ...params, stream: true }),
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res, 'agnes stream'));
  }

  if (!res.body) {
    throw new Error('Response body is not readable (proxy/gateway may not support streaming)');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 逐行解析 SSE NDJSON 格式（OpenAI 兼容格式）
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整行

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          if (onChunk) {
            const result = onChunk('', true);
            if (result instanceof Promise) await result;
          }
          return fullContent;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            if (onChunk) {
              const result = onChunk(delta, false);
              if (result instanceof Promise) await result;
            }
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}
