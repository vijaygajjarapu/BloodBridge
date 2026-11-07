export type AppMode = 'demo' | 'api';

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
  status?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
