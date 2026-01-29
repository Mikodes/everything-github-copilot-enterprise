/**
 * US-006: Knowledge Graph API Routes
 *
 * Provides endpoints for:
 * - Entity extraction from content (AC-006.1, AC-006.2)
 * - Graph queries and traversal (AC-006.3)
 * - Graph export to GraphML, JSON, DOT, Mermaid (AC-006.4)
 * - Impact analysis
 * - Graph statistics
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getKnowledgeGraphService,
} from '../../services/knowledge-graph.service.js';
import {
  GraphEntityTypeSchema,
  GraphRelationTypeSchema,
  EntityExtractionRequestSchema,
  GraphTraversalRequestSchema,
  GraphQuerySchema,
  ImpactAnalysisRequestSchema,
  GraphExportRequestSchema,
  CreateGraphNodeSchema,
  CreateGraphEdgeSchema,
} from '../../models/knowledge-graph.js';
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

const NodeParamSchema = z.object({
  projectId: z.string().uuid(),
  nodeId: z.string().uuid(),
});

const EdgeParamSchema = z.object({
  projectId: z.string().uuid(),
  edgeId: z.string().uuid(),
});

const ExtractRequestBodySchema = z.object({
  content: z.string().min(1),
  contentType: z.enum(['markdown', 'code', 'json', 'yaml']).default('markdown'),
  sourceFile: z.string().optional(),
  contextEntryId: z.string().uuid().optional(),
  extractRelations: z.boolean().default(true),
});

const QueryRequestBodySchema = z.object({
  entityTypes: z.array(GraphEntityTypeSchema).optional(),
  relationTypes: z.array(GraphRelationTypeSchema).optional(),
  tags: z.array(z.string()).optional(),
  searchText: z.string().optional(),
  minWeight: z.number().min(0).max(1).default(0),
  includeOrphans: z.boolean().default(false),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const TraversalRequestBodySchema = z.object({
  startNodeId: z.string().uuid(),
  maxDepth: z.number().int().min(1).max(10).default(3),
  relationTypes: z.array(GraphRelationTypeSchema).optional(),
  entityTypes: z.array(GraphEntityTypeSchema).optional(),
  direction: z.enum(['outgoing', 'incoming', 'both']).default('both'),
  minWeight: z.number().min(0).max(1).default(0),
  minConfidence: z.number().min(0).max(1).default(0),
  limit: z.number().int().min(1).max(500).default(100),
});

const ImpactRequestBodySchema = z.object({
  nodeId: z.string().uuid(),
  changeType: z.enum(['modify', 'delete', 'deprecate']).default('modify'),
  maxDepth: z.number().int().min(1).max(10).default(5),
  includeIndirect: z.boolean().default(true),
});

const ExportRequestBodySchema = z.object({
  format: z.enum(['graphml', 'json', 'dot', 'mermaid']).default('json'),
  options: z.object({
    format: z.enum(['standard', 'd3', 'cytoscape', 'vis']).optional(),
    includeProperties: z.boolean().optional(),
    includeWeights: z.boolean().optional(),
    prettyPrint: z.boolean().optional(),
    includeMetadata: z.boolean().optional(),
  }).optional(),
  query: QueryRequestBodySchema.optional(),
});

const CreateNodeRequestBodySchema = z.object({
  entityType: GraphEntityTypeSchema,
  entityId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  properties: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  weight: z.number().min(0).max(1).default(1),
  sourceFile: z.string().nullable().optional(),
  sourceLineStart: z.number().nullable().optional(),
  sourceLineEnd: z.number().nullable().optional(),
});

const CreateEdgeRequestBodySchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  relationType: GraphRelationTypeSchema,
  weight: z.number().min(0).max(1).default(1),
  confidence: z.number().min(0).max(1).default(1),
  bidirectional: z.boolean().default(false),
  properties: z.record(z.unknown()).default({}),
  detectedBy: z.enum(['manual', 'content_analysis', 'code_analysis', 'import_analysis', 'reference_analysis']).default('manual'),
});

const FindNodeRequestSchema = z.object({
  name: z.string().min(1),
  entityType: GraphEntityTypeSchema.optional(),
});

// ============================================
// Routes
// ============================================

export async function knowledgeGraphRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', extractOrganization);

  // ============================================
  // Entity Extraction
  // ============================================

  /**
   * POST /projects/:projectId/knowledge-graph/extract
   * Extract entities and relationships from content
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof ExtractRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/extract',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Extract entities and relationships from content using NLP patterns',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: ExtractRequestBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              entities: { type: 'array' },
              relations: { type: 'array' },
              processingTimeMs: { type: 'number' },
              contentHash: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const service = getKnowledgeGraphService();
      const result = await service.processContent({
        projectId,
        content: body.content,
        contentType: body.contentType,
        sourceFile: body.sourceFile,
        contextEntryId: body.contextEntryId,
        extractRelations: body.extractRelations,
      });

      return reply.send(result);
    }
  );

  // ============================================
  // Graph Queries
  // ============================================

  /**
   * POST /projects/:projectId/knowledge-graph/query
   * Query the knowledge graph with filters
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof QueryRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/query',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Query the knowledge graph with filters for entity types, relations, tags, etc.',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: QueryRequestBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              nodes: { type: 'array' },
              edges: { type: 'array' },
              metadata: {
                type: 'object',
                properties: {
                  totalNodes: { type: 'number' },
                  totalEdges: { type: 'number' },
                  queryTimeMs: { type: 'number' },
                  truncated: { type: 'boolean' },
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

      const service = getKnowledgeGraphService();
      const result = service.queryGraph({
        projectId,
        ...body,
      });

      return reply.send(result);
    }
  );

  /**
   * POST /projects/:projectId/knowledge-graph/traverse
   * Traverse the graph from a starting node
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof TraversalRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/traverse',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Traverse the knowledge graph from a starting node with depth and direction controls',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: TraversalRequestBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              nodes: { type: 'array' },
              edges: { type: 'array' },
              metadata: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const service = getKnowledgeGraphService();
      const result = service.traverseGraph(projectId, body);

      return reply.send(result);
    }
  );

  /**
   * GET /projects/:projectId/knowledge-graph/find
   * Find a node by name and optionally type
   */
  fastify.get<{
    Params: z.infer<typeof ProjectParamSchema>;
    Querystring: z.infer<typeof FindNodeRequestSchema>;
  }>(
    '/projects/:projectId/knowledge-graph/find',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Find a node by name and optionally entity type',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        querystring: FindNodeRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              found: { type: 'boolean' },
              node: { type: ['object', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { name, entityType } = request.query;

      const service = getKnowledgeGraphService();
      const node = service.findNodeByName(projectId, name, entityType);

      return reply.send({
        found: !!node,
        node: node || null,
      });
    }
  );

  // ============================================
  // Node CRUD
  // ============================================

  /**
   * GET /projects/:projectId/knowledge-graph/nodes/:nodeId
   * Get a specific node
   */
  fastify.get<{
    Params: z.infer<typeof NodeParamSchema>;
  }>(
    '/projects/:projectId/knowledge-graph/nodes/:nodeId',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get a specific node from the knowledge graph',
        tags: ['Knowledge Graph'],
        params: NodeParamSchema,
        response: {
          200: { type: 'object' },
          404: {
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
      const { projectId, nodeId } = request.params;

      const service = getKnowledgeGraphService();
      const node = service.getNode(projectId, nodeId);

      if (!node) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: `Node not found: ${nodeId}`,
        });
      }

      return reply.send(node);
    }
  );

  /**
   * POST /projects/:projectId/knowledge-graph/nodes
   * Create a new node
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof CreateNodeRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/nodes',
    {
      preHandler: [authorize({ permissions: ['context:write'] })],
      schema: {
        description: 'Create a new node in the knowledge graph',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: CreateNodeRequestBodySchema,
        response: {
          201: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const service = getKnowledgeGraphService();
      const node = await service.addNode({
        projectId,
        entityType: body.entityType,
        entityId: body.entityId ?? null,
        name: body.name,
        description: body.description ?? null,
        properties: body.properties,
        tags: body.tags,
        weight: body.weight,
        sourceFile: body.sourceFile ?? null,
        sourceLineStart: body.sourceLineStart ?? null,
        sourceLineEnd: body.sourceLineEnd ?? null,
      });

      return reply.code(201).send(node);
    }
  );

  /**
   * DELETE /projects/:projectId/knowledge-graph/nodes/:nodeId
   * Delete a node and its connected edges
   */
  fastify.delete<{
    Params: z.infer<typeof NodeParamSchema>;
  }>(
    '/projects/:projectId/knowledge-graph/nodes/:nodeId',
    {
      preHandler: [authorize({ permissions: ['context:delete'] })],
      schema: {
        description: 'Delete a node and its connected edges from the knowledge graph',
        tags: ['Knowledge Graph'],
        params: NodeParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              deleted: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId, nodeId } = request.params;

      const service = getKnowledgeGraphService();
      const deleted = await service.deleteNode(projectId, nodeId);

      return reply.send({ deleted });
    }
  );

  // ============================================
  // Edge CRUD
  // ============================================

  /**
   * GET /projects/:projectId/knowledge-graph/edges/:edgeId
   * Get a specific edge
   */
  fastify.get<{
    Params: z.infer<typeof EdgeParamSchema>;
  }>(
    '/projects/:projectId/knowledge-graph/edges/:edgeId',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get a specific edge from the knowledge graph',
        tags: ['Knowledge Graph'],
        params: EdgeParamSchema,
        response: {
          200: { type: 'object' },
          404: {
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
      const { projectId, edgeId } = request.params;

      const service = getKnowledgeGraphService();
      const edge = service.getEdge(projectId, edgeId);

      if (!edge) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: `Edge not found: ${edgeId}`,
        });
      }

      return reply.send(edge);
    }
  );

  /**
   * POST /projects/:projectId/knowledge-graph/edges
   * Create a new edge
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof CreateEdgeRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/edges',
    {
      preHandler: [authorize({ permissions: ['context:write'] })],
      schema: {
        description: 'Create a new edge in the knowledge graph',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: CreateEdgeRequestBodySchema,
        response: {
          201: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const service = getKnowledgeGraphService();
      const edge = await service.addEdge({
        projectId,
        ...body,
      });

      return reply.code(201).send(edge);
    }
  );

  /**
   * DELETE /projects/:projectId/knowledge-graph/edges/:edgeId
   * Delete an edge
   */
  fastify.delete<{
    Params: z.infer<typeof EdgeParamSchema>;
  }>(
    '/projects/:projectId/knowledge-graph/edges/:edgeId',
    {
      preHandler: [authorize({ permissions: ['context:delete'] })],
      schema: {
        description: 'Delete an edge from the knowledge graph',
        tags: ['Knowledge Graph'],
        params: EdgeParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              deleted: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId, edgeId } = request.params;

      const service = getKnowledgeGraphService();
      const deleted = await service.deleteEdge(projectId, edgeId);

      return reply.send({ deleted });
    }
  );

  // ============================================
  // Impact Analysis
  // ============================================

  /**
   * POST /projects/:projectId/knowledge-graph/impact
   * Analyze impact of changes to a node
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof ImpactRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/impact',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Analyze the impact of changes to a node in the knowledge graph',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: ImpactRequestBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              sourceNode: { type: 'object' },
              impactedNodes: { type: 'array' },
              totalDirectImpact: { type: 'number' },
              totalIndirectImpact: { type: 'number' },
              analysisTimeMs: { type: 'number' },
              recommendations: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const service = getKnowledgeGraphService();
      const result = service.analyzeImpact(projectId, body);

      return reply.send(result);
    }
  );

  // ============================================
  // Export
  // ============================================

  /**
   * POST /projects/:projectId/knowledge-graph/export
   * Export the knowledge graph to various formats
   */
  fastify.post<{
    Params: z.infer<typeof ProjectParamSchema>;
    Body: z.infer<typeof ExportRequestBodySchema>;
  }>(
    '/projects/:projectId/knowledge-graph/export',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Export the knowledge graph to GraphML, JSON, DOT, or Mermaid format',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        body: ExportRequestBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              format: { type: 'string' },
              data: { type: 'string' },
              nodeCount: { type: 'number' },
              edgeCount: { type: 'number' },
              exportTimeMs: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const service = getKnowledgeGraphService();
      const result = service.exportGraph({
        projectId,
        format: body.format,
        options: body.options,
        query: body.query ? { projectId, ...body.query } : undefined,
      });

      return reply.send(result);
    }
  );

  // ============================================
  // Statistics
  // ============================================

  /**
   * GET /projects/:projectId/knowledge-graph/statistics
   * Get statistics for the project's knowledge graph
   */
  fastify.get<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/knowledge-graph/statistics',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get statistics for the project knowledge graph',
        tags: ['Knowledge Graph'],
        params: ProjectParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              totalNodes: { type: 'number' },
              totalEdges: { type: 'number' },
              nodesByType: { type: 'object' },
              edgesByType: { type: 'object' },
              avgDegree: { type: 'number' },
              maxDegree: { type: 'number' },
              connectedComponents: { type: 'number' },
              orphanNodes: { type: 'number' },
              lastUpdated: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;

      const service = getKnowledgeGraphService();
      const stats = service.getStatistics(projectId);

      return reply.send(stats);
    }
  );

  /**
   * GET /knowledge-graph/stats
   * Get service-level statistics
   */
  fastify.get(
    '/knowledge-graph/stats',
    {
      preHandler: [authorize({ permissions: ['context:read'] })],
      schema: {
        description: 'Get service-level knowledge graph statistics',
        tags: ['Knowledge Graph'],
        response: {
          200: {
            type: 'object',
            properties: {
              isEnabled: { type: 'boolean' },
              config: { type: 'object' },
              totalProjects: { type: 'number' },
              totalNodes: { type: 'number' },
              totalEdges: { type: 'number' },
              changeLogSize: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const service = getKnowledgeGraphService();
      const stats = service.getServiceStats();

      return reply.send(stats);
    }
  );

  /**
   * DELETE /projects/:projectId/knowledge-graph
   * Clear all graph data for a project
   */
  fastify.delete<{
    Params: z.infer<typeof ProjectParamSchema>;
  }>(
    '/projects/:projectId/knowledge-graph',
    {
      preHandler: [authorize({ permissions: ['context:delete'] })],
      schema: {
        description: 'Clear all knowledge graph data for a project',
        tags: ['Knowledge Graph'],
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

      const service = getKnowledgeGraphService();
      service.clearProjectGraph(projectId);

      return reply.send({ cleared: true });
    }
  );
}
