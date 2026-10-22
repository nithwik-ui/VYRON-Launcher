import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  serverCredentialSchema,
  verifyServerCredentialSchema,
} from './auth.schemas.js';
import { verifyAccessToken, AccessTokenPayload } from '../../common/security/jwt.js';
import { AppError } from '../../common/errors/app-error.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

async function authenticateBearer(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token);
  request.user = payload;
}

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await AuthService.register(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(201).send(result);
  });

  fastify.post('/verify-email', async (request, reply) => {
    const input = verifyEmailSchema.parse(request.body);
    const result = await AuthService.verifyEmail(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/resend-otp', async (request, reply) => {
    const input = resendOtpSchema.parse(request.body);
    const result = await AuthService.resendOtp(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await AuthService.login(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/refresh', async (request, reply) => {
    const input = refreshSchema.parse(request.body);
    const result = await AuthService.refresh(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/logout', async (request, reply) => {
    const input = refreshSchema.parse(request.body);
    const result = await AuthService.logout(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/logout-all', { preHandler: authenticateBearer }, async (request, reply) => {
    const result = await AuthService.logoutAll(request.user!.sub, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/forgot-password', async (request, reply) => {
    const input = forgotPasswordSchema.parse(request.body);
    const result = await AuthService.forgotPassword(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/reset-password', async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    const result = await AuthService.resetPassword(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/change-password', { preHandler: authenticateBearer }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    const result = await AuthService.changePassword(
      request.user!.sub,
      input.currentPassword,
      input.newPassword,
      request.user!.sessionId,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id,
      }
    );
    return reply.status(200).send(result);
  });

  // VYRON-compatible multiplayer server credentials
  fastify.post('/server-credential', { preHandler: authenticateBearer }, async (request, reply) => {
    const input = serverCredentialSchema.parse(request.body);
    const result = await AuthService.generateServerCredential(request.user!.sub, input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.post('/verify-server-credential', async (request, reply) => {
    const input = verifyServerCredentialSchema.parse(request.body);
    const result = await AuthService.verifyServerCredential(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });
};

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/me', { preHandler: authenticateBearer }, async (request, reply) => {
    const user = await AuthService.getMe(request.user!.sub);
    return reply.status(200).send({ user });
  });

  fastify.get('/devices', { preHandler: authenticateBearer }, async (request, reply) => {
    const devices = await AuthService.getDevices(request.user!.sub);
    return reply.status(200).send({ devices });
  });

  fastify.delete('/devices/:deviceId', { preHandler: authenticateBearer }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const result = await AuthService.revokeDevice(request.user!.sub, deviceId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });

  fastify.get('/sessions', { preHandler: authenticateBearer }, async (request, reply) => {
    const sessions = await AuthService.getSessions(request.user!.sub, request.user!.sessionId);
    return reply.status(200).send({ sessions });
  });

  fastify.delete('/sessions/:sessionId', { preHandler: authenticateBearer }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const result = await AuthService.revokeSession(request.user!.sub, sessionId, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });
};
