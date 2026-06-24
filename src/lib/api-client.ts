// Shared fetch wrapper for client components with proper error handling
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch {
      // Use status-only message
    }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export async function apiGet<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

export async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' });
}

export async function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T = unknown>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
