import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  status: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function successResponse<T>(data: T, message?: string, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function createdResponse<T>(data: T, message?: string): NextResponse<T> {
  return successResponse(data, message, 201);
}

export function errorResponse(error: string, status = 400): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false as const, error, status },
    { status }
  );
}

export function notFoundResponse(message = '资源不存在'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 404);
}

export function unauthorizedResponse(message = '未授权'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 401);
}

export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error('[API Error]', error);
  
  if (error instanceof Error) {
    const status = (error as { status?: number }).status;
    if (typeof status === 'number') {
      return errorResponse(error.message, status);
    }
    if (error.message.includes('not found') || error.message.includes('不存在')) {
      return notFoundResponse(error.message);
    }
  }
  
  return errorResponse('服务器内部错误', 500);
}

export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('请求体格式错误', 400);
  }
}

export { ApiError };
