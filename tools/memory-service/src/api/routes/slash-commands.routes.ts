/**
 * US-008: Slash Commands API Routes
 *
 * Provides endpoints for:
 * - Executing slash commands
 * - Getting command completions
 * - Listing available commands
 * - Getting command help
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getSlashCommandsService,
  CommandExecutionContext,
  SlashCommand,
  CommandCompletionSuggestion,
} from '../../services/slash-commands.service.js';
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

const ExecuteCommandRequestSchema = z.object({
  command: z.string().min(1).max(500),
  currentFile: z.string().optional(),
  moduleId: z.string().uuid().optional(),
  workspaceRoot: z.string().optional(),
});

const CompletionRequestSchema = z.object({
  partial: z.string().max(100),
});

const ArgumentCompletionRequestSchema = z.object({
  command: z.string().min(1).max(50),
  currentFile: z.string().optional(),
  moduleId: z.string().uuid().optional(),
});

// ============================================
// Response Types
// ============================================

const SlashCommandSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    aliases: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    usage: { type: 'string' },
    examples: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
  },
};

const CommandResultSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    command: { type: 'string' },
    data: { type: 'object' },
    executionTimeMs: { type: 'number' },
    cached: { type: 'boolean' },
  },
};

const CompletionSuggestionSchema = {
  type: 'object',
  properties: {
    command: { type: 'string' },
    description: { type: 'string' },
    insertText: { type: 'string' },
    category: { type: 'string' },
  },
};

// ============================================
// Routes
// ============================================

export async function slashCommandsRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', extractOrganization);

  /**
   * POST /projects/:projectId/commands/execute
   * Execute a slash command
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof ExecuteCommandRequestSchema>;
  }>(
    '/projects/:projectId/commands/execute',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Execute a slash command and return the result',
        tags: ['Slash Commands'],
        params: ProjectParamSchema,
        body: ExecuteCommandRequestSchema,
        response: {
          200: CommandResultSchema,
          400: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;
      const user = request.user as { id?: string } | undefined;
      const userId = user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required for command execution',
        });
      }

      const service = getSlashCommandsService();

      const context: CommandExecutionContext = {
        userId,
        projectId,
        currentFile: body.currentFile,
        moduleId: body.moduleId,
        workspaceRoot: body.workspaceRoot,
      };

      const result = await service.executeCommand(body.command, context);

      return reply.send(result);
    }
  );

  /**
   * POST /projects/:projectId/commands/completions
   * Get command completion suggestions
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof CompletionRequestSchema>;
  }>(
    '/projects/:projectId/commands/completions',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get auto-completion suggestions for slash commands',
        tags: ['Slash Commands'],
        params: ProjectParamSchema,
        body: CompletionRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: CompletionSuggestionSchema,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const service = getSlashCommandsService();
      const suggestions: CommandCompletionSuggestion[] = service.getCompletionSuggestions(body.partial);

      return reply.send({ suggestions });
    }
  );

  /**
   * POST /projects/:projectId/commands/argument-completions
   * Get argument completion suggestions for a specific command
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof ArgumentCompletionRequestSchema>;
  }>(
    '/projects/:projectId/commands/argument-completions',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get auto-completion suggestions for command arguments',
        tags: ['Slash Commands'],
        params: ProjectParamSchema,
        body: ArgumentCompletionRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;
      const user = request.user as { id?: string } | undefined;
      const userId = user?.id;

      if (!userId) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'User ID required for argument completions',
        });
      }

      const service = getSlashCommandsService();

      const context: CommandExecutionContext = {
        userId,
        projectId,
        currentFile: body.currentFile,
        moduleId: body.moduleId,
      };

      const suggestions = await service.getArgumentSuggestions(body.command, context);

      return reply.send({ suggestions });
    }
  );

  /**
   * GET /commands/available
   * Get list of all available slash commands
   */
  fastify.get(
    '/commands/available',
    {
      schema: {
        description: 'Get list of all available slash commands',
        tags: ['Slash Commands'],
        response: {
          200: {
            type: 'object',
            properties: {
              commands: {
                type: 'array',
                items: SlashCommandSchema,
              },
              stats: {
                type: 'object',
                properties: {
                  commandCount: { type: 'number' },
                  aliasCount: { type: 'number' },
                  categories: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const service = getSlashCommandsService();
      const commands: SlashCommand[] = service.getAvailableCommands();
      const stats = service.getStats();

      return reply.send({ commands, stats });
    }
  );

  /**
   * GET /commands/help/:commandName
   * Get detailed help for a specific command
   */
  fastify.get<{
    Params: { commandName: string };
  }>(
    '/commands/help/:commandName',
    {
      schema: {
        description: 'Get detailed help for a specific slash command',
        tags: ['Slash Commands'],
        params: z.object({
          commandName: z.string().min(1).max(50),
        }),
        response: {
          200: {
            type: 'object',
            properties: {
              command: SlashCommandSchema,
              found: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { commandName } = request.params;

      const service = getSlashCommandsService();
      const commands = service.getAvailableCommands();
      const command = commands.find(
        (c) => c.name === commandName || c.aliases.includes(commandName)
      );

      return reply.send({
        command: command || null,
        found: !!command,
      });
    }
  );

  /**
   * POST /projects/:projectId/commands/parse
   * Parse a command without executing it (for validation/preview)
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: { command: string };
  }>(
    '/projects/:projectId/commands/parse',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Parse a slash command without executing it',
        tags: ['Slash Commands'],
        params: ProjectParamSchema,
        body: z.object({
          command: z.string().min(1).max(500),
        }),
        response: {
          200: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              args: { type: 'array', items: { type: 'string' } },
              rawArgs: { type: 'string' },
              flags: { type: 'object' },
              isValid: { type: 'boolean' },
              error: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const service = getSlashCommandsService();
      const parsed = service.parseCommand(body.command);

      // Convert Map to object for JSON serialization
      const flags: Record<string, string | boolean> = {};
      parsed.flags.forEach((value, key) => {
        flags[key] = value;
      });

      return reply.send({
        command: parsed.command,
        args: parsed.args,
        rawArgs: parsed.rawArgs,
        flags,
        isValid: parsed.isValid,
        error: parsed.error || null,
      });
    }
  );
}
