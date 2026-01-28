# Arquitectura del Sistema de Memoria Compartida

> **Estado**: Propuesta Arquitectónica
> **Versión**: 1.0
> **Fecha**: 2026-01-28

---

## 1. Visión General

### 1.1 Problema Actual

El sistema actual de Memory Bank tiene las siguientes **limitaciones críticas**:

```
PROBLEMAS CON FICHEROS MARKDOWN EN GIT
├── Sincronización
│   ├── Sin sync en tiempo real
│   ├── Conflictos de merge frecuentes
│   └── Latencia en equipos distribuidos
├── Búsqueda
│   ├── Solo búsqueda textual (grep/ripgrep)
│   ├── Sin búsqueda semántica
│   └── Sin ranking por relevancia
├── Escalabilidad
│   ├── Repositorios grandes = lento
│   ├── Mucho contexto = token overflow
│   └── Sin paginación inteligente
└── Integración
    ├── Copilot no conoce el Memory Bank nativamente
    ├── Carga manual de contexto
    └── Sin persistencia cross-session
```

### 1.2 Solución Propuesta

Un **sistema híbrido** que combina:

1. **Vector Database** para búsqueda semántica
2. **Real-time Sync** para colaboración
3. **Git Backup** para versionado y auditoria
4. **MCP Server** para integración con Copilot

---

## 2. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EGCE SHARED MEMORY SYSTEM                          │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌────────────────────────────────────┐
                    │         CLIENT LAYER               │
                    └────────────────────────────────────┘

  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │   VS Code    │    │   IntelliJ   │    │    Web       │    │    CLI       │
  │  Extension   │    │    Plugin    │    │  Dashboard   │    │   (egce)     │
  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
         │                   │                   │                   │
         └───────────────────┴───────────────────┴───────────────────┘
                                       │
                                       ▼
                    ┌────────────────────────────────────┐
                    │         GATEWAY LAYER              │
                    └────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
          ┌─────────────────┐                   ┌─────────────────┐
          │   Memory Sync   │                   │   MCP Server    │
          │    Gateway      │                   │   (Copilot)     │
          │  (WebSocket)    │                   │                 │
          └────────┬────────┘                   └────────┬────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                    ┌────────────────────────────────────┐
                    │         SERVICE LAYER              │
                    └────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Context        │         │  Knowledge      │         │  Session        │
│  Service        │         │  Service        │         │  Service        │
│                 │         │                 │         │                 │
│ • Load context  │         │ • Search KB     │         │ • Manage        │
│ • Update context│         │ • Embeddings    │         │   sessions      │
│ • ADR mgmt      │         │ • Ranking       │         │ • Handoffs      │
│ • Validation    │         │ • Suggestions   │         │ • Sync state    │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                    ┌────────────────────────────────────┐
                    │         DATA LAYER                 │
                    └────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Vector Store   │         │  Cache Layer    │         │  Git Storage    │
│  (Pinecone/     │         │  (Redis/Valkey) │         │ (.memory-bank)  │
│   Qdrant)       │         │                 │         │                 │
│                 │         │ • Hot context   │         │ • Version ctrl  │
│ • Embeddings    │         │ • Session state │         │ • Audit trail   │
│ • Semantic      │         │ • Query cache   │         │ • Backup        │
│   search        │         │ • Pub/Sub       │         │ • Offline mode  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## 3. Componentes Principales

### 3.1 Memory Sync Gateway (WebSocket Server)

**Propósito**: Sincronización en tiempo real del contexto entre desarrolladores.

```typescript
// memory-sync-gateway/src/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Redis } from 'ioredis';

interface SyncMessage {
  type: 'context_update' | 'session_start' | 'session_end' | 'presence';
  payload: unknown;
  userId: string;
  teamId: string;
  timestamp: number;
}

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  teamId: string;
  currentModule?: string;
}

export class MemorySyncGateway {
  private wss: WebSocketServer;
  private redis: Redis;
  private clients: Map<string, ConnectedClient> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.redis = new Redis(process.env.REDIS_URL);

    this.setupSubscriptions();
    this.setupWebSocketHandlers();
  }

  private setupSubscriptions(): void {
    // Subscribe to Redis pub/sub for cross-instance sync
    const subscriber = this.redis.duplicate();
    subscriber.subscribe('memory-bank:updates');

    subscriber.on('message', (channel, message) => {
      const update = JSON.parse(message) as SyncMessage;
      this.broadcastToTeam(update.teamId, update);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      const userId = this.authenticateConnection(req);
      const teamId = this.getTeamId(userId);

      this.clients.set(userId, { ws, userId, teamId });

      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString()) as SyncMessage;
        await this.handleMessage(userId, message);
      });

      ws.on('close', () => {
        this.clients.delete(userId);
        this.broadcastPresence(teamId);
      });

      // Send current team state on connect
      this.sendTeamState(userId);
    });
  }

  private async handleMessage(userId: string, message: SyncMessage): Promise<void> {
    switch (message.type) {
      case 'context_update':
        await this.handleContextUpdate(userId, message);
        break;
      case 'session_start':
        await this.handleSessionStart(userId, message);
        break;
      case 'presence':
        await this.handlePresence(userId, message);
        break;
    }
  }

  private async handleContextUpdate(userId: string, message: SyncMessage): Promise<void> {
    // Validate update
    const validation = await this.validateContextUpdate(message.payload);
    if (!validation.valid) {
      this.sendError(userId, validation.errors);
      return;
    }

    // Persist to Git (async, non-blocking)
    this.persistToGit(message);

    // Update cache
    await this.redis.set(
      `context:${message.teamId}:${(message.payload as { module: string }).module}`,
      JSON.stringify(message.payload),
      'EX',
      3600 // 1 hour TTL
    );

    // Update vector store (async)
    this.updateVectorStore(message);

    // Broadcast to team
    await this.redis.publish('memory-bank:updates', JSON.stringify(message));
  }

  private broadcastToTeam(teamId: string, message: SyncMessage): void {
    this.clients.forEach((client) => {
      if (client.teamId === teamId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }
}
```

### 3.2 Vector Store Integration

**Propósito**: Búsqueda semántica del conocimiento del equipo.

```typescript
// memory-services/src/vector-store.ts
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

interface EmbeddingDocument {
  id: string;
  content: string;
  metadata: {
    type: 'context' | 'adr' | 'pattern' | 'troubleshooting';
    module?: string;
    tags: string[];
    lastUpdated: string;
  };
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: EmbeddingDocument['metadata'];
}

export class VectorStoreService {
  private pinecone: Pinecone;
  private openai: OpenAI;
  private indexName: string;

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.indexName = process.env.PINECONE_INDEX || 'memory-bank';
  }

  async upsertDocument(doc: EmbeddingDocument): Promise<void> {
    const embedding = await this.generateEmbedding(doc.content);
    const index = this.pinecone.Index(this.indexName);

    await index.upsert([
      {
        id: doc.id,
        values: embedding,
        metadata: {
          content: doc.content,
          ...doc.metadata,
        },
      },
    ]);
  }

  async semanticSearch(
    query: string,
    options: {
      type?: EmbeddingDocument['metadata']['type'];
      module?: string;
      topK?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const index = this.pinecone.Index(this.indexName);

    // Build filter
    const filter: Record<string, unknown> = {};
    if (options.type) filter.type = options.type;
    if (options.module) filter.module = options.module;

    const results = await index.query({
      vector: queryEmbedding,
      topK: options.topK || 10,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    return results.matches?.map((match) => ({
      id: match.id,
      content: (match.metadata as { content: string }).content,
      score: match.score || 0,
      metadata: match.metadata as SearchResult['metadata'],
    })) || [];
  }

  async findRelatedContext(files: string[]): Promise<SearchResult[]> {
    // Build query from file paths
    const query = files
      .map((f) => f.split('/').pop()?.replace(/\.[^.]+$/, ''))
      .join(' ');

    return this.semanticSearch(query, { topK: 5 });
  }

  async findRelevantADRs(codeSnippet: string): Promise<SearchResult[]> {
    return this.semanticSearch(codeSnippet, {
      type: 'adr',
      topK: 3,
    });
  }

  async findPatterns(description: string): Promise<SearchResult[]> {
    return this.semanticSearch(description, {
      type: 'pattern',
      topK: 5,
    });
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
}
```

### 3.3 Context Service

**Propósito**: Gestión inteligente del contexto del proyecto y módulos.

```typescript
// memory-services/src/context-service.ts
import { Redis } from 'ioredis';
import { VectorStoreService } from './vector-store';
import { GitStorage } from './git-storage';
import { SchemaValidator } from './schema-validator';

interface LoadContextOptions {
  module?: string;
  depth: 'shallow' | 'deep';
  includeRelated?: boolean;
  maxTokens?: number;
}

interface ContextResult {
  projectContext: string;
  moduleContext?: string;
  relatedADRs: string[];
  relevantPatterns: string[];
  tokenCount: number;
}

export class ContextService {
  private redis: Redis;
  private vectorStore: VectorStoreService;
  private gitStorage: GitStorage;
  private validator: SchemaValidator;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.vectorStore = new VectorStoreService();
    this.gitStorage = new GitStorage();
    this.validator = new SchemaValidator();
  }

  async loadContext(options: LoadContextOptions): Promise<ContextResult> {
    const maxTokens = options.maxTokens || 8000; // Safe limit for Copilot
    let tokenCount = 0;

    // 1. Load project context (always included)
    const projectContext = await this.loadProjectContext();
    tokenCount += this.estimateTokens(projectContext);

    // 2. Load module context if specified
    let moduleContext: string | undefined;
    if (options.module) {
      moduleContext = await this.loadModuleContext(options.module, options.depth);
      tokenCount += this.estimateTokens(moduleContext);
    }

    // 3. Find related ADRs (semantic search)
    const relatedADRs: string[] = [];
    if (options.includeRelated && tokenCount < maxTokens * 0.7) {
      const adrs = await this.vectorStore.findRelevantADRs(
        moduleContext || projectContext
      );
      for (const adr of adrs) {
        const tokens = this.estimateTokens(adr.content);
        if (tokenCount + tokens < maxTokens) {
          relatedADRs.push(adr.content);
          tokenCount += tokens;
        }
      }
    }

    // 4. Find relevant patterns
    const relevantPatterns: string[] = [];
    if (tokenCount < maxTokens * 0.85) {
      const patterns = await this.vectorStore.findPatterns(
        moduleContext || projectContext
      );
      for (const pattern of patterns.slice(0, 3)) {
        const tokens = this.estimateTokens(pattern.content);
        if (tokenCount + tokens < maxTokens) {
          relevantPatterns.push(pattern.content);
          tokenCount += tokens;
        }
      }
    }

    return {
      projectContext,
      moduleContext,
      relatedADRs,
      relevantPatterns,
      tokenCount,
    };
  }

  async autoDetectContext(openFiles: string[]): Promise<string[]> {
    // Detect modules from open files
    const modules = new Set<string>();

    for (const file of openFiles) {
      const module = this.extractModuleFromPath(file);
      if (module) modules.add(module);
    }

    // Find semantically related contexts
    const related = await this.vectorStore.findRelatedContext(openFiles);
    for (const result of related) {
      if (result.metadata.module) {
        modules.add(result.metadata.module);
      }
    }

    return Array.from(modules);
  }

  async updateContext(
    type: 'project' | 'module' | 'adr' | 'knowledge',
    data: unknown
  ): Promise<{ success: boolean; errors?: string[] }> {
    // Validate against schema
    const validation = await this.validator.validate(type, data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Update cache
    const cacheKey = this.getCacheKey(type, data);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);

    // Update vector store
    await this.vectorStore.upsertDocument({
      id: cacheKey,
      content: this.extractTextContent(data),
      metadata: {
        type: type === 'adr' ? 'adr' : 'context',
        module: (data as { module?: string }).module,
        tags: this.extractTags(data),
        lastUpdated: new Date().toISOString(),
      },
    });

    // Persist to Git (async)
    this.gitStorage.persist(type, data);

    return { success: true };
  }

  private async loadProjectContext(): Promise<string> {
    // Try cache first
    const cached = await this.redis.get('context:project');
    if (cached) return cached;

    // Load from Git
    const context = await this.gitStorage.loadProjectContext();
    await this.redis.set('context:project', context, 'EX', 3600);

    return context;
  }

  private async loadModuleContext(
    module: string,
    depth: 'shallow' | 'deep'
  ): Promise<string> {
    const cacheKey = `context:module:${module}:${depth}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    // Load base module context
    let context = await this.gitStorage.loadModuleContext(module);

    // For deep loading, include dependencies
    if (depth === 'deep') {
      const dependencies = await this.getModuleDependencies(module);
      for (const dep of dependencies) {
        const depContext = await this.gitStorage.loadModuleContext(dep);
        context += `\n\n## Dependency: ${dep}\n${depContext}`;
      }
    }

    await this.redis.set(cacheKey, context, 'EX', 1800);
    return context;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  private extractModuleFromPath(filePath: string): string | undefined {
    // Example: src/modules/order-service/... -> order-service
    const match = filePath.match(/modules\/([^/]+)/);
    return match?.[1];
  }

  private getCacheKey(type: string, data: unknown): string {
    const id = (data as { id?: string }).id ||
               (data as { name?: string }).name ||
               'default';
    return `context:${type}:${id}`;
  }

  private extractTextContent(data: unknown): string {
    // Extract searchable text from structured data
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  }

  private extractTags(data: unknown): string[] {
    return (data as { tags?: string[] }).tags || [];
  }

  private async getModuleDependencies(module: string): Promise<string[]> {
    const context = await this.gitStorage.loadModuleContext(module);
    // Parse dependencies from context
    const match = context.match(/dependencies:\s*\n([\s\S]*?)(?=\n\n|$)/);
    if (!match) return [];
    return match[1]
      .split('\n')
      .filter((l) => l.trim().startsWith('-'))
      .map((l) => l.replace(/^\s*-\s*/, '').trim());
  }
}
```

### 3.4 EGCE MCP Server

**Propósito**: Exponer el Memory Bank a GitHub Copilot via MCP.

```typescript
// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { ContextService } from '@egce/memory-services';
import { VectorStoreService } from '@egce/memory-services';

const server = new Server(
  {
    name: 'egce-memory-bank',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

const contextService = new ContextService();
const vectorStore = new VectorStoreService();

// ==================== RESOURCES ====================

server.setRequestHandler('resources/list', async () => ({
  resources: [
    {
      uri: 'memory-bank://project/context',
      name: 'Project Context',
      description: 'Complete project context including architecture, tech stack, and conventions',
      mimeType: 'text/markdown',
    },
    {
      uri: 'memory-bank://team/context',
      name: 'Team Context',
      description: 'Team structure, roles, and communication channels',
      mimeType: 'text/markdown',
    },
    {
      uri: 'memory-bank://modules/{module}/context',
      name: 'Module Context',
      description: 'Context for a specific module or bounded context',
      mimeType: 'text/markdown',
    },
    {
      uri: 'memory-bank://decisions',
      name: 'Architecture Decisions',
      description: 'All ADRs with their status and rationale',
      mimeType: 'application/json',
    },
    {
      uri: 'memory-bank://decisions/{id}',
      name: 'Specific ADR',
      description: 'A specific Architecture Decision Record',
      mimeType: 'text/markdown',
    },
    {
      uri: 'memory-bank://patterns',
      name: 'Approved Patterns',
      description: 'Team-approved design patterns with examples',
      mimeType: 'text/markdown',
    },
    {
      uri: 'memory-bank://antipatterns',
      name: 'Antipatterns',
      description: 'Patterns to avoid with explanations',
      mimeType: 'text/markdown',
    },
    {
      uri: 'memory-bank://troubleshooting',
      name: 'Troubleshooting Guide',
      description: 'Common issues and their solutions',
      mimeType: 'text/markdown',
    },
  ],
}));

server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;

  if (uri === 'memory-bank://project/context') {
    const context = await contextService.loadContext({ depth: 'shallow' });
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: context.projectContext,
        },
      ],
    };
  }

  // Handle module context
  const moduleMatch = uri.match(/memory-bank:\/\/modules\/([^/]+)\/context/);
  if (moduleMatch) {
    const context = await contextService.loadContext({
      module: moduleMatch[1],
      depth: 'deep',
      includeRelated: true,
    });
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `${context.moduleContext}\n\n## Related ADRs\n${context.relatedADRs.join('\n\n')}\n\n## Relevant Patterns\n${context.relevantPatterns.join('\n\n')}`,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ==================== TOOLS ====================

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_context',
      description: 'Load context for the project or a specific module. Use this before answering questions about the codebase.',
      inputSchema: {
        type: 'object',
        properties: {
          module: {
            type: 'string',
            description: 'Module name (optional). If not provided, returns project-level context.',
          },
          depth: {
            type: 'string',
            enum: ['shallow', 'deep'],
            default: 'shallow',
            description: 'shallow = just the module, deep = module + dependencies',
          },
          includeRelated: {
            type: 'boolean',
            default: true,
            description: 'Include related ADRs and patterns',
          },
        },
      },
    },
    {
      name: 'search_knowledge',
      description: 'Semantic search in the knowledge base. Use for finding patterns, troubleshooting, or best practices.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query',
          },
          type: {
            type: 'string',
            enum: ['pattern', 'antipattern', 'troubleshooting', 'all'],
            default: 'all',
          },
          limit: {
            type: 'number',
            default: 5,
            description: 'Maximum results to return',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_related_adrs',
      description: 'Find ADRs related to specific files or code. Use when modifying code to ensure compliance with decisions.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'File paths to find related ADRs for',
          },
          codeSnippet: {
            type: 'string',
            description: 'Code snippet to find related ADRs for',
          },
        },
      },
    },
    {
      name: 'check_pattern_compliance',
      description: 'Check if code follows team patterns. Use before suggesting code changes.',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code to check',
          },
          module: {
            type: 'string',
            description: 'Module the code belongs to',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'create_adr',
      description: 'Create a new Architecture Decision Record. Use when significant technical decisions are made.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          context: { type: 'string', description: 'Why is this decision needed?' },
          decision: { type: 'string', description: 'What is the decision?' },
          consequences: { type: 'string', description: 'What are the consequences?' },
          alternatives: {
            type: 'array',
            items: { type: 'string' },
            description: 'Alternatives considered',
          },
        },
        required: ['title', 'context', 'decision'],
      },
    },
    {
      name: 'get_onboarding_guide',
      description: 'Generate personalized onboarding guide for a module or the whole project.',
      inputSchema: {
        type: 'object',
        properties: {
          module: { type: 'string', description: 'Module to onboard to (optional)' },
          experienceLevel: {
            type: 'string',
            enum: ['junior', 'mid', 'senior'],
            default: 'mid',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_context': {
      const context = await contextService.loadContext({
        module: args.module,
        depth: args.depth || 'shallow',
        includeRelated: args.includeRelated ?? true,
      });

      let result = context.projectContext;
      if (context.moduleContext) {
        result += `\n\n## Module: ${args.module}\n${context.moduleContext}`;
      }
      if (context.relatedADRs.length > 0) {
        result += `\n\n## Related Architecture Decisions\n${context.relatedADRs.join('\n\n---\n\n')}`;
      }
      if (context.relevantPatterns.length > 0) {
        result += `\n\n## Relevant Patterns\n${context.relevantPatterns.join('\n\n---\n\n')}`;
      }

      return { content: [{ type: 'text', text: result }] };
    }

    case 'search_knowledge': {
      const results = await vectorStore.semanticSearch(args.query, {
        type: args.type === 'all' ? undefined : args.type,
        topK: args.limit || 5,
      });

      const formatted = results
        .map((r) => `### ${r.metadata.type}: ${r.id} (relevance: ${(r.score * 100).toFixed(1)}%)\n\n${r.content}`)
        .join('\n\n---\n\n');

      return { content: [{ type: 'text', text: formatted || 'No results found.' }] };
    }

    case 'get_related_adrs': {
      let results;
      if (args.codeSnippet) {
        results = await vectorStore.findRelevantADRs(args.codeSnippet);
      } else if (args.files) {
        results = await vectorStore.findRelatedContext(args.files);
      } else {
        return { content: [{ type: 'text', text: 'Please provide files or codeSnippet' }] };
      }

      const adrs = results.filter((r) => r.metadata.type === 'adr');
      const formatted = adrs
        .map((r) => `### ${r.id} (relevance: ${(r.score * 100).toFixed(1)}%)\n\n${r.content}`)
        .join('\n\n---\n\n');

      return { content: [{ type: 'text', text: formatted || 'No related ADRs found.' }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ==================== PROMPTS ====================

server.setRequestHandler('prompts/list', async () => ({
  prompts: [
    {
      name: 'review_with_context',
      description: 'Review code changes considering team standards, patterns, and ADRs',
      arguments: [
        {
          name: 'files',
          description: 'Comma-separated list of files to review',
          required: true,
        },
        {
          name: 'prDescription',
          description: 'PR description for additional context',
          required: false,
        },
      ],
    },
    {
      name: 'implement_feature',
      description: 'Implement a feature following team patterns and conventions',
      arguments: [
        {
          name: 'description',
          description: 'Feature description',
          required: true,
        },
        {
          name: 'module',
          description: 'Target module',
          required: true,
        },
      ],
    },
    {
      name: 'onboard_to_codebase',
      description: 'Generate comprehensive onboarding guide for new team members',
      arguments: [
        {
          name: 'focus',
          description: 'Specific area to focus on (module name or "general")',
          required: false,
        },
      ],
    },
    {
      name: 'document_decision',
      description: 'Help document an architecture decision as an ADR',
      arguments: [
        {
          name: 'topic',
          description: 'Topic of the decision',
          required: true,
        },
      ],
    },
  ],
}));

server.setRequestHandler('prompts/get', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'review_with_context': {
      const context = await contextService.loadContext({
        depth: 'shallow',
        includeRelated: true,
      });

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are reviewing code for this project. Here is the context:

## Project Context
${context.projectContext}

## Team Patterns
${context.relevantPatterns.join('\n\n')}

## Related ADRs
${context.relatedADRs.join('\n\n')}

---

Please review the following files: ${args.files}

${args.prDescription ? `PR Description: ${args.prDescription}` : ''}

Focus on:
1. Compliance with team patterns
2. Adherence to relevant ADRs
3. Security considerations
4. Performance implications
5. Code quality and maintainability`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EGCE Memory Bank MCP Server running on stdio');
}

main().catch(console.error);
```

---

## 4. Esquema de Datos

### 4.1 Vector Store Schema

```yaml
# Pinecone Index Configuration
index_name: memory-bank
dimension: 1536  # text-embedding-3-small
metric: cosine
pods: 1

# Metadata Schema
metadata:
  content: string        # Original text content
  type: enum             # context | adr | pattern | antipattern | troubleshooting
  module: string?        # Associated module
  tags: string[]         # Searchable tags
  lastUpdated: datetime  # Last modification
  author: string?        # Who created/updated
  status: string?        # For ADRs: proposed | accepted | deprecated | superseded
```

### 4.2 Redis Cache Schema

```yaml
# Cache Key Patterns
keys:
  # Project context (TTL: 1 hour)
  context:project: string

  # Module context (TTL: 30 min)
  context:module:{module_name}:shallow: string
  context:module:{module_name}:deep: string

  # Session state (TTL: 8 hours)
  session:{user_id}: object

  # Team presence (TTL: 5 min, refreshed)
  presence:{team_id}: set

  # Query cache (TTL: 15 min)
  query:{hash}: string

# Pub/Sub Channels
channels:
  memory-bank:updates     # Context updates
  memory-bank:presence    # Team presence
  memory-bank:sessions    # Session events
```

---

## 5. Flujos de Datos

### 5.1 Carga de Contexto

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FLUJO: CARGA DE CONTEXTO                               │
└─────────────────────────────────────────────────────────────────────────────┘

Developer abre archivo
        │
        ▼
┌───────────────────┐
│ VS Code Extension │
│ detecta archivo   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Auto-detect       │────▶│ MCP: get_context  │
│ module from path  │     │ tool call         │
└───────────────────┘     └─────────┬─────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          │                                                   │
          ▼                                                   ▼
┌───────────────────┐                               ┌───────────────────┐
│ Check Redis Cache │                               │ Vector Search     │
│ for module        │                               │ for related ADRs  │
└─────────┬─────────┘                               └─────────┬─────────┘
          │                                                   │
    ┌─────┴─────┐                                             │
    │           │                                             │
    ▼           ▼                                             │
┌───────┐  ┌───────────┐                                      │
│ Cache │  │ Git Load  │                                      │
│ Hit   │  │ + Cache   │                                      │
└───┬───┘  └─────┬─────┘                                      │
    │            │                                            │
    └────────────┴────────────────────────────────────────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Merge & Format    │
                  │ Context Response  │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Return to Copilot │
                  │ with token count  │
                  └───────────────────┘
```

### 5.2 Actualización de Contexto

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUJO: ACTUALIZACIÓN DE CONTEXTO                         │
└─────────────────────────────────────────────────────────────────────────────┘

Developer actualiza .memory-bank/
        │
        ▼
┌───────────────────┐
│ File Watcher      │
│ detecta cambio    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Validate against  │
│ JSON Schema       │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐  ┌───────────┐
│ Valid │  │ Invalid   │
│       │  │ → Error   │
└───┬───┘  └───────────┘
    │
    ├──────────────────────────┬──────────────────────────┐
    │                          │                          │
    ▼                          ▼                          ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Update Redis  │    │ Update Vector │    │ WebSocket     │
│ Cache         │    │ Store         │    │ Broadcast     │
└───────────────┘    │ (embeddings)  │    │ to team       │
                     └───────────────┘    └───────────────┘
                              │
                              ▼
                     ┌───────────────┐
                     │ Async: Commit │
                     │ to Git        │
                     └───────────────┘
```

---

## 6. Requisitos de Infraestructura

### 6.1 Servicios Necesarios

| Servicio | Propósito | Opciones | Estimación Costo/mes |
|----------|-----------|----------|---------------------|
| **Vector Database** | Búsqueda semántica | Pinecone, Qdrant Cloud, Weaviate | $70-200 |
| **Cache** | Contexto hot | Redis Cloud, Upstash, Valkey | $0-50 |
| **WebSocket Server** | Real-time sync | Fly.io, Railway, AWS ECS | $20-100 |
| **Embeddings API** | Generación embeddings | OpenAI, Cohere | $10-50 |
| **Git Storage** | Versionado | GitHub, GitLab (existente) | $0 |

### 6.2 Configuración de Desarrollo Local

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant-data:/qdrant/storage

  memory-sync:
    build: ./memory-sync-gateway
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - redis
      - qdrant

  mcp-server:
    build: ./mcp-server
    environment:
      - REDIS_URL=redis://redis:6379
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - redis
      - qdrant

volumes:
  redis-data:
  qdrant-data:
```

---

## 7. Plan de Migración

### Fase 1: Preparación (1 semana)
- [ ] Configurar vector database
- [ ] Configurar Redis
- [ ] Crear scripts de migración

### Fase 2: Migración de Datos (1 semana)
- [ ] Indexar contextos existentes en vector store
- [ ] Poblar cache con contextos frecuentes
- [ ] Validar búsqueda semántica

### Fase 3: Servicios (2 semanas)
- [ ] Desplegar Memory Sync Gateway
- [ ] Desplegar MCP Server
- [ ] Integrar con extensión VS Code

### Fase 4: Rollout (1 semana)
- [ ] Beta con equipo pequeño
- [ ] Monitoreo y ajustes
- [ ] Rollout completo

---

## 8. Consideraciones de Seguridad

1. **Autenticación**: OAuth 2.0 / GitHub OAuth para acceso
2. **Autorización**: RBAC para control de acceso a contextos
3. **Cifrado**: TLS para tránsito, cifrado at-rest para vector store
4. **Audit**: Log de acceso a contexto sensible
5. **Data Residency**: Opción de self-hosted para datos sensibles

---

## Referencias

- [Pinecone Documentation](https://docs.pinecone.io/)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
