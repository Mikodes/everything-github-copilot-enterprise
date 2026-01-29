import { FastifyRequest, FastifyReply } from 'fastify';
import { getAuthService } from '../services/auth.service.js';
import { Permission, User } from '../models/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('auth-middleware');

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    organizationId?: string;
    permissions?: Permission[];
  }
}

export interface AuthOptions {
  required?: boolean;
  permissions?: Permission[];
  anyPermission?: Permission[];
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify JWT token using Fastify's built-in JWT support
    const decoded = await request.jwtVerify<{
      userId: string;
      email: string;
      organizationId?: string;
    }>();

    // Get user from database
    const authService = getAuthService();
    const user = await authService.getUserById(decoded.userId);

    if (!user) {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
      return;
    }

    request.user = user;
    request.organizationId = decoded.organizationId;

    // Load permissions if organization is specified
    if (decoded.organizationId) {
      request.permissions = await authService.getUserPermissions(
        user.id,
        decoded.organizationId
      );
    }

    logger.debug({ userId: user.id, organizationId: decoded.organizationId }, 'User authenticated');
  } catch (error) {
    logger.warn({ error }, 'Authentication failed');
    reply.code(401).send({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Authorization middleware - checks user permissions
 */
export function authorize(options: AuthOptions = {}) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // If authentication is required but user is not set
    if (options.required !== false && !request.user) {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // If no specific permissions required, allow access
    if (!options.permissions && !options.anyPermission) {
      return;
    }

    // Check if organization context is required
    if (!request.organizationId) {
      reply.code(403).send({
        code: 'FORBIDDEN',
        message: 'Organization context required',
      });
      return;
    }

    const permissions = request.permissions ?? [];

    // Admin bypass - has all permissions
    if (permissions.includes('*')) {
      return;
    }

    // Check specific permissions
    if (options.permissions) {
      const hasAll = options.permissions.every((p) => permissions.includes(p));
      if (!hasAll) {
        logger.warn({
          userId: request.user?.id,
          required: options.permissions,
          actual: permissions,
        }, 'Permission denied');

        reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: { required: options.permissions },
        });
        return;
      }
    }

    // Check any permission
    if (options.anyPermission) {
      const hasAny = options.anyPermission.some((p) => permissions.includes(p));
      if (!hasAny) {
        logger.warn({
          userId: request.user?.id,
          required: options.anyPermission,
          actual: permissions,
        }, 'Permission denied');

        reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: { requiredAny: options.anyPermission },
        });
        return;
      }
    }
  };
}

/**
 * Factory function to create permission-checking preHandler
 */
export function requirePermission(...permissions: Permission[]) {
  return authorize({ permissions });
}

/**
 * Factory function to create any-permission-checking preHandler
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return authorize({ anyPermission: permissions });
}

/**
 * Middleware to extract organization from route params or headers
 */
export async function extractOrganization(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Try to get organization from route params
  const params = request.params as Record<string, string>;
  const organizationId = params['organizationId'];

  if (organizationId) {
    request.organizationId = organizationId;
    return;
  }

  // Try to get from header
  const orgHeader = request.headers['x-organization-id'];
  if (orgHeader && typeof orgHeader === 'string') {
    request.organizationId = orgHeader;
    return;
  }

  // Try to get from query
  const query = request.query as Record<string, string>;
  if (query['organizationId']) {
    request.organizationId = query['organizationId'];
  }
}

/**
 * Audit logging middleware
 */
export function auditLog(action: string, entityType: string) {
  return async function (request: FastifyRequest): Promise<void> {
    const authService = getAuthService();

    await authService.logAudit({
      organizationId: request.organizationId,
      userId: request.user?.id,
      action,
      entityType,
      entityId: (request.params as Record<string, string>)['id'],
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: {
        method: request.method,
        url: request.url,
      },
    });
  };
}
