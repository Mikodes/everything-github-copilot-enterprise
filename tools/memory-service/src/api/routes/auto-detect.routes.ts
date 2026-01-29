/**
 * US-005: Auto Context Detection API Routes
 *
 * Provides endpoints for:
 * - Automatic context detection based on current file, git branch, etc.
 * - Navigation tracking for learning user patterns
 * - Override management for manual context selection
 * - User preference statistics
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getAutoContextDetectionService,
  DetectionRequest,
  NavigationEvent,
} from '../../services/auto-context-detection.service.js';
import {
  authenticate,
  authorize,
  extractOrganization,
} from '../../auth/middleware.js';

// ============================================
// Request/Response Schemas
// ============================================

const ProjectParamSchema = z.object({
  projectId: z.string().uuid(),
});

const DetectionRequestSchema = z.object({
  currentFile: z.string().optional(),
  gitBranch: z.string().optional(),
  gitModifiedFiles: z.array(z.string()).optional(),
  additionalContext: z.record(z.unknown()).optional(),
});

const NavigationEventSchema = z.object({
  filePath: z.string().min(1),
  moduleId: z.string().uuid().optional(),
  duration: z.number().int().min(0).default(0),
});

const OverrideRequestSchema = z.object({
  contextIds: z.array(z.string().uuid()).min(1).max(10),
  durationMs: z.number().int().positive().optional(),
});

const FileAnalysisRequestSchema = z.object({
  filePath: z.string().min(1),
});

const PreferenceUpdateSchema = z.object({
  contextId: z.string().uuid(),
  accessWeight: z.number().min(0).max(10).default(1),
});

const FileAssociationSchema = z.object({
  fileExtension: z.string().min(1).max(20),
  contextId: z.string().uuid(),
});

// ============================================
// Routes
// ============================================

export async function autoDetectRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', extractOrganization);

  /**
   * POST /projects/:projectId/context/detect
   * Detect relevant context automatically based on current state
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof DetectionRequestSchema>;
  }>(
    '/projects/:projectId/context/detect',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Automatically detect relevant context based on current file, git branch, user preferences, and navigation history',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        body: DetectionRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              suggestedContexts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    contextId: { type: 'string' },
                    entry: { type: 'object' },
                    confidence: { type: 'number' },
                    reason: { type: 'string' },
                    source: { type: 'string' },
                  },
                },
              },
              primaryContext: { type: ['object', 'null'] },
              alternativeContexts: { type: 'array' },
              metadata: {
                type: 'object',
                properties: {
                  detectionTimeMs: { type: 'number' },
                  sourcesUsed: { type: 'array', items: { type: 'string' } },
                  overrideActive: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required for context detection',
        });
      }

      const service = getAutoContextDetectionService();
      const detectionRequest: DetectionRequest = {
        userId,
        projectId,
        currentFile: body.currentFile,
        gitBranch: body.gitBranch,
        gitModifiedFiles: body.gitModifiedFiles,
        additionalContext: body.additionalContext,
      };

      const response = await service.detectContext(detectionRequest);

      return reply.send(response);
    }
  );

  /**
   * POST /projects/:projectId/context/detect/navigation
   * Record a navigation event for learning patterns
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof NavigationEventSchema>;
  }>(
    '/projects/:projectId/context/detect/navigation',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Record a navigation event (file opened) for pattern learning',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        body: NavigationEventSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              recorded: { type: 'boolean' },
              timestamp: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      const timestamp = Date.now();

      const event: NavigationEvent = {
        userId,
        projectId,
        filePath: body.filePath,
        moduleId: body.moduleId,
        timestamp,
        duration: body.duration,
      };

      service.recordNavigation(event);

      return reply.send({
        recorded: true,
        timestamp,
      });
    }
  );

  /**
   * GET /projects/:projectId/context/detect/navigation
   * Get navigation history for the current user
   */
  fastify.get<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/context/detect/navigation',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get navigation history for the current user in this project',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              history: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    filePath: { type: 'string' },
                    moduleId: { type: ['string', 'null'] },
                    timestamp: { type: 'number' },
                    duration: { type: 'number' },
                  },
                },
              },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      const history = service.getNavigationHistory(userId, projectId);

      return reply.send({
        history: history.map(e => ({
          filePath: e.filePath,
          moduleId: e.moduleId ?? null,
          timestamp: e.timestamp,
          duration: e.duration,
        })),
        count: history.length,
      });
    }
  );

  /**
   * POST /projects/:projectId/context/detect/override
   * Set a manual override for context detection
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof OverrideRequestSchema>;
  }>(
    '/projects/:projectId/context/detect/override',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Set a manual override to use specific contexts instead of auto-detection',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        body: OverrideRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              contextIds: { type: 'array', items: { type: 'string' } },
              expiresAt: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { contextIds, durationMs } = request.body;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      service.setOverride(userId, projectId, contextIds, durationMs);

      return reply.send({
        success: true,
        contextIds,
        expiresAt: durationMs ? Date.now() + durationMs : null,
      });
    }
  );

  /**
   * GET /projects/:projectId/context/detect/override
   * Get current override status
   */
  fastify.get<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/context/detect/override',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get current manual override status',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              active: { type: 'boolean' },
              contextIds: { type: ['array', 'null'], items: { type: 'string' } },
              expiresAt: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      const override = service.getActiveOverride(userId, projectId);

      if (!override) {
        return reply.send({
          active: false,
          contextIds: null,
          expiresAt: null,
        });
      }

      return reply.send({
        active: true,
        contextIds: override.contextIds,
        expiresAt: override.expiresAt,
      });
    }
  );

  /**
   * DELETE /projects/:projectId/context/detect/override
   * Clear manual override
   */
  fastify.delete<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/context/detect/override',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Clear the manual override and return to auto-detection',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              cleared: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      service.clearOverride(userId, projectId);

      return reply.send({ cleared: true });
    }
  );

  /**
   * GET /projects/:projectId/context/detect/preferences
   * Get user preference statistics
   */
  fastify.get<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/context/detect/preferences',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get learned user preference statistics for context detection',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              topTypes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    weight: { type: 'number' },
                  },
                },
              },
              topModules: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    moduleId: { type: 'string' },
                    weight: { type: 'number' },
                  },
                },
              },
              topTags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tag: { type: 'string' },
                    weight: { type: 'number' },
                  },
                },
              },
              lastUpdated: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      const stats = service.getUserPreferenceStats(userId, projectId);

      return reply.send(stats);
    }
  );

  /**
   * POST /projects/:projectId/context/detect/preferences
   * Update user preferences (record context access)
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof PreferenceUpdateSchema>;
  }>(
    '/projects/:projectId/context/detect/preferences',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Record a context access to update user preferences',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        body: PreferenceUpdateSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              updated: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { contextId, accessWeight } = request.body;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      // We need to get the context entry to update preferences
      const { getContextService } = await import('../../services/context.service.js');
      const contextService = getContextService();
      const entry = await contextService.getById(contextId, userId);

      if (!entry) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: `Context entry not found: ${contextId}`,
        });
      }

      const service = getAutoContextDetectionService();
      service.updateUserPreference(userId, projectId, entry, accessWeight);

      return reply.send({ updated: true });
    }
  );

  /**
   * POST /projects/:projectId/context/detect/preferences/file-association
   * Record a file-to-context association for learning
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof FileAssociationSchema>;
  }>(
    '/projects/:projectId/context/detect/preferences/file-association',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Record a file extension to context association for preference learning',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        body: FileAssociationSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              recorded: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { fileExtension, contextId } = request.body;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      service.recordFileContextAssociation(userId, projectId, fileExtension, contextId);

      return reply.send({ recorded: true });
    }
  );

  /**
   * POST /context/detect/analyze-file
   * Analyze a file path and return hints (utility endpoint)
   */
  fastify.post<{
    Body: z.infer<typeof FileAnalysisRequestSchema>;
  }>(
    '/context/detect/analyze-file',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Analyze a file path to extract language, patterns, and module hints',
        tags: ['Context', 'Auto-Detection'],
        body: FileAnalysisRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              fileName: { type: 'string' },
              extension: { type: 'string' },
              language: { type: 'string' },
              directory: { type: 'string' },
              patterns: { type: 'array', items: { type: 'string' } },
              moduleHints: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { filePath } = request.body;

      const service = getAutoContextDetectionService();
      const analysis = service.analyzeFile(filePath);

      return reply.send(analysis);
    }
  );

  /**
   * GET /context/detect/stats
   * Get auto-detection service statistics
   */
  fastify.get(
    '/context/detect/stats',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get auto-context detection service statistics',
        tags: ['Context', 'Auto-Detection'],
        response: {
          200: {
            type: 'object',
            properties: {
              isEnabled: { type: 'boolean' },
              config: { type: 'object' },
              activeSessionsCount: { type: 'number' },
              activeOverridesCount: { type: 'number' },
              userPreferencesCount: { type: 'number' },
              navigationHistorySize: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const service = getAutoContextDetectionService();
      const stats = service.getStats();

      return reply.send(stats);
    }
  );

  /**
   * DELETE /projects/:projectId/context/detect/session
   * Clear all session data for the current user
   */
  fastify.delete<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/context/detect/session',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Clear all session data (navigation history, overrides) for the current user',
        tags: ['Context', 'Auto-Detection'],
        params: ProjectParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              cleared: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        });
      }

      const service = getAutoContextDetectionService();
      service.clearUserSession(userId);

      return reply.send({ cleared: true });
    }
  );
}
