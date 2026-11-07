import { appConfig } from '../../constants/config';
import type { ApiError } from '../../types/api';

export class HttpClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = appConfig.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = appConfig.requestTimeoutMs
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Request-Id': requestId,
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const responseData = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const error: ApiError = {
          code: responseData?.code || `HTTP_${response.status}`,
          message: responseData?.message || response.statusText || 'An error occurred during the request.',
          fieldErrors: responseData?.fieldErrors,
          requestId: response.headers.get('x-request-id') || requestId,
          status: response.status,
        };
        throw error;
      }

      return responseData as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if ((err as Error)?.name === 'AbortError') {
        const timeoutError: ApiError = {
          code: 'REQUEST_TIMEOUT',
          message: `The request timed out after ${timeoutMs / 1000} seconds. Please try again.`,
          requestId,
        };
        throw timeoutError;
      }

      // Check if it's already an ApiError
      if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
        throw err as ApiError;
      }

      // Fallback for network / offline errors
      const networkError: ApiError = {
        code: 'NETWORK_ERROR',
        message: (err as Error)?.message || 'Failed to connect to the BloodBridge server. Please check your network connection.',
        requestId,
      };
      throw networkError;
    }
  }

  public get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new HttpClient();
