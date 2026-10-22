export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isAppError = true;

  constructor(arg1: string | number, arg2?: string, arg3?: number | string, details?: unknown) {
    if (typeof arg1 === 'number') {
      // (statusCode: number, code: string, message: string, details?: unknown)
      const statusCode = arg1;
      const code = arg2 || 'INTERNAL_ERROR';
      const message = typeof arg3 === 'string' ? arg3 : 'An error occurred';
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
    } else {
      // (message: string, code = 'INTERNAL_ERROR', statusCode = 500, details?: unknown)
      const message = arg1;
      const code = arg2 || 'INTERNAL_ERROR';
      const statusCode = typeof arg3 === 'number' ? arg3 : 500;
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(message, code, 400, details);
  }

  static unauthorized(message = 'Unauthorized access', code = 'UNAUTHORIZED'): AppError {
    return new AppError(message, code, 401);
  }

  static forbidden(message = 'Forbidden access', code = 'FORBIDDEN'): AppError {
    return new AppError(message, code, 403);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): AppError {
    return new AppError(message, code, 404);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(message, code, 409);
  }

  static tooManyRequests(message = 'Rate limit exceeded', code = 'RATE_LIMIT_EXCEEDED'): AppError {
    return new AppError(message, code, 429);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, code, 500);
  }
}
