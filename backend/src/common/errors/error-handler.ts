import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error.js';
import { config } from '../../config/env.js';

export function errorHandler(error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.id || 'unknown';

  if (error instanceof AppError || (error as any)?.isAppError || (error as any)?.name === 'AppError') {
    const appErr = error as AppError;
    return reply.status(appErr.statusCode).send({
      error: {
        code: appErr.code,
        message: appErr.message,
        statusCode: appErr.statusCode,
        requestId,
        details: appErr.details,
      },
    });
  }

  // Fastify validation errors (schema validation failure)
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        statusCode: 400,
        requestId,
        details: error.validation,
      },
    });
  }

  // Fastify rate limit error
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        statusCode: 429,
        requestId,
      },
    });
  }

  // Prisma Database Exceptions: Sanitize completely, never expose SQL or schema details
  if (error.name?.startsWith('PrismaClient')) {
    request.log.error({ err: error, requestId }, 'Database exception intercepted');
    return reply.status(500).send({
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
        statusCode: 500,
        requestId,
      },
    });
  }

  // Unhandled / Internal errors: sanitize completely in production
  request.log.error({ err: error, requestId }, 'Unhandled backend exception');

  const message = config.APP_ENV === 'production' 
    ? 'An unexpected internal server error occurred' 
    : error.message;

  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      statusCode: 500,
      requestId,
    },
  });
}
