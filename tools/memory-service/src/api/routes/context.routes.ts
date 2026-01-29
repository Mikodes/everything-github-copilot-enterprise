import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getContextService } from '../../services/context.service.js';
import {
  authenticate,
  authorize,
  requirePermission,
  extractOrganization,
  auditLog,
} from '../../auth/middleware.js';
import {
  CreateContextEntrySchema,
  UpdateContextEntrySchema,
  SearchQuerySchema,
  ContextEntryTypeSchema,
} from '../../models/index.js';

// Query schemas
const ListQuerySchema = z.object({
  type: ContextEntryTypeSchema.optional(),
  moduleId: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'deprecated', 'superseded']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const ProjectParamSchema = z.object({
  projectId: z.string().uuid(),
});

export async function contextRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', extractOrganization);

  /**
   * GET /projects/:projectId/context
   * List context entries for a project
   */
  fastify.get<{
    Params: z.infer<typeof ProjectParamSchema>;
    Querystring: z.infer<typeof ListQuerySchema>;
  }>(
    '/projects/:projectId/context',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'List context entries for a project',
        tags: ['Context'],
        params: ProjectParamSchema,
        querystring: ListQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array' },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const query = request.query;

      const contextService = getContextService();
      const { entries, total } = await contextService.getByProject(projectId, {
        type: query.type,
        moduleId: query.moduleId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });

      return reply.send({
        items: entries,
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + entries.length < total,
      });
    }
  );

  /**
   * GET /context/:id
   * Get a specific context entry
   */
  fastify.get<{
    Params: z.infer<typeof IdParamSchema>;
  }>(
    '/context/:id',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get a specific context entry',
        tags: ['Context'],
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const contextService = getContextService();
      const entry = await contextService.getById(id);

      if (!entry) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: `Context entry not found: ${id}`,
        });
      }

      return reply.send(entry);
    }
  );

  /**
   * POST /projects/:projectId/context
   * Create a new context entry
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof CreateContextEntrySchema>;
  }>(
    '/projects/:projectId/context',
    {
      preHandler: [
        authorize({ permissions: ['context:write'] }),
        auditLog('create', 'context_entry'),
      ],
      schema: {
        description: 'Create a new context entry',
        tags: ['Context'],
        params: ProjectParamSchema,
        body: CreateContextEntrySchema,
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const contextService = getContextService();
      const entry = await contextService.create({
        ...body,
        projectId,
        createdBy: request.user?.id ?? null,
        updatedBy: request.user?.id ?? null,
      });

      return reply.code(201).send(entry);
    }
  );

  /**
   * PUT /context/:id
   * Update a context entry
   */
  fastify.put<{
    Params: z.infer<typeof IdParamSchema>;
    Body: Omit<z.infer<typeof UpdateContextEntrySchema>, 'id'>;
  }>(
    '/context/:id',
    {
      preHandler: [
        authorize({ permissions: ['context:write'] }),
        auditLog('update', 'context_entry'),
      ],
      schema: {
        description: 'Update a context entry',
        tags: ['Context'],
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const contextService = getContextService();
      const existing = await contextService.getById(id);

      if (!existing) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: `Context entry not found: ${id}`,
        });
      }

      const entry = await contextService.update({
        ...body,
        id,
        updatedBy: request.user?.id ?? null,
      });

      return reply.send(entry);
    }
  );

  /**
   * DELETE /context/:id
   * Delete a context entry
   */
  fastify.delete<{
    Params: z.infer<typeof IdParamSchema>;
  }>(
    '/context/:id',
    {
      preHandler: [
        authorize({ permissions: ['context:delete'] }),
        auditLog('delete', 'context_entry'),
      ],
      schema: {
        description: 'Delete a context entry',
        tags: ['Context'],
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const contextService = getContextService();
      const existing = await contextService.getById(id);

      if (!existing) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: `Context entry not found: ${id}`,
        });
      }

      await contextService.delete(id, request.user?.id);

      return reply.code(204).send();
    }
  );

  /**
   * POST /projects/:projectId/context/search
   * Search context entries
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: Omit<z.infer<typeof SearchQuerySchema>, 'projectId'>;
  }>(
    '/projects/:projectId/context/search',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Search context entries using semantic or text search',
        tags: ['Context', 'Search'],
        params: ProjectParamSchema,
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const contextService = getContextService();
      const results = await contextService.search({
        ...body,
        projectId,
      });

      return reply.send({
        results,
        query: body.query,
        semantic: body.semantic ?? true,
      });
    }
  );
}
