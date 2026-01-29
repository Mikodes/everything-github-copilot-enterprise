/**
 * US-006: Knowledge Graph Service
 *
 * Implements the Knowledge Graph feature for visualizing relationships
 * between project concepts:
 * - AC-006.1: Generate entity graph (modules, decisions, patterns)
 * - AC-006.2: Automatically detect relationships from content
 * - AC-006.3: Enable interactive graph navigation
 * - AC-006.4: Export to standard formats (GraphML, JSON)
 * - AC-006.5: Incremental updates when documents change
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getDatabase } from '../database/client.js';
import { getContextMultiCache, MultiLevelCache } from '../cache/multi-level-cache.js';
import { createChildLogger } from '../utils/logger.js';
import { ContextEntry } from '../models/index.js';
import {
  GraphNode,
  GraphEdge,
  GraphEntityType,
  GraphRelationType,
  CreateGraphNode,
  CreateGraphEdge,
  EntityExtractionRequest,
  EntityExtractionResult,
  ExtractedEntity,
  ExtractedRelation,
  GraphTraversalRequest,
  GraphQuery,
  Subgraph,
  ImpactAnalysisRequest,
  ImpactAnalysisResult,
  ImpactedNode,
  GraphExportRequest,
  GraphExportResult,
  GraphChangeEvent,
  GraphStatistics,
  KnowledgeGraphConfig,
} from '../models/knowledge-graph.js';

const logger = createChildLogger('knowledge-graph');

// ============================================
// Entity Extraction Patterns
// ============================================

/**
 * Patterns for extracting entities from content
 */
const ENTITY_PATTERNS: Array<{
  pattern: RegExp;
  type: GraphEntityType;
  nameGroup: number;
}> = [
  // Module references
  { pattern: /\bmodule[:\s]+["']?([A-Za-z][A-Za-z0-9_-]+)["']?/gi, type: 'module', nameGroup: 1 },
  { pattern: /\bcomponent[:\s]+["']?([A-Za-z][A-Za-z0-9_-]+)["']?/gi, type: 'module', nameGroup: 1 },
  { pattern: /\bservice[:\s]+["']?([A-Za-z][A-Za-z0-9_-]+)["']?/gi, type: 'module', nameGroup: 1 },

  // ADR references
  { pattern: /\bADR[-\s]?(\d{3,4})/gi, type: 'adr', nameGroup: 0 },
  { pattern: /(?:decision|architecture decision)[:\s]+["']?([A-Za-z][A-Za-z0-9_\s-]+)["']?/gi, type: 'adr', nameGroup: 1 },

  // Pattern references
  { pattern: /\b(singleton|factory|observer|strategy|decorator|adapter|facade|proxy|command|mediator|state|template method|visitor|chain of responsibility|flyweight|composite|bridge|prototype|builder|abstract factory|mvc|mvvm|repository|unit of work|cqrs|event sourcing)\s+pattern/gi, type: 'pattern', nameGroup: 1 },
  { pattern: /\bpattern[:\s]+["']?([A-Za-z][A-Za-z0-9_\s-]+)["']?/gi, type: 'pattern', nameGroup: 1 },

  // Technology references
  { pattern: /\b(react|angular|vue|express|fastify|nest\.?js|next\.?js|node\.?js|typescript|javascript|python|java|go|rust|postgresql|mongodb|redis|elasticsearch|kafka|rabbitmq|docker|kubernetes|aws|azure|gcp)\b/gi, type: 'technology', nameGroup: 1 },

  // Concept references
  { pattern: /\bconcept[:\s]+["']?([A-Za-z][A-Za-z0-9_\s-]+)["']?/gi, type: 'concept', nameGroup: 1 },

  // Team references
  { pattern: /\bteam[:\s]+["']?([A-Za-z][A-Za-z0-9_\s-]+)["']?/gi, type: 'team', nameGroup: 1 },
  { pattern: /\bowner[:\s]+["']?([A-Za-z][A-Za-z0-9_\s-]+)["']?/gi, type: 'team', nameGroup: 1 },

  // File references
  { pattern: /\b([A-Za-z][A-Za-z0-9_-]+\.(ts|js|tsx|jsx|py|java|go|rs|rb|php))\b/g, type: 'file', nameGroup: 1 },
  { pattern: /\bfile[:\s]+["']?([A-Za-z][A-Za-z0-9_/.-]+)["']?/gi, type: 'file', nameGroup: 1 },

  // Dependency references
  { pattern: /\bdependenc(?:y|ies)[:\s]+["']?([A-Za-z][A-Za-z0-9_@/-]+)["']?/gi, type: 'dependency', nameGroup: 1 },
  { pattern: /\b(?:requires?|imports?)[:\s]+["']?([A-Za-z][A-Za-z0-9_@/-]+)["']?/gi, type: 'dependency', nameGroup: 1 },
];

/**
 * Patterns for extracting relationships from content
 */
const RELATION_PATTERNS: Array<{
  pattern: RegExp;
  relationType: GraphRelationType;
  sourceGroup: number;
  targetGroup: number;
}> = [
  // Dependency relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+depends\s+on\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'depends_on', sourceGroup: 1, targetGroup: 2 },
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+requires\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'depends_on', sourceGroup: 1, targetGroup: 2 },

  // Import relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+imports?\s+(?:from\s+)?([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'imports', sourceGroup: 1, targetGroup: 2 },
  { pattern: /import\s+.*\s+from\s+['"]([^'"]+)['"]/g, relationType: 'imports', sourceGroup: 0, targetGroup: 1 },

  // Extension relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+extends\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'extends', sourceGroup: 1, targetGroup: 2 },
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+inherits\s+(?:from\s+)?([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'extends', sourceGroup: 1, targetGroup: 2 },

  // Implementation relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+implements\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'implements', sourceGroup: 1, targetGroup: 2 },

  // Usage relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+uses\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'uses', sourceGroup: 1, targetGroup: 2 },
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+utilizes\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'uses', sourceGroup: 1, targetGroup: 2 },

  // Reference relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+references?\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'references', sourceGroup: 1, targetGroup: 2 },

  // Containment relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+contains?\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'contains', sourceGroup: 1, targetGroup: 2 },
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+includes?\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'contains', sourceGroup: 1, targetGroup: 2 },

  // Decision relationships
  { pattern: /ADR[-\s]?(\d+)\s+(?:decides|affects|constrains)\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'affects', sourceGroup: 1, targetGroup: 2 },
  { pattern: /ADR[-\s]?(\d+)\s+supersedes\s+ADR[-\s]?(\d+)/gi, relationType: 'supersedes', sourceGroup: 1, targetGroup: 2 },

  // Ownership relationships
  { pattern: /([A-Za-z][A-Za-z0-9_\s-]+)\s+owns?\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'owns', sourceGroup: 1, targetGroup: 2 },
  { pattern: /([A-Za-z][A-Za-z0-9_\s-]+)\s+maintains?\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'maintains', sourceGroup: 1, targetGroup: 2 },

  // Evolution relationships
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+evolved\s+from\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'evolved_from', sourceGroup: 1, targetGroup: 2 },
  { pattern: /([A-Za-z][A-Za-z0-9_-]+)\s+refactored\s+(?:to|into)\s+([A-Za-z][A-Za-z0-9_-]+)/gi, relationType: 'refactored_to', sourceGroup: 1, targetGroup: 2 },
];

// ============================================
// Service Configuration
// ============================================

const DEFAULT_CONFIG: KnowledgeGraphConfig = {
  enabled: true,
  autoExtraction: true,
  minConfidenceThreshold: 0.5,
  maxNodesPerProject: 10000,
  maxEdgesPerProject: 50000,
  batchProcessingSize: 100,
  cacheEnabled: true,
  cacheTTLSeconds: 300,
};

// ============================================
// In-Memory Graph Storage
// ============================================

interface ProjectGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  nodesByType: Map<GraphEntityType, Set<string>>;
  nodesByName: Map<string, string>; // normalized name -> nodeId
  edgesBySource: Map<string, Set<string>>;
  edgesByTarget: Map<string, Set<string>>;
  pendingUpdates: Set<string>;
  lastUpdated: Date;
}

// ============================================
// Knowledge Graph Service
// ============================================

let serviceInstance: KnowledgeGraphService | null = null;

export class KnowledgeGraphService {
  private config: KnowledgeGraphConfig;
  private graphs: Map<string, ProjectGraph> = new Map();
  private changeLog: GraphChangeEvent[] = [];
  private cache: MultiLevelCache | null = null;

  constructor(config: Partial<KnowledgeGraphConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.cacheEnabled) {
      try {
        this.cache = getContextMultiCache();
      } catch {
        logger.warn('Cache not available, proceeding without caching');
      }
    }

    logger.info({ config: this.config }, 'Knowledge Graph Service initialized');
  }

  // ============================================
  // Graph Management
  // ============================================

  private getOrCreateProjectGraph(projectId: string): ProjectGraph {
    let graph = this.graphs.get(projectId);
    if (!graph) {
      graph = {
        nodes: new Map(),
        edges: new Map(),
        nodesByType: new Map(),
        nodesByName: new Map(),
        edgesBySource: new Map(),
        edgesByTarget: new Map(),
        pendingUpdates: new Set(),
        lastUpdated: new Date(),
      };
      this.graphs.set(projectId, graph);
    }
    return graph;
  }

  // ============================================
  // T-006.2: Entity Extraction
  // ============================================

  /**
   * Extract entities from content using NLP patterns
   */
  extractEntities(content: string, contentType: string = 'markdown'): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>();

    for (const { pattern, type, nameGroup } of ENTITY_PATTERNS) {
      // Reset pattern state
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const name = nameGroup === 0 ? match[0] : match[nameGroup];
        if (!name) continue;

        const normalizedName = this.normalizeName(name);
        const key = `${type}:${normalizedName}`;

        if (seen.has(key)) {
          // Update existing entity with new mention
          const existing = entities.find(
            e => e.type === type && this.normalizeName(e.name) === normalizedName
          );
          if (existing) {
            existing.mentions.push({
              text: match[0],
              startOffset: match.index,
              endOffset: match.index + match[0].length,
            });
          }
          continue;
        }

        seen.add(key);
        entities.push({
          name: name.trim(),
          type,
          confidence: this.calculateEntityConfidence(name, type, content),
          mentions: [{
            text: match[0],
            startOffset: match.index,
            endOffset: match.index + match[0].length,
          }],
          properties: {},
        });
      }
    }

    // Filter by confidence threshold
    return entities.filter(e => e.confidence >= this.config.minConfidenceThreshold);
  }

  /**
   * Calculate confidence score for extracted entity
   */
  private calculateEntityConfidence(name: string, type: GraphEntityType, content: string): number {
    let confidence = 0.5;

    // Length-based confidence boost
    if (name.length >= 3 && name.length <= 50) {
      confidence += 0.1;
    }

    // Multiple mentions boost confidence
    const mentionCount = (content.match(new RegExp(this.escapeRegex(name), 'gi')) || []).length;
    if (mentionCount > 1) {
      confidence += Math.min(0.2, mentionCount * 0.05);
    }

    // Type-specific confidence adjustments
    switch (type) {
      case 'adr':
        if (/ADR[-\s]?\d{3,4}/i.test(name)) confidence += 0.2;
        break;
      case 'technology':
        confidence += 0.15; // Known technologies have higher confidence
        break;
      case 'pattern':
        confidence += 0.1; // Design patterns
        break;
      case 'module':
        if (/Service|Controller|Repository|Component/i.test(name)) confidence += 0.1;
        break;
      default:
        break;
    }

    return Math.min(1, confidence);
  }

  // ============================================
  // T-006.3: Relation Detection
  // ============================================

  /**
   * Extract relationships from content
   */
  extractRelations(content: string, entities: ExtractedEntity[]): ExtractedRelation[] {
    const relations: ExtractedRelation[] = [];
    const seen = new Set<string>();

    // Extract explicit relationships from patterns
    for (const { pattern, relationType, sourceGroup, targetGroup } of RELATION_PATTERNS) {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const source = sourceGroup === 0 ? match[0] : match[sourceGroup];
        const target = match[targetGroup];
        if (!source || !target) continue;

        const key = `${source}:${relationType}:${target}`;
        if (seen.has(key)) continue;
        seen.add(key);

        relations.push({
          sourceEntity: source.trim(),
          targetEntity: target.trim(),
          relationType,
          confidence: this.calculateRelationConfidence(source, target, relationType, content),
          evidence: match[0],
        });
      }
    }

    // Infer relationships from co-occurrence
    const coOccurrenceRelations = this.inferCoOccurrenceRelations(content, entities);
    for (const rel of coOccurrenceRelations) {
      const key = `${rel.sourceEntity}:${rel.relationType}:${rel.targetEntity}`;
      if (!seen.has(key)) {
        seen.add(key);
        relations.push(rel);
      }
    }

    return relations.filter(r => r.confidence >= this.config.minConfidenceThreshold);
  }

  /**
   * Calculate confidence score for extracted relation
   */
  private calculateRelationConfidence(
    source: string,
    target: string,
    relationType: GraphRelationType,
    content: string
  ): number {
    let confidence = 0.6;

    // Explicit relationship keywords boost confidence
    const explicitKeywords = ['depends on', 'requires', 'imports', 'extends', 'implements', 'uses', 'owns'];
    for (const keyword of explicitKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        confidence += 0.1;
        break;
      }
    }

    // ADR relationships have higher confidence
    if (/ADR/i.test(source) || /ADR/i.test(target)) {
      confidence += 0.1;
    }

    // Source and target both appear multiple times
    const sourceCount = (content.match(new RegExp(this.escapeRegex(source), 'gi')) || []).length;
    const targetCount = (content.match(new RegExp(this.escapeRegex(target), 'gi')) || []).length;
    if (sourceCount > 1 && targetCount > 1) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  /**
   * Infer relationships from entity co-occurrence in the same section
   */
  private inferCoOccurrenceRelations(content: string, entities: ExtractedEntity[]): ExtractedRelation[] {
    const relations: ExtractedRelation[] = [];

    // Split content into sections (by headers or paragraphs)
    const sections = content.split(/(?:\n#{1,6}\s|\n\n)/);

    for (const section of sections) {
      const sectionEntities = entities.filter(e =>
        e.mentions.some(m => section.includes(m.text))
      );

      // Create relates_to relationships for co-occurring entities
      for (let i = 0; i < sectionEntities.length; i++) {
        for (let j = i + 1; j < sectionEntities.length; j++) {
          const source = sectionEntities[i];
          const target = sectionEntities[j];

          // Skip if entities are undefined
          if (!source || !target) continue;

          // Skip if same type and similar names
          if (source.type === target.type &&
              this.normalizeName(source.name) === this.normalizeName(target.name)) {
            continue;
          }

          relations.push({
            sourceEntity: source.name,
            targetEntity: target.name,
            relationType: 'relates_to',
            confidence: 0.4, // Lower confidence for inferred relations
            evidence: section.slice(0, 100) + '...',
          });
        }
      }
    }

    return relations;
  }

  // ============================================
  // Full Entity Extraction Pipeline
  // ============================================

  /**
   * Process content and extract entities and relationships
   */
  async processContent(request: EntityExtractionRequest): Promise<EntityExtractionResult> {
    const startTime = Date.now();
    const contentHash = this.hashContent(request.content);

    // Check cache
    if (this.cache) {
      const cacheKey = `kg:extraction:${request.projectId}:${contentHash}`;
      const cacheResult = await this.cache.get<EntityExtractionResult>(cacheKey, 'knowledge_entry');
      if (cacheResult.value && 'entities' in cacheResult.value && 'relations' in cacheResult.value) {
        logger.debug({ projectId: request.projectId }, 'Returning cached extraction result');
        return cacheResult.value;
      }
    }

    // Extract entities
    const entities = this.extractEntities(request.content, request.contentType);

    // Extract relations (optionally)
    const relations = request.extractRelations
      ? this.extractRelations(request.content, entities)
      : [];

    const result: EntityExtractionResult = {
      entities,
      relations,
      processingTimeMs: Date.now() - startTime,
      contentHash,
    };

    // Cache result
    if (this.cache) {
      const cacheKey = `kg:extraction:${request.projectId}:${contentHash}`;
      await this.cache.set(cacheKey, result, 'knowledge_entry');
    }

    logger.info({
      projectId: request.projectId,
      entitiesFound: entities.length,
      relationsFound: relations.length,
      processingTimeMs: result.processingTimeMs,
    }, 'Content extraction completed');

    return result;
  }

  // ============================================
  // T-006.4: Graph Storage (In-Memory + Persistence Ready)
  // ============================================

  /**
   * Add or update a node in the graph
   */
  async addNode(node: CreateGraphNode): Promise<GraphNode> {
    const graph = this.getOrCreateProjectGraph(node.projectId);

    // Check if node already exists (by name and type)
    const normalizedName = this.normalizeName(node.name);
    const existingKey = `${node.entityType}:${normalizedName}`;
    const existingNodeId = graph.nodesByName.get(existingKey);

    if (existingNodeId) {
      const existing = graph.nodes.get(existingNodeId);
      if (existing) {
        // Update existing node
        const updatedNode: GraphNode = {
          ...existing,
          ...node,
          id: existing.id,
          updatedAt: new Date(),
        };
        graph.nodes.set(existingNodeId, updatedNode);
        this.logChange(node.projectId, 'node_updated', existingNodeId, existing as Record<string, unknown>, updatedNode as Record<string, unknown>);
        return updatedNode;
      }
    }

    // Create new node
    const newNode: GraphNode = {
      ...node,
      id: uuidv4(),
      embedding: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    graph.nodes.set(newNode.id, newNode);
    graph.nodesByName.set(existingKey, newNode.id);

    // Index by type
    let typeSet = graph.nodesByType.get(node.entityType);
    if (!typeSet) {
      typeSet = new Set();
      graph.nodesByType.set(node.entityType, typeSet);
    }
    typeSet.add(newNode.id);

    graph.lastUpdated = new Date();
    this.logChange(node.projectId, 'node_created', newNode.id, null, newNode as Record<string, unknown>);

    return newNode;
  }

  /**
   * Add or update an edge in the graph
   */
  async addEdge(edge: CreateGraphEdge): Promise<GraphEdge> {
    const graph = this.getOrCreateProjectGraph(edge.projectId);

    // Check if edge already exists
    const existingEdge = this.findExistingEdge(
      graph,
      edge.sourceNodeId,
      edge.targetNodeId,
      edge.relationType
    );

    if (existingEdge) {
      // Update existing edge
      const updatedEdge: GraphEdge = {
        ...existingEdge,
        ...edge,
        id: existingEdge.id,
        updatedAt: new Date(),
      };
      graph.edges.set(existingEdge.id, updatedEdge);
      this.logChange(edge.projectId, 'edge_updated', existingEdge.id, existingEdge as Record<string, unknown>, updatedEdge as Record<string, unknown>);
      return updatedEdge;
    }

    // Create new edge
    const newEdge: GraphEdge = {
      ...edge,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    graph.edges.set(newEdge.id, newEdge);

    // Index by source and target
    let sourceSet = graph.edgesBySource.get(edge.sourceNodeId);
    if (!sourceSet) {
      sourceSet = new Set();
      graph.edgesBySource.set(edge.sourceNodeId, sourceSet);
    }
    sourceSet.add(newEdge.id);

    let targetSet = graph.edgesByTarget.get(edge.targetNodeId);
    if (!targetSet) {
      targetSet = new Set();
      graph.edgesByTarget.set(edge.targetNodeId, targetSet);
    }
    targetSet.add(newEdge.id);

    graph.lastUpdated = new Date();
    this.logChange(edge.projectId, 'edge_created', newEdge.id, null, newEdge as Record<string, unknown>);

    return newEdge;
  }

  /**
   * Find existing edge between nodes
   */
  private findExistingEdge(
    graph: ProjectGraph,
    sourceNodeId: string,
    targetNodeId: string,
    relationType: GraphRelationType
  ): GraphEdge | undefined {
    const sourceEdges = graph.edgesBySource.get(sourceNodeId);
    if (!sourceEdges) return undefined;

    for (const edgeId of sourceEdges) {
      const edge = graph.edges.get(edgeId);
      if (edge && edge.targetNodeId === targetNodeId && edge.relationType === relationType) {
        return edge;
      }
    }

    return undefined;
  }

  /**
   * Get a node by ID
   */
  getNode(projectId: string, nodeId: string): GraphNode | undefined {
    const graph = this.graphs.get(projectId);
    return graph?.nodes.get(nodeId);
  }

  /**
   * Get an edge by ID
   */
  getEdge(projectId: string, edgeId: string): GraphEdge | undefined {
    const graph = this.graphs.get(projectId);
    return graph?.edges.get(edgeId);
  }

  /**
   * Delete a node and its connected edges
   */
  async deleteNode(projectId: string, nodeId: string): Promise<boolean> {
    const graph = this.graphs.get(projectId);
    if (!graph) return false;

    const node = graph.nodes.get(nodeId);
    if (!node) return false;

    // Delete connected edges
    const connectedEdges = [
      ...(graph.edgesBySource.get(nodeId) || []),
      ...(graph.edgesByTarget.get(nodeId) || []),
    ];

    for (const edgeId of connectedEdges) {
      await this.deleteEdge(projectId, edgeId);
    }

    // Remove from indexes
    const normalizedName = this.normalizeName(node.name);
    const nameKey = `${node.entityType}:${normalizedName}`;
    graph.nodesByName.delete(nameKey);

    const typeSet = graph.nodesByType.get(node.entityType);
    if (typeSet) {
      typeSet.delete(nodeId);
    }

    // Remove node
    graph.nodes.delete(nodeId);
    graph.lastUpdated = new Date();
    this.logChange(projectId, 'node_deleted', nodeId, node as Record<string, unknown>, null);

    return true;
  }

  /**
   * Delete an edge
   */
  async deleteEdge(projectId: string, edgeId: string): Promise<boolean> {
    const graph = this.graphs.get(projectId);
    if (!graph) return false;

    const edge = graph.edges.get(edgeId);
    if (!edge) return false;

    // Remove from indexes
    const sourceSet = graph.edgesBySource.get(edge.sourceNodeId);
    if (sourceSet) {
      sourceSet.delete(edgeId);
    }

    const targetSet = graph.edgesByTarget.get(edge.targetNodeId);
    if (targetSet) {
      targetSet.delete(edgeId);
    }

    // Remove edge
    graph.edges.delete(edgeId);
    graph.lastUpdated = new Date();
    this.logChange(projectId, 'edge_deleted', edgeId, edge as Record<string, unknown>, null);

    return true;
  }

  // ============================================
  // T-006.5: Graph Queries
  // ============================================

  /**
   * Query the graph with filters
   */
  queryGraph(query: GraphQuery): Subgraph {
    const startTime = Date.now();
    const graph = this.graphs.get(query.projectId);

    if (!graph) {
      return {
        nodes: [],
        edges: [],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          queryTimeMs: Date.now() - startTime,
          truncated: false,
        },
      };
    }

    // Filter nodes
    let nodes = Array.from(graph.nodes.values());

    if (query.entityTypes && query.entityTypes.length > 0) {
      nodes = nodes.filter(n => query.entityTypes!.includes(n.entityType));
    }

    if (query.tags && query.tags.length > 0) {
      nodes = nodes.filter(n => query.tags!.some(t => n.tags.includes(t)));
    }

    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      nodes = nodes.filter(n =>
        n.name.toLowerCase().includes(searchLower) ||
        (n.description && n.description.toLowerCase().includes(searchLower))
      );
    }

    if (query.minWeight > 0) {
      nodes = nodes.filter(n => n.weight >= query.minWeight);
    }

    // Get relevant node IDs
    const nodeIds = new Set(nodes.map(n => n.id));

    // Filter edges
    let edges = Array.from(graph.edges.values()).filter(e =>
      nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
    );

    if (query.relationTypes && query.relationTypes.length > 0) {
      edges = edges.filter(e => query.relationTypes!.includes(e.relationType));
    }

    // Handle orphan nodes
    if (!query.includeOrphans) {
      const connectedNodeIds = new Set<string>();
      for (const edge of edges) {
        connectedNodeIds.add(edge.sourceNodeId);
        connectedNodeIds.add(edge.targetNodeId);
      }
      nodes = nodes.filter(n => connectedNodeIds.has(n.id));
    }

    // Apply pagination
    const truncated = nodes.length > query.limit;
    nodes = nodes.slice(query.offset, query.offset + query.limit);

    // Re-filter edges for paginated nodes
    const finalNodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e =>
      finalNodeIds.has(e.sourceNodeId) && finalNodeIds.has(e.targetNodeId)
    );

    return {
      nodes,
      edges,
      metadata: {
        totalNodes: graph.nodes.size,
        totalEdges: graph.edges.size,
        queryTimeMs: Date.now() - startTime,
        truncated,
      },
    };
  }

  /**
   * Traverse the graph from a starting node
   */
  traverseGraph(projectId: string, request: GraphTraversalRequest): Subgraph {
    const startTime = Date.now();
    const graph = this.graphs.get(projectId);

    if (!graph) {
      return {
        nodes: [],
        edges: [],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          queryTimeMs: Date.now() - startTime,
          truncated: false,
        },
      };
    }

    const visited = new Set<string>();
    const resultNodes: GraphNode[] = [];
    const resultEdges: GraphEdge[] = [];

    const traverse = (nodeId: string, depth: number) => {
      if (depth > request.maxDepth || visited.has(nodeId) || resultNodes.length >= request.limit) {
        return;
      }

      visited.add(nodeId);
      const node = graph.nodes.get(nodeId);
      if (!node) return;

      // Check entity type filter
      if (request.entityTypes && request.entityTypes.length > 0) {
        if (!request.entityTypes.includes(node.entityType)) return;
      }

      // Check weight filter
      if (node.weight < request.minWeight) return;

      resultNodes.push(node);

      // Get connected edges
      const outgoingEdges = request.direction !== 'incoming'
        ? Array.from(graph.edgesBySource.get(nodeId) || [])
        : [];
      const incomingEdges = request.direction !== 'outgoing'
        ? Array.from(graph.edgesByTarget.get(nodeId) || [])
        : [];

      const edgeIds = [...outgoingEdges, ...incomingEdges];

      for (const edgeId of edgeIds) {
        const edge = graph.edges.get(edgeId);
        if (!edge) continue;

        // Check relation type filter
        if (request.relationTypes && request.relationTypes.length > 0) {
          if (!request.relationTypes.includes(edge.relationType)) continue;
        }

        // Check confidence filter
        if (edge.confidence < request.minConfidence) continue;

        resultEdges.push(edge);

        // Continue traversal
        const nextNodeId = edge.sourceNodeId === nodeId ? edge.targetNodeId : edge.sourceNodeId;
        traverse(nextNodeId, depth + 1);
      }
    };

    traverse(request.startNodeId, 0);

    return {
      nodes: resultNodes,
      edges: resultEdges,
      metadata: {
        totalNodes: graph.nodes.size,
        totalEdges: graph.edges.size,
        queryTimeMs: Date.now() - startTime,
        truncated: resultNodes.length >= request.limit,
      },
    };
  }

  /**
   * Find node by name and type
   */
  findNodeByName(projectId: string, name: string, entityType?: GraphEntityType): GraphNode | undefined {
    const graph = this.graphs.get(projectId);
    if (!graph) return undefined;

    const normalizedName = this.normalizeName(name);

    if (entityType) {
      const key = `${entityType}:${normalizedName}`;
      const nodeId = graph.nodesByName.get(key);
      return nodeId ? graph.nodes.get(nodeId) : undefined;
    }

    // Search across all types
    for (const [key, nodeId] of graph.nodesByName) {
      if (key.endsWith(`:${normalizedName}`)) {
        return graph.nodes.get(nodeId);
      }
    }

    return undefined;
  }

  // ============================================
  // Impact Analysis (M1.4.2)
  // ============================================

  /**
   * Analyze the impact of changes to a node
   */
  analyzeImpact(projectId: string, request: ImpactAnalysisRequest): ImpactAnalysisResult {
    const startTime = Date.now();
    const graph = this.graphs.get(projectId);

    const emptyResult: ImpactAnalysisResult = {
      sourceNode: null as unknown as GraphNode,
      impactedNodes: [],
      totalDirectImpact: 0,
      totalIndirectImpact: 0,
      analysisTimeMs: Date.now() - startTime,
      recommendations: [],
    };

    if (!graph) return emptyResult;

    const sourceNode = graph.nodes.get(request.nodeId);
    if (!sourceNode) return emptyResult;

    const impactedNodes: ImpactedNode[] = [];
    const visited = new Map<string, { level: 'direct' | 'indirect' | 'potential'; path: string[] }>();

    // BFS to find impacted nodes
    const queue: Array<{ nodeId: string; depth: number; path: string[] }> = [];

    // Start with directly connected nodes
    const directEdges = [
      ...(graph.edgesBySource.get(request.nodeId) || []),
      ...(graph.edgesByTarget.get(request.nodeId) || []),
    ];

    for (const edgeId of directEdges) {
      const edge = graph.edges.get(edgeId);
      if (!edge) continue;

      const targetNodeId = edge.sourceNodeId === request.nodeId ? edge.targetNodeId : edge.sourceNodeId;
      if (!visited.has(targetNodeId)) {
        visited.set(targetNodeId, { level: 'direct', path: [request.nodeId, targetNodeId] });
        queue.push({ nodeId: targetNodeId, depth: 1, path: [request.nodeId, targetNodeId] });
      }
    }

    // Continue BFS for indirect impacts
    while (queue.length > 0 && request.includeIndirect) {
      const { nodeId, depth, path } = queue.shift()!;

      if (depth >= request.maxDepth) continue;

      const connectedEdges = [
        ...(graph.edgesBySource.get(nodeId) || []),
        ...(graph.edgesByTarget.get(nodeId) || []),
      ];

      for (const edgeId of connectedEdges) {
        const edge = graph.edges.get(edgeId);
        if (!edge) continue;

        const nextNodeId = edge.sourceNodeId === nodeId ? edge.targetNodeId : edge.sourceNodeId;
        if (nextNodeId === request.nodeId) continue;

        if (!visited.has(nextNodeId)) {
          const newPath = [...path, nextNodeId];
          const level = depth === 1 ? 'indirect' : 'potential';
          visited.set(nextNodeId, { level, path: newPath });
          queue.push({ nodeId: nextNodeId, depth: depth + 1, path: newPath });
        }
      }
    }

    // Build impact result
    for (const [nodeId, { level, path }] of visited) {
      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      const impactScore = this.calculateImpactScore(level, path.length, node.weight);

      impactedNodes.push({
        node,
        impactLevel: level,
        impactScore,
        pathFromSource: path,
        reason: this.generateImpactReason(sourceNode, node, level, request.changeType),
      });
    }

    // Sort by impact score
    impactedNodes.sort((a, b) => b.impactScore - a.impactScore);

    const directCount = impactedNodes.filter(n => n.impactLevel === 'direct').length;
    const indirectCount = impactedNodes.filter(n => n.impactLevel !== 'direct').length;

    return {
      sourceNode,
      impactedNodes,
      totalDirectImpact: directCount,
      totalIndirectImpact: indirectCount,
      analysisTimeMs: Date.now() - startTime,
      recommendations: this.generateImpactRecommendations(sourceNode, impactedNodes, request.changeType),
    };
  }

  /**
   * Calculate impact score based on level and distance
   */
  private calculateImpactScore(level: 'direct' | 'indirect' | 'potential', distance: number, nodeWeight: number): number {
    const levelMultiplier = level === 'direct' ? 1.0 : level === 'indirect' ? 0.6 : 0.3;
    const distanceFactor = 1 / (1 + (distance - 1) * 0.2);
    return levelMultiplier * distanceFactor * nodeWeight;
  }

  /**
   * Generate human-readable impact reason
   */
  private generateImpactReason(
    source: GraphNode,
    target: GraphNode,
    level: 'direct' | 'indirect' | 'potential',
    changeType: string
  ): string {
    const levelText = level === 'direct' ? 'directly' : level === 'indirect' ? 'indirectly' : 'potentially';
    return `${target.name} (${target.entityType}) is ${levelText} affected by ${changeType} of ${source.name}`;
  }

  /**
   * Generate recommendations based on impact analysis
   */
  private generateImpactRecommendations(
    source: GraphNode,
    impactedNodes: ImpactedNode[],
    changeType: string
  ): string[] {
    const recommendations: string[] = [];

    const directCount = impactedNodes.filter(n => n.impactLevel === 'direct').length;

    if (directCount > 5) {
      recommendations.push(`High impact: ${directCount} components directly affected. Consider breaking down changes.`);
    }

    if (changeType === 'delete') {
      const criticalNodes = impactedNodes.filter(n => n.impactScore > 0.7);
      if (criticalNodes.length > 0) {
        recommendations.push(`Critical dependencies found: ${criticalNodes.map(n => n.node.name).join(', ')}. Ensure migration plan exists.`);
      }
    }

    const affectedADRs = impactedNodes.filter(n => n.node.entityType === 'adr');
    if (affectedADRs.length > 0) {
      recommendations.push(`${affectedADRs.length} architecture decisions may need review: ${affectedADRs.map(n => n.node.name).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Low impact change. Standard review process recommended.');
    }

    return recommendations;
  }

  // ============================================
  // AC-006.4: Export to GraphML and JSON
  // ============================================

  /**
   * Export graph to specified format
   */
  exportGraph(request: GraphExportRequest): GraphExportResult {
    const startTime = Date.now();

    // Get graph data (optionally filtered)
    const subgraph = request.query
      ? this.queryGraph({ ...request.query, projectId: request.projectId })
      : this.queryGraph({
          projectId: request.projectId,
          limit: 10000,
          offset: 0,
          minWeight: 0,
          includeOrphans: true,
        });

    let data: string;

    switch (request.format) {
      case 'graphml':
        data = this.exportToGraphML(subgraph);
        break;
      case 'json':
        data = this.exportToJSON(subgraph, request.options as { format?: string; prettyPrint?: boolean });
        break;
      case 'dot':
        data = this.exportToDOT(subgraph);
        break;
      case 'mermaid':
        data = this.exportToMermaid(subgraph);
        break;
      default:
        data = this.exportToJSON(subgraph, {});
    }

    return {
      format: request.format,
      data,
      nodeCount: subgraph.nodes.length,
      edgeCount: subgraph.edges.length,
      exportTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Export to GraphML format
   */
  private exportToGraphML(subgraph: Subgraph): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
      '  <key id="name" for="node" attr.name="name" attr.type="string"/>',
      '  <key id="entityType" for="node" attr.name="entityType" attr.type="string"/>',
      '  <key id="description" for="node" attr.name="description" attr.type="string"/>',
      '  <key id="weight" for="node" attr.name="weight" attr.type="double"/>',
      '  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>',
      '  <key id="confidence" for="edge" attr.name="confidence" attr.type="double"/>',
      '  <graph id="G" edgedefault="directed">',
    ];

    for (const node of subgraph.nodes) {
      lines.push(`    <node id="${this.escapeXml(node.id)}">`);
      lines.push(`      <data key="name">${this.escapeXml(node.name)}</data>`);
      lines.push(`      <data key="entityType">${this.escapeXml(node.entityType)}</data>`);
      if (node.description) {
        lines.push(`      <data key="description">${this.escapeXml(node.description)}</data>`);
      }
      lines.push(`      <data key="weight">${node.weight}</data>`);
      lines.push('    </node>');
    }

    for (const edge of subgraph.edges) {
      lines.push(`    <edge id="${this.escapeXml(edge.id)}" source="${this.escapeXml(edge.sourceNodeId)}" target="${this.escapeXml(edge.targetNodeId)}">`);
      lines.push(`      <data key="relationType">${this.escapeXml(edge.relationType)}</data>`);
      lines.push(`      <data key="confidence">${edge.confidence}</data>`);
      lines.push('    </edge>');
    }

    lines.push('  </graph>');
    lines.push('</graphml>');

    return lines.join('\n');
  }

  /**
   * Export to JSON format (supports multiple standards)
   */
  private exportToJSON(subgraph: Subgraph, options: { format?: string; prettyPrint?: boolean } = {}): string {
    const format = options.format || 'standard';

    let data: object;

    switch (format) {
      case 'd3':
        // D3.js force-directed graph format
        data = {
          nodes: subgraph.nodes.map(n => ({
            id: n.id,
            name: n.name,
            group: n.entityType,
            weight: n.weight,
          })),
          links: subgraph.edges.map(e => ({
            source: e.sourceNodeId,
            target: e.targetNodeId,
            value: e.weight,
            type: e.relationType,
          })),
        };
        break;

      case 'cytoscape':
        // Cytoscape.js format
        data = {
          elements: {
            nodes: subgraph.nodes.map(n => ({
              data: {
                id: n.id,
                label: n.name,
                type: n.entityType,
                weight: n.weight,
              },
            })),
            edges: subgraph.edges.map(e => ({
              data: {
                id: e.id,
                source: e.sourceNodeId,
                target: e.targetNodeId,
                label: e.relationType,
                weight: e.weight,
              },
            })),
          },
        };
        break;

      case 'vis':
        // vis.js Network format
        data = {
          nodes: subgraph.nodes.map(n => ({
            id: n.id,
            label: n.name,
            group: n.entityType,
            value: n.weight,
            title: n.description,
          })),
          edges: subgraph.edges.map(e => ({
            id: e.id,
            from: e.sourceNodeId,
            to: e.targetNodeId,
            label: e.relationType,
            value: e.weight,
            arrows: e.bidirectional ? 'to, from' : 'to',
          })),
        };
        break;

      default:
        // Standard format
        data = {
          nodes: subgraph.nodes,
          edges: subgraph.edges,
          metadata: subgraph.metadata,
        };
    }

    return options.prettyPrint !== false ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  /**
   * Export to DOT (Graphviz) format
   */
  private exportToDOT(subgraph: Subgraph): string {
    const lines: string[] = ['digraph KnowledgeGraph {', '  rankdir=LR;', '  node [shape=box];', ''];

    // Group nodes by type
    const nodesByType = new Map<GraphEntityType, GraphNode[]>();
    for (const node of subgraph.nodes) {
      const nodes = nodesByType.get(node.entityType) || [];
      nodes.push(node);
      nodesByType.set(node.entityType, nodes);
    }

    // Add nodes with subgraphs for types
    for (const [type, nodes] of nodesByType) {
      lines.push(`  subgraph cluster_${type} {`);
      lines.push(`    label="${type}";`);
      for (const node of nodes) {
        const label = this.escapeGraphviz(node.name);
        lines.push(`    "${node.id}" [label="${label}"];`);
      }
      lines.push('  }');
      lines.push('');
    }

    // Add edges
    for (const edge of subgraph.edges) {
      const label = this.escapeGraphviz(edge.relationType);
      const style = edge.bidirectional ? ', dir=both' : '';
      lines.push(`  "${edge.sourceNodeId}" -> "${edge.targetNodeId}" [label="${label}"${style}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Export to Mermaid diagram format
   */
  private exportToMermaid(subgraph: Subgraph): string {
    const lines: string[] = ['graph LR'];

    // Create node ID mapping (Mermaid needs clean IDs)
    const nodeIdMap = new Map<string, string>();
    let counter = 0;
    for (const node of subgraph.nodes) {
      nodeIdMap.set(node.id, `N${counter++}`);
    }

    // Add nodes
    for (const node of subgraph.nodes) {
      const id = nodeIdMap.get(node.id)!;
      const label = this.escapeMermaid(node.name);
      const shape = this.getMermaidShape(node.entityType);
      lines.push(`  ${id}${shape.open}"${label}"${shape.close}`);
    }

    // Add edges
    for (const edge of subgraph.edges) {
      const sourceId = nodeIdMap.get(edge.sourceNodeId);
      const targetId = nodeIdMap.get(edge.targetNodeId);
      if (sourceId && targetId) {
        const label = this.escapeMermaid(edge.relationType.replace(/_/g, ' '));
        const arrow = edge.bidirectional ? '<-->' : '-->';
        lines.push(`  ${sourceId} ${arrow}|${label}| ${targetId}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get Mermaid shape based on entity type
   */
  private getMermaidShape(entityType: GraphEntityType): { open: string; close: string } {
    switch (entityType) {
      case 'adr':
        return { open: '{{', close: '}}' };    // Hexagon
      case 'module':
        return { open: '[', close: ']' };      // Rectangle
      case 'pattern':
        return { open: '([', close: '])' };    // Stadium
      case 'technology':
        return { open: '((', close: '))' };    // Circle
      case 'concept':
        return { open: '>', close: ']' };      // Asymmetric
      default:
        return { open: '[', close: ']' };
    }
  }

  // ============================================
  // AC-006.5: Incremental Updates
  // ============================================

  /**
   * Process a context entry and update the graph incrementally
   */
  async processContextEntry(entry: ContextEntry): Promise<void> {
    const extraction = await this.processContent({
      projectId: entry.projectId,
      content: entry.content,
      contentType: entry.contentFormat,
      contextEntryId: entry.id,
      extractRelations: true,
    });

    // Create nodes for extracted entities
    const nodeMap = new Map<string, string>(); // entity name -> node ID

    for (const entity of extraction.entities) {
      const node = await this.addNode({
        projectId: entry.projectId,
        entityType: entity.type,
        entityId: entry.id,
        name: entity.name,
        description: null,
        properties: entity.properties,
        tags: entry.tags,
        weight: entity.confidence,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });
      nodeMap.set(entity.name, node.id);
    }

    // Create edges for extracted relations
    for (const relation of extraction.relations) {
      const sourceNodeId = nodeMap.get(relation.sourceEntity);
      const targetNodeId = nodeMap.get(relation.targetEntity);

      // Try to find existing nodes if not in current extraction
      const sourceNode = sourceNodeId
        ? this.getNode(entry.projectId, sourceNodeId)
        : this.findNodeByName(entry.projectId, relation.sourceEntity);
      const targetNode = targetNodeId
        ? this.getNode(entry.projectId, targetNodeId)
        : this.findNodeByName(entry.projectId, relation.targetEntity);

      if (sourceNode && targetNode) {
        await this.addEdge({
          projectId: entry.projectId,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          relationType: relation.relationType,
          weight: relation.confidence,
          confidence: relation.confidence,
          bidirectional: false,
          properties: { evidence: relation.evidence },
          detectedBy: 'content_analysis',
        });
      }
    }

    logger.info({
      projectId: entry.projectId,
      contextEntryId: entry.id,
      nodesCreated: extraction.entities.length,
      edgesCreated: extraction.relations.length,
    }, 'Context entry processed for knowledge graph');
  }

  /**
   * Handle content change event
   */
  async onContentChange(
    projectId: string,
    entityType: string,
    entityId: string,
    newContent: string | null
  ): Promise<void> {
    const graph = this.graphs.get(projectId);
    if (!graph) return;

    if (newContent === null) {
      // Content deleted - remove associated nodes
      for (const [nodeId, node] of graph.nodes) {
        if (node.entityId === entityId) {
          await this.deleteNode(projectId, nodeId);
        }
      }
    } else {
      // Content updated - re-process
      // Mark as pending update
      graph.pendingUpdates.add(entityId);

      // In production, this would be queued for batch processing
      // For now, we'll process immediately if auto-extraction is enabled
      if (this.config.autoExtraction) {
        const extraction = await this.processContent({
          projectId,
          content: newContent,
          contentType: 'markdown',
          extractRelations: true,
        });

        // Update nodes based on extraction
        // This is a simplified version - production would handle merging better
        for (const entity of extraction.entities) {
          await this.addNode({
            projectId,
            entityType: entity.type,
            entityId,
            name: entity.name,
            description: null,
            properties: entity.properties,
            tags: [],
            weight: entity.confidence,
            sourceFile: null,
            sourceLineStart: null,
            sourceLineEnd: null,
          });
        }

        graph.pendingUpdates.delete(entityId);
      }
    }
  }

  // ============================================
  // Graph Statistics
  // ============================================

  /**
   * Get statistics for a project's graph
   */
  getStatistics(projectId: string): GraphStatistics {
    const graph = this.graphs.get(projectId);

    if (!graph) {
      return {
        projectId,
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {},
        edgesByType: {},
        avgDegree: 0,
        maxDegree: 0,
        connectedComponents: 0,
        orphanNodes: 0,
        lastUpdated: new Date(),
      };
    }

    // Count nodes by type
    const nodesByType: Record<string, number> = {};
    for (const [type, nodes] of graph.nodesByType) {
      nodesByType[type] = nodes.size;
    }

    // Count edges by type
    const edgesByType: Record<string, number> = {};
    for (const edge of graph.edges.values()) {
      edgesByType[edge.relationType] = (edgesByType[edge.relationType] || 0) + 1;
    }

    // Calculate degree statistics
    const degrees: number[] = [];
    let orphanCount = 0;

    for (const nodeId of graph.nodes.keys()) {
      const outDegree = graph.edgesBySource.get(nodeId)?.size || 0;
      const inDegree = graph.edgesByTarget.get(nodeId)?.size || 0;
      const degree = outDegree + inDegree;
      degrees.push(degree);
      if (degree === 0) orphanCount++;
    }

    const avgDegree = degrees.length > 0
      ? degrees.reduce((a, b) => a + b, 0) / degrees.length
      : 0;
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;

    // Calculate connected components (simplified)
    const connectedComponents = this.countConnectedComponents(graph);

    return {
      projectId,
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.size,
      nodesByType,
      edgesByType,
      avgDegree: Math.round(avgDegree * 100) / 100,
      maxDegree,
      connectedComponents,
      orphanNodes: orphanCount,
      lastUpdated: graph.lastUpdated,
    };
  }

  /**
   * Count connected components using Union-Find
   */
  private countConnectedComponents(graph: ProjectGraph): number {
    const parent = new Map<string, string>();

    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: string, y: string): void => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent.set(px, py);
      }
    };

    // Initialize all nodes
    for (const nodeId of graph.nodes.keys()) {
      find(nodeId);
    }

    // Union connected nodes
    for (const edge of graph.edges.values()) {
      union(edge.sourceNodeId, edge.targetNodeId);
    }

    // Count unique roots
    const roots = new Set<string>();
    for (const nodeId of graph.nodes.keys()) {
      roots.add(find(nodeId));
    }

    return roots.size;
  }

  // ============================================
  // Service Statistics
  // ============================================

  /**
   * Get service-level statistics
   */
  getServiceStats(): {
    isEnabled: boolean;
    config: KnowledgeGraphConfig;
    totalProjects: number;
    totalNodes: number;
    totalEdges: number;
    changeLogSize: number;
  } {
    let totalNodes = 0;
    let totalEdges = 0;

    for (const graph of this.graphs.values()) {
      totalNodes += graph.nodes.size;
      totalEdges += graph.edges.size;
    }

    return {
      isEnabled: this.config.enabled,
      config: this.config,
      totalProjects: this.graphs.size,
      totalNodes,
      totalEdges,
      changeLogSize: this.changeLog.length,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private normalizeName(name: string): string {
    return name.toLowerCase().replace(/[-_\s]+/g, '-').trim();
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeGraphviz(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private escapeMermaid(str: string): string {
    return str.replace(/"/g, "'").replace(/[[\](){}]/g, '');
  }

  private logChange(
    projectId: string,
    changeType: GraphChangeEvent['changeType'],
    entityId: string,
    previousState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null
  ): void {
    const event: GraphChangeEvent = {
      id: uuidv4(),
      projectId,
      changeType,
      entityId,
      previousState,
      newState,
      triggeredBy: 'auto_detection',
      timestamp: new Date(),
    };

    this.changeLog.push(event);

    // Keep change log bounded
    if (this.changeLog.length > 10000) {
      this.changeLog = this.changeLog.slice(-5000);
    }
  }

  /**
   * Clear all data for a project
   */
  clearProjectGraph(projectId: string): void {
    this.graphs.delete(projectId);
    logger.info({ projectId }, 'Project graph cleared');
  }

  /**
   * Clear all service data
   */
  clearAll(): void {
    this.graphs.clear();
    this.changeLog = [];
    logger.info('All knowledge graph data cleared');
  }
}

// ============================================
// Singleton Management
// ============================================

export function getKnowledgeGraphService(): KnowledgeGraphService {
  if (!serviceInstance) {
    serviceInstance = new KnowledgeGraphService();
  }
  return serviceInstance;
}

export function shutdownKnowledgeGraph(): void {
  if (serviceInstance) {
    serviceInstance.clearAll();
    serviceInstance = null;
    logger.info('Knowledge Graph Service shutdown complete');
  }
}
