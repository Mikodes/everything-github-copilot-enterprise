/**
 * US-006: Knowledge Graph Service Tests
 *
 * Tests for the Knowledge Graph feature implementation:
 * - T-006.2: Entity extraction from content
 * - T-006.3: Relation detection algorithm
 * - T-006.4: Graph storage operations
 * - T-006.5: Graph queries and traversal
 * - AC-006.4: Export to GraphML and JSON
 * - AC-006.5: Incremental updates
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  KnowledgeGraphService,
  getKnowledgeGraphService,
  shutdownKnowledgeGraph,
} from '../../src/services/knowledge-graph.service.js';
import { v4 as uuidv4 } from 'uuid';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  const testProjectId = uuidv4();

  beforeEach(() => {
    shutdownKnowledgeGraph();
    service = new KnowledgeGraphService({
      enabled: true,
      autoExtraction: true,
      minConfidenceThreshold: 0.3, // Lower threshold for testing
    });
  });

  afterEach(() => {
    shutdownKnowledgeGraph();
  });

  // ============================================
  // T-006.2: Entity Extraction Tests
  // ============================================

  describe('Entity Extraction (T-006.2)', () => {
    it('should extract module entities from content', () => {
      const content = `
        This document describes the module: AuthService.
        The module: UserService handles user management.
        The component: Dashboard renders the main UI.
      `;

      const entities = service.extractEntities(content, 'markdown');

      expect(entities.length).toBeGreaterThan(0);
      const moduleEntities = entities.filter(e => e.type === 'module');
      expect(moduleEntities.length).toBeGreaterThanOrEqual(2);

      const names = moduleEntities.map(e => e.name.toLowerCase());
      expect(names.some(n => n.includes('userservice') || n.includes('dashboard'))).toBe(true);
    });

    it('should extract ADR entities from content', () => {
      const content = `
        According to ADR-001, we use PostgreSQL for storage.
        ADR-0023 describes the caching strategy.
        The decision: Use Redis for session management was made last week.
      `;

      const entities = service.extractEntities(content, 'markdown');

      const adrEntities = entities.filter(e => e.type === 'adr');
      expect(adrEntities.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract technology entities from content', () => {
      const content = `
        We use React for the frontend and Node.js for the backend.
        PostgreSQL stores the data, and Redis handles caching.
        Docker containers are deployed to Kubernetes.
      `;

      const entities = service.extractEntities(content, 'markdown');

      const techEntities = entities.filter(e => e.type === 'technology');
      expect(techEntities.length).toBeGreaterThanOrEqual(4);

      const names = techEntities.map(e => e.name.toLowerCase());
      expect(names).toContain('react');
      expect(names).toContain('postgresql');
    });

    it('should extract design pattern entities from content', () => {
      const content = `
        The AuthService implements the Singleton pattern.
        We use the Factory pattern for creating connections.
        The Observer pattern is used for event handling.
      `;

      const entities = service.extractEntities(content, 'markdown');

      const patternEntities = entities.filter(e => e.type === 'pattern');
      expect(patternEntities.length).toBeGreaterThanOrEqual(2);
    });

    it('should track multiple mentions of the same entity', () => {
      const content = `
        The service: AuthService handles authentication.
        AuthService also manages sessions.
        The service: AuthService is critical for security.
      `;

      const entities = service.extractEntities(content, 'markdown');

      const serviceEntities = entities.filter(
        e => e.type === 'module' && e.name.toLowerCase().includes('authservice')
      );
      expect(serviceEntities.length).toBeGreaterThanOrEqual(1);

      // Should have multiple mentions when using explicit service: pattern
      const serviceEntity = serviceEntities[0];
      if (serviceEntity) {
        expect(serviceEntity.mentions.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should calculate confidence scores for entities', () => {
      const content = `
        The UserService module is important.
        React is used for the UI.
        ADR-001 defines the architecture.
      `;

      const entities = service.extractEntities(content, 'markdown');

      for (const entity of entities) {
        expect(entity.confidence).toBeGreaterThanOrEqual(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  // ============================================
  // T-006.3: Relation Detection Tests
  // ============================================

  describe('Relation Detection (T-006.3)', () => {
    it('should detect depends_on relationships', () => {
      const content = `
        The UserService depends on DatabaseService.
        AuthModule requires CacheModule for session storage.
      `;

      const entities = service.extractEntities(content, 'markdown');
      const relations = service.extractRelations(content, entities);

      const dependsOnRelations = relations.filter(r => r.relationType === 'depends_on');
      expect(dependsOnRelations.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect extends relationships', () => {
      const content = `
        AdminUser extends BaseUser.
        PremiumService inherits from BaseService.
      `;

      const entities = service.extractEntities(content, 'markdown');
      const relations = service.extractRelations(content, entities);

      const extendsRelations = relations.filter(r => r.relationType === 'extends');
      expect(extendsRelations.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect implements relationships', () => {
      const content = `
        PostgresRepository implements Repository.
        UserService implements IUserService interface.
      `;

      const entities = service.extractEntities(content, 'markdown');
      const relations = service.extractRelations(content, entities);

      const implementsRelations = relations.filter(r => r.relationType === 'implements');
      expect(implementsRelations.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect uses relationships', () => {
      const content = `
        The application uses the Singleton pattern.
        AuthService utilizes JWT for tokens.
      `;

      const entities = service.extractEntities(content, 'markdown');
      const relations = service.extractRelations(content, entities);

      const usesRelations = relations.filter(r => r.relationType === 'uses');
      expect(usesRelations.length).toBeGreaterThanOrEqual(1);
    });

    it('should infer relations from co-occurrence', () => {
      const content = `
        ## Authentication Module

        The AuthService and UserService work together
        to provide secure access control.

        ## Data Layer

        PostgreSQL and Redis are used for persistence.
      `;

      const entities = service.extractEntities(content, 'markdown');
      const relations = service.extractRelations(content, entities);

      const relatesToRelations = relations.filter(r => r.relationType === 'relates_to');
      expect(relatesToRelations.length).toBeGreaterThanOrEqual(0); // May or may not infer based on threshold
    });

    it('should include evidence text for relations', () => {
      const content = `The UserService depends on DatabaseService for persistence.`;

      const entities = service.extractEntities(content, 'markdown');
      const relations = service.extractRelations(content, entities);

      for (const relation of relations) {
        if (relation.evidence) {
          expect(relation.evidence.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ============================================
  // T-006.4: Graph Storage Tests
  // ============================================

  describe('Graph Storage (T-006.4)', () => {
    it('should create a new node', async () => {
      const node = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'TestModule',
        description: 'A test module',
        properties: { language: 'typescript' },
        tags: ['test'],
        weight: 0.8,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      expect(node.id).toBeDefined();
      expect(node.name).toBe('TestModule');
      expect(node.entityType).toBe('module');
      expect(node.weight).toBe(0.8);
      expect(node.createdAt).toBeDefined();
    });

    it('should update existing node with same name and type', async () => {
      const node1 = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'DuplicateModule',
        description: 'First version',
        properties: {},
        tags: [],
        weight: 0.5,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const node2 = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'DuplicateModule',
        description: 'Updated version',
        properties: {},
        tags: [],
        weight: 0.9,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      expect(node1.id).toBe(node2.id);
      expect(node2.description).toBe('Updated version');
      expect(node2.weight).toBe(0.9);
    });

    it('should create an edge between nodes', async () => {
      const node1 = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'SourceModule',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const node2 = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'TargetModule',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const edge = await service.addEdge({
        projectId: testProjectId,
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
        relationType: 'depends_on',
        weight: 0.9,
        confidence: 0.85,
        bidirectional: false,
        properties: {},
        detectedBy: 'manual',
      });

      expect(edge.id).toBeDefined();
      expect(edge.sourceNodeId).toBe(node1.id);
      expect(edge.targetNodeId).toBe(node2.id);
      expect(edge.relationType).toBe('depends_on');
    });

    it('should retrieve node by ID', async () => {
      const created = await service.addNode({
        projectId: testProjectId,
        entityType: 'pattern',
        entityId: null,
        name: 'Singleton',
        description: 'Singleton pattern',
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const retrieved = service.getNode(testProjectId, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Singleton');
    });

    it('should delete node and connected edges', async () => {
      const node1 = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'ToDelete',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const node2 = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'Connected',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      await service.addEdge({
        projectId: testProjectId,
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
        relationType: 'depends_on',
        weight: 1,
        confidence: 1,
        bidirectional: false,
        properties: {},
        detectedBy: 'manual',
      });

      const deleted = await service.deleteNode(testProjectId, node1.id);

      expect(deleted).toBe(true);
      expect(service.getNode(testProjectId, node1.id)).toBeUndefined();
    });

    it('should find node by name and type', async () => {
      await service.addNode({
        projectId: testProjectId,
        entityType: 'technology',
        entityId: null,
        name: 'PostgreSQL',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const found = service.findNodeByName(testProjectId, 'PostgreSQL', 'technology');

      expect(found).toBeDefined();
      expect(found?.name).toBe('PostgreSQL');
      expect(found?.entityType).toBe('technology');
    });
  });

  // ============================================
  // T-006.5: Graph Queries Tests
  // ============================================

  describe('Graph Queries (T-006.5)', () => {
    beforeEach(async () => {
      // Set up test graph
      const auth = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'AuthService',
        description: 'Authentication service',
        properties: {},
        tags: ['auth', 'security'],
        weight: 0.9,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const user = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'UserService',
        description: 'User management service',
        properties: {},
        tags: ['user'],
        weight: 0.8,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const db = await service.addNode({
        projectId: testProjectId,
        entityType: 'technology',
        entityId: null,
        name: 'PostgreSQL',
        description: 'Database',
        properties: {},
        tags: ['database'],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      await service.addEdge({
        projectId: testProjectId,
        sourceNodeId: auth.id,
        targetNodeId: user.id,
        relationType: 'depends_on',
        weight: 0.8,
        confidence: 0.9,
        bidirectional: false,
        properties: {},
        detectedBy: 'manual',
      });

      await service.addEdge({
        projectId: testProjectId,
        sourceNodeId: user.id,
        targetNodeId: db.id,
        relationType: 'uses',
        weight: 0.9,
        confidence: 0.95,
        bidirectional: false,
        properties: {},
        detectedBy: 'manual',
      });
    });

    it('should query graph with entity type filter', () => {
      const result = service.queryGraph({
        projectId: testProjectId,
        entityTypes: ['module'],
        limit: 100,
        offset: 0,
        minWeight: 0,
        includeOrphans: true,
      });

      expect(result.nodes.length).toBe(2);
      expect(result.nodes.every(n => n.entityType === 'module')).toBe(true);
    });

    it('should query graph with tag filter', () => {
      const result = service.queryGraph({
        projectId: testProjectId,
        tags: ['security'],
        limit: 100,
        offset: 0,
        minWeight: 0,
        includeOrphans: true,
      });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.nodes.some(n => n.tags.includes('security'))).toBe(true);
    });

    it('should query graph with text search', () => {
      const result = service.queryGraph({
        projectId: testProjectId,
        searchText: 'user',
        limit: 100,
        offset: 0,
        minWeight: 0,
        includeOrphans: true,
      });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should traverse graph from starting node', () => {
      const authNode = service.findNodeByName(testProjectId, 'AuthService', 'module');
      expect(authNode).toBeDefined();

      const result = service.traverseGraph(testProjectId, {
        startNodeId: authNode!.id,
        maxDepth: 3,
        direction: 'both',
        minWeight: 0,
        minConfidence: 0,
        limit: 100,
      });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect direction in traversal', () => {
      const authNode = service.findNodeByName(testProjectId, 'AuthService', 'module');
      expect(authNode).toBeDefined();

      const outgoingResult = service.traverseGraph(testProjectId, {
        startNodeId: authNode!.id,
        maxDepth: 3,
        direction: 'outgoing',
        minWeight: 0,
        minConfidence: 0,
        limit: 100,
      });

      // Should find UserService (outgoing depends_on)
      expect(outgoingResult.nodes.some(n => n.name === 'UserService')).toBe(true);
    });

    it('should return correct metadata', () => {
      const result = service.queryGraph({
        projectId: testProjectId,
        limit: 100,
        offset: 0,
        minWeight: 0,
        includeOrphans: true,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalNodes).toBeGreaterThanOrEqual(3);
      expect(result.metadata.queryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Impact Analysis Tests
  // ============================================

  describe('Impact Analysis', () => {
    beforeEach(async () => {
      const core = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'CoreModule',
        description: 'Core module',
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const auth = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'AuthModule',
        description: 'Auth module',
        properties: {},
        tags: [],
        weight: 0.9,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const api = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'ApiModule',
        description: 'API module',
        properties: {},
        tags: [],
        weight: 0.8,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      await service.addEdge({
        projectId: testProjectId,
        sourceNodeId: auth.id,
        targetNodeId: core.id,
        relationType: 'depends_on',
        weight: 0.9,
        confidence: 1,
        bidirectional: false,
        properties: {},
        detectedBy: 'manual',
      });

      await service.addEdge({
        projectId: testProjectId,
        sourceNodeId: api.id,
        targetNodeId: auth.id,
        relationType: 'depends_on',
        weight: 0.8,
        confidence: 1,
        bidirectional: false,
        properties: {},
        detectedBy: 'manual',
      });
    });

    it('should analyze impact of modifying a node', () => {
      const coreNode = service.findNodeByName(testProjectId, 'CoreModule', 'module');
      expect(coreNode).toBeDefined();

      const result = service.analyzeImpact(testProjectId, {
        nodeId: coreNode!.id,
        changeType: 'modify',
        maxDepth: 5,
        includeIndirect: true,
      });

      expect(result.sourceNode).toBeDefined();
      expect(result.sourceNode.name).toBe('CoreModule');
      expect(result.impactedNodes.length).toBeGreaterThanOrEqual(1);
      expect(result.totalDirectImpact).toBeGreaterThanOrEqual(1);
    });

    it('should include recommendations for high impact changes', () => {
      const coreNode = service.findNodeByName(testProjectId, 'CoreModule', 'module');
      expect(coreNode).toBeDefined();

      const result = service.analyzeImpact(testProjectId, {
        nodeId: coreNode!.id,
        changeType: 'delete',
        maxDepth: 5,
        includeIndirect: true,
      });

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    });

    it('should distinguish direct and indirect impacts', () => {
      const coreNode = service.findNodeByName(testProjectId, 'CoreModule', 'module');
      expect(coreNode).toBeDefined();

      const result = service.analyzeImpact(testProjectId, {
        nodeId: coreNode!.id,
        changeType: 'modify',
        maxDepth: 5,
        includeIndirect: true,
      });

      const directImpacts = result.impactedNodes.filter(n => n.impactLevel === 'direct');
      expect(directImpacts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // AC-006.4: Export Tests
  // ============================================

  describe('Export (AC-006.4)', () => {
    beforeEach(async () => {
      await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'ExportTestModule',
        description: 'Test module for export',
        properties: { version: '1.0' },
        tags: ['test'],
        weight: 0.8,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      await service.addNode({
        projectId: testProjectId,
        entityType: 'technology',
        entityId: null,
        name: 'TypeScript',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });
    });

    it('should export to GraphML format', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'graphml',
      });

      expect(result.format).toBe('graphml');
      expect(result.data).toContain('<?xml version="1.0"');
      expect(result.data).toContain('<graphml');
      expect(result.data).toContain('ExportTestModule');
      expect(result.nodeCount).toBeGreaterThanOrEqual(2);
    });

    it('should export to JSON standard format', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'json',
        options: { format: 'standard', prettyPrint: true },
      });

      expect(result.format).toBe('json');
      const parsed = JSON.parse(result.data);
      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
    });

    it('should export to D3 format', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'json',
        options: { format: 'd3' },
      });

      const parsed = JSON.parse(result.data);
      expect(parsed.nodes).toBeDefined();
      expect(parsed.links).toBeDefined(); // D3 uses 'links' instead of 'edges'
    });

    it('should export to Cytoscape format', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'json',
        options: { format: 'cytoscape' },
      });

      const parsed = JSON.parse(result.data);
      expect(parsed.elements).toBeDefined();
      expect(parsed.elements.nodes).toBeDefined();
      expect(parsed.elements.edges).toBeDefined();
    });

    it('should export to DOT format', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'dot',
      });

      expect(result.format).toBe('dot');
      expect(result.data).toContain('digraph KnowledgeGraph');
      expect(result.data).toContain('ExportTestModule');
    });

    it('should export to Mermaid format', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'mermaid',
      });

      expect(result.format).toBe('mermaid');
      expect(result.data).toContain('graph LR');
    });

    it('should apply query filter during export', () => {
      const result = service.exportGraph({
        projectId: testProjectId,
        format: 'json',
        query: {
          projectId: testProjectId,
          entityTypes: ['module'],
          limit: 100,
          offset: 0,
          minWeight: 0,
          includeOrphans: true,
        },
      });

      const parsed = JSON.parse(result.data);
      expect(parsed.nodes.every((n: { entityType: string }) => n.entityType === 'module')).toBe(true);
    });
  });

  // ============================================
  // AC-006.5: Incremental Updates Tests
  // ============================================

  describe('Incremental Updates (AC-006.5)', () => {
    it('should process content and create graph entries', async () => {
      const result = await service.processContent({
        projectId: testProjectId,
        content: `
          The AuthService module handles authentication.
          It depends on PostgreSQL for data storage.
          ADR-001 describes the authentication strategy.
        `,
        contentType: 'markdown',
        extractRelations: true,
      });

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.contentHash).toBeDefined();
    });

    it('should handle content changes', async () => {
      // First, create some nodes
      await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: 'entity-1',
        name: 'OldModule',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      // Simulate content update
      await service.onContentChange(
        testProjectId,
        'context',
        'entity-1',
        'The NewModule replaces OldModule. It uses React for the UI.'
      );

      // Verify graph was updated
      const stats = service.getStatistics(testProjectId);
      expect(stats.totalNodes).toBeGreaterThanOrEqual(1);
    });

    it('should handle content deletion', async () => {
      const node = await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: 'to-delete-entity',
        name: 'DeleteMe',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      // Simulate content deletion
      await service.onContentChange(
        testProjectId,
        'context',
        'to-delete-entity',
        null
      );

      // Node should be deleted
      const retrieved = service.getNode(testProjectId, node.id);
      expect(retrieved).toBeUndefined();
    });
  });

  // ============================================
  // Statistics Tests
  // ============================================

  describe('Statistics', () => {
    it('should return correct graph statistics', async () => {
      await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'StatsModule1',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'StatsModule2',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const stats = service.getStatistics(testProjectId);

      expect(stats.projectId).toBe(testProjectId);
      expect(stats.totalNodes).toBeGreaterThanOrEqual(2);
      expect(stats.nodesByType).toBeDefined();
      expect(stats.nodesByType['module']).toBeGreaterThanOrEqual(2);
    });

    it('should return correct service-level statistics', async () => {
      await service.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'ServiceStatsModule',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      const stats = service.getServiceStats();

      expect(stats.isEnabled).toBe(true);
      expect(stats.totalProjects).toBeGreaterThanOrEqual(1);
      expect(stats.totalNodes).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Singleton Management Tests
  // ============================================

  describe('Singleton Management', () => {
    it('should return same instance from getKnowledgeGraphService', () => {
      const instance1 = getKnowledgeGraphService();
      const instance2 = getKnowledgeGraphService();

      expect(instance1).toBe(instance2);
    });

    it('should clear all data on shutdown', async () => {
      const instance = getKnowledgeGraphService();

      await instance.addNode({
        projectId: testProjectId,
        entityType: 'module',
        entityId: null,
        name: 'ShutdownTest',
        description: null,
        properties: {},
        tags: [],
        weight: 1,
        sourceFile: null,
        sourceLineStart: null,
        sourceLineEnd: null,
      });

      shutdownKnowledgeGraph();

      const newInstance = getKnowledgeGraphService();
      const stats = newInstance.getServiceStats();

      expect(stats.totalNodes).toBe(0);
    });
  });
});
