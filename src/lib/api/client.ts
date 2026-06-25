export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiClientError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  
  if (!response.ok) {
    let errorMessage = `请求失败 (${response.status})`;
    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // ignore
      }
    }
    throw new ApiClientError(errorMessage, response.status);
  }
  
  if (isJson) {
    return response.json();
  }
  
  return response as unknown as T;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildQueryString(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, query } = options;
  
  const url = `/api${endpoint}${buildQueryString(query)}`;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  
  return handleResponse<T>(response);
}

export const api = {
  get: <T = unknown>(endpoint: string, query?: Record<string, string | number | boolean | undefined>) =>
    apiClient<T>(endpoint, { method: 'GET', query }),
  
  post: <T = unknown>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'POST', body }),
  
  put: <T = unknown>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PUT', body }),
  
  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PATCH', body }),
  
  delete: <T = unknown>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'DELETE', body }),
};

export interface Project {
  id: string;
  title: string;
  description: string | null;
  genre: string;
  style: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  name: string;
  age: string | null;
  gender: string | null;
  personality: string | null;
  appearance: string | null;
  projectId: string;
  createdAt: string;
}

export interface Script {
  id: string;
  outline: string;
  content: string;
  status: string;
  projectId: string;
  createdAt: string;
  storyboards?: Storyboard[];
}

export interface Storyboard {
  id: string;
  sceneNum: number;
  title: string | null;
  description: string;
  cameraAngle: string;
  dialogue: string | null;
  imagePrompt: string | null;
  imageUrls: string | null;
  duration: number | null;
  scriptId: string;
  createdAt: string;
}

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: { title: string; description?: string; genre?: string; style?: string; outline?: string }) =>
    api.post<Project>('/projects', data),
  update: (id: string, data: Partial<Pick<Project, 'title' | 'description' | 'genre' | 'style' | 'status'>>) =>
    api.patch<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const charactersApi = {
  list: (projectId: string) => api.get<Character[]>('/characters', { projectId }),
  get: (id: string) => api.get<Character>(`/characters/${id}`),
  create: (data: { projectId: string; name: string; age?: string; gender?: string }) =>
    api.post<Character>('/characters', data),
  update: (id: string, data: Partial<Character>) => api.patch<Character>(`/characters/${id}`, data),
  delete: (id: string) => api.delete(`/characters/${id}`),
  batchDelete: (ids: string[]) => api.post<{ deletedCount: number }>('/characters/batch-delete', { ids }),
};

export const scriptsApi = {
  list: (projectId: string) => api.get<Script[]>('/scripts', { projectId }),
  get: (id: string) => api.get<Script>(`/scripts/${id}`),
  create: (data: { projectId: string; outline: string; stream?: boolean }) =>
    api.post<Script>(`/scripts${data.stream ? '?stream=true' : ''}`, data),
  delete: (id: string) => api.delete(`/scripts/${id}`),
};

export const storyboardsApi = {
  list: (scriptId: string) => api.get<Storyboard[]>('/storyboards', { scriptId }),
  get: (id: string) => api.get<Storyboard>(`/storyboards/${id}`),
  update: (id: string, data: Partial<Storyboard>) => api.patch<Storyboard>(`/storyboards/${id}`, data),
  delete: (id: string) => api.delete(`/storyboards/${id}`),
  batchDelete: (ids: string[]) => api.post<{ deletedCount: number }>('/storyboards/batch-delete', { ids }),
};
