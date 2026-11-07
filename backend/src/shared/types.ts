export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public fieldErrors?: Record<string, string>;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST', fieldErrors?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
