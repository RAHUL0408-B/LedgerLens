import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Never expose stack traces or internal details in production
  const response: Record<string, unknown> = {
    error: {
      message: err.message || 'An unexpected error occurred',
      code: err.code || 'INTERNAL_ERROR',
      ...(err.details ? { details: err.details } : {}),
    },
  };

  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function createError(
  message: string,
  statusCode: number,
  code?: string,
  details?: unknown
): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}
