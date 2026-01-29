/**
 * US-006: Knowledge Graph Model
 *
 * Defines the data structures for the Knowledge Graph feature:
 * - AC-006.1: Graph entities (modules, decisions, patterns)
 * - AC-006.2: Automatic relationship detection
 * - AC-006.4: Export formats (GraphML, JSON)
 * - AC-006.5: Incremental updates
 */

import { z } from 'zod';
import { UUIDSchema, TimestampsSchema } from './index.js';

// ============================================
// Entity Types
// ============================================

/**
 * Types of entities that can be represented in the Knowledge Graph
 */
export const GraphEntityTypeSchema = z.enum([
  'module',           // Code module/component
  'adr',              // Architecture Decision Record
  'pattern',          // Design pattern
  'knowledge',        // Knowledge entry
  'context',          // Context entry
  'team',             // Team/ownership
  'technology',       // Technology/framework
  'concept',          // Abstract concept
  'file',             // Source file
  'dependency',       // External dependency
]);

export type GraphEntityType = z.infer<typeof GraphEntityTypeSchema>;

/**
 * A node in the Knowledge Graph
 */
export const GraphNodeSchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  entityType: GraphEntityTypeSchema,
  entityId: UUIDSchema.nullable(),    // Reference to source entity (contextEntry, module, etc.)
  name: z.string().min(1).max(500),
  description: z.string().nullable(),
  properties: z.record(z.unknown()).default({}),  // Additional properties
  tags: z.array(z.string()).default([]),
  weight: z.number().min(0).max(1).default(1),    // Node importance/relevance
  embedding: z.array(z.number()).nullable(),      // Semantic embedding
  sourceFile: z.string().nullable(),              // Original file path
  sourceLineStart: z.number().nullable(),
  sourceLineEnd: z.number().nullable(),
  ...TimestampsSchema.shape,
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const CreateGraphNodeSchema = GraphNodeSchema.omit({
  id: true,
  embedding: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateGraphNode = z.infer<typeof CreateGraphNodeSchema>;

// ============================================
// Relationship Types
// ============================================

/**
 * Types of relationships between entities
 */
export const GraphRelationTypeSchema = z.enum([
  // Structural relationships
  'contains',          // Parent-child (module contains file)
  'depends_on',        // Dependency relationship
  'imports',           // Import/require relationship
  'exports',           // Export relationship
  'extends',           // Inheritance
  'implements',        // Interface implementation

  // Semantic relationships
  'relates_to',        // General relation
  'references',        // References/mentions
  'uses',              // Uses pattern/technology
  'defines',           // Defines concept/pattern

  // Decision relationships
  'decides',           // ADR makes decision about
  'supersedes',        // ADR supersedes another
  'affects',           // Decision affects module/code
  'constrains',        // Constrains implementation

  // Ownership relationships
  'owns',              // Team/person owns module
  'maintains',         // Maintains codebase
  'contributes_to',    // Contributes to module

  // Evolution relationships
  'evolved_from',      // Code evolution
  'refactored_to',     // Refactoring relationship
  'deprecated_by',     // Deprecation
]);

export type GraphRelationType = z.infer<typeof GraphRelationTypeSchema>;

/**
 * An edge in the Knowledge Graph
 */
export const GraphEdgeSchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  sourceNodeId: UUIDSchema,
  targetNodeId: UUIDSchema,
  relationType: GraphRelationTypeSchema,
  weight: z.number().min(0).max(1).default(1),    // Relationship strength
  confidence: z.number().min(0).max(1).default(1), // Detection confidence
  bidirectional: z.boolean().default(false),
  properties: z.record(z.unknown()).default({}),
  detectedBy: z.enum(['manual', 'content_analysis', 'code_analysis', 'import_analysis', 'reference_analysis']).default('manual'),
  ...TimestampsSchema.shape,
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const CreateGraphEdgeSchema = GraphEdgeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateGraphEdge = z.infer<typeof CreateGraphEdgeSchema>;

// ============================================
// Graph Operations
// ============================================

/**
 * Request to extract entities from content
 */
export const EntityExtractionRequestSchema = z.object({
  projectId: UUIDSchema,
  content: z.string().min(1),
  contentType: z.enum(['markdown', 'code', 'json', 'yaml']).default('markdown'),
  sourceFile: z.string().optional(),
  contextEntryId: UUIDSchema.optional(),
  extractRelations: z.boolean().default(true),
});

export type EntityExtractionRequest = z.infer<typeof EntityExtractionRequestSchema>;

/**
 * Extracted entity from content analysis
 */
export const ExtractedEntitySchema = z.object({
  name: z.string(),
  type: GraphEntityTypeSchema,
  confidence: z.number().min(0).max(1),
  mentions: z.array(z.object({
    text: z.string(),
    startOffset: z.number(),
    endOffset: z.number(),
  })),
  properties: z.record(z.unknown()).default({}),
});

export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;

/**
 * Extracted relationship from content analysis
 */
export const ExtractedRelationSchema = z.object({
  sourceEntity: z.string(),      // Entity name
  targetEntity: z.string(),      // Entity name
  relationType: GraphRelationTypeSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.string().optional(), // Text snippet showing relationship
});

export type ExtractedRelation = z.infer<typeof ExtractedRelationSchema>;

/**
 * Result of entity extraction
 */
export const EntityExtractionResultSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
  relations: z.array(ExtractedRelationSchema),
  processingTimeMs: z.number(),
  contentHash: z.string(),
});

export type EntityExtractionResult = z.infer<typeof EntityExtractionResultSchema>;

// ============================================
// Graph Query & Traversal
// ============================================

/**
 * Graph traversal request
 */
export const GraphTraversalRequestSchema = z.object({
  startNodeId: UUIDSchema,
  maxDepth: z.number().int().min(1).max(10).default(3),
  relationTypes: z.array(GraphRelationTypeSchema).optional(),
  entityTypes: z.array(GraphEntityTypeSchema).optional(),
  direction: z.enum(['outgoing', 'incoming', 'both']).default('both'),
  minWeight: z.number().min(0).max(1).default(0),
  minConfidence: z.number().min(0).max(1).default(0),
  limit: z.number().int().min(1).max(500).default(100),
});

export type GraphTraversalRequest = z.infer<typeof GraphTraversalRequestSchema>;

/**
 * Graph query for filtering nodes/edges
 */
export const GraphQuerySchema = z.object({
  projectId: UUIDSchema,
  entityTypes: z.array(GraphEntityTypeSchema).optional(),
  relationTypes: z.array(GraphRelationTypeSchema).optional(),
  tags: z.array(z.string()).optional(),
  searchText: z.string().optional(),
  minWeight: z.number().min(0).max(1).default(0),
  includeOrphans: z.boolean().default(false),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export type GraphQuery = z.infer<typeof GraphQuerySchema>;

/**
 * Subgraph result (portion of the full graph)
 */
export const SubgraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  metadata: z.object({
    totalNodes: z.number(),
    totalEdges: z.number(),
    queryTimeMs: z.number(),
    truncated: z.boolean(),
  }),
});

export type Subgraph = z.infer<typeof SubgraphSchema>;

// ============================================
// Impact Analysis
// ============================================

/**
 * Impact analysis request
 */
export const ImpactAnalysisRequestSchema = z.object({
  nodeId: UUIDSchema,
  changeType: z.enum(['modify', 'delete', 'deprecate']).default('modify'),
  maxDepth: z.number().int().min(1).max(10).default(5),
  includeIndirect: z.boolean().default(true),
});

export type ImpactAnalysisRequest = z.infer<typeof ImpactAnalysisRequestSchema>;

/**
 * Impact analysis result
 */
export const ImpactedNodeSchema = z.object({
  node: GraphNodeSchema,
  impactLevel: z.enum(['direct', 'indirect', 'potential']),
  impactScore: z.number().min(0).max(1),
  pathFromSource: z.array(UUIDSchema),
  reason: z.string(),
});

export type ImpactedNode = z.infer<typeof ImpactedNodeSchema>;

export const ImpactAnalysisResultSchema = z.object({
  sourceNode: GraphNodeSchema,
  impactedNodes: z.array(ImpactedNodeSchema),
  totalDirectImpact: z.number(),
  totalIndirectImpact: z.number(),
  analysisTimeMs: z.number(),
  recommendations: z.array(z.string()),
});

export type ImpactAnalysisResult = z.infer<typeof ImpactAnalysisResultSchema>;

// ============================================
// Export Formats
// ============================================

/**
 * GraphML export options
 */
export const GraphMLExportOptionsSchema = z.object({
  includeProperties: z.boolean().optional(),
  includeWeights: z.boolean().optional(),
  prettyPrint: z.boolean().optional(),
});

export type GraphMLExportOptions = z.infer<typeof GraphMLExportOptionsSchema>;

/**
 * JSON export options
 */
export const JSONExportOptionsSchema = z.object({
  format: z.enum(['standard', 'd3', 'cytoscape', 'vis']).optional(),
  includeMetadata: z.boolean().optional(),
  prettyPrint: z.boolean().optional(),
});

export type JSONExportOptions = z.infer<typeof JSONExportOptionsSchema>;

/**
 * Export options (union type)
 */
export type GraphExportOptions = GraphMLExportOptions | JSONExportOptions;

/**
 * Export request
 */
export const GraphExportRequestSchema = z.object({
  projectId: UUIDSchema,
  format: z.enum(['graphml', 'json', 'dot', 'mermaid']).default('json'),
  options: z.union([GraphMLExportOptionsSchema, JSONExportOptionsSchema]).optional(),
  query: GraphQuerySchema.optional(), // Optional filter
});

export type GraphExportRequest = z.infer<typeof GraphExportRequestSchema>;

/**
 * Export result
 */
export const GraphExportResultSchema = z.object({
  format: z.string(),
  data: z.string(),
  nodeCount: z.number(),
  edgeCount: z.number(),
  exportTimeMs: z.number(),
});

export type GraphExportResult = z.infer<typeof GraphExportResultSchema>;

// ============================================
// Incremental Update
// ============================================

/**
 * Change event for incremental graph updates
 */
export const GraphChangeEventSchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  changeType: z.enum(['node_created', 'node_updated', 'node_deleted', 'edge_created', 'edge_updated', 'edge_deleted']),
  entityId: UUIDSchema,
  previousState: z.record(z.unknown()).nullable(),
  newState: z.record(z.unknown()).nullable(),
  triggeredBy: z.enum(['user', 'auto_detection', 'content_change', 'sync']),
  timestamp: z.date(),
});

export type GraphChangeEvent = z.infer<typeof GraphChangeEventSchema>;

/**
 * Pending update for batch processing
 */
export const PendingGraphUpdateSchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  sourceEntityType: z.string(),
  sourceEntityId: UUIDSchema,
  contentHash: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  processedAt: z.date().nullable(),
});

export type PendingGraphUpdate = z.infer<typeof PendingGraphUpdateSchema>;

// ============================================
// Graph Statistics
// ============================================

/**
 * Graph statistics and metrics
 */
export const GraphStatisticsSchema = z.object({
  projectId: UUIDSchema,
  totalNodes: z.number(),
  totalEdges: z.number(),
  nodesByType: z.record(z.number()),
  edgesByType: z.record(z.number()),
  avgDegree: z.number(),
  maxDegree: z.number(),
  connectedComponents: z.number(),
  orphanNodes: z.number(),
  lastUpdated: z.date(),
});

export type GraphStatistics = z.infer<typeof GraphStatisticsSchema>;

// ============================================
// Service Configuration
// ============================================

/**
 * Knowledge Graph service configuration
 */
export const KnowledgeGraphConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoExtraction: z.boolean().default(true),
  minConfidenceThreshold: z.number().min(0).max(1).default(0.5),
  maxNodesPerProject: z.number().int().positive().default(10000),
  maxEdgesPerProject: z.number().int().positive().default(50000),
  batchProcessingSize: z.number().int().positive().default(100),
  cacheEnabled: z.boolean().default(true),
  cacheTTLSeconds: z.number().int().positive().default(300),
});

export type KnowledgeGraphConfig = z.infer<typeof KnowledgeGraphConfigSchema>;
