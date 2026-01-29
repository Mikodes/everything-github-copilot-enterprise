import * as vscode from 'vscode';

/**
 * Search result from the Memory Bank API
 */
export interface SearchResult {
  entry: ContextEntry;
  similarity: number;
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  field: 'title' | 'content';
  text: string;
  matchedTerms: string[];
}

export interface ContextEntry {
  id: string;
  projectId: string;
  moduleId: string | null;
  type: 'adr' | 'pattern' | 'decision' | 'knowledge' | 'module' | 'context' | 'glossary';
  title: string;
  content: string;
  contentFormat: 'markdown' | 'text' | 'json';
  status: 'active' | 'archived' | 'superseded' | 'draft';
  supersededBy: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  query: string;
  projectId: string;
  semantic?: boolean;
  types?: string[];
  tags?: string[];
  moduleId?: string;
  limit?: number;
  offset?: number;
  minSimilarity?: number;
  includeHighlights?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  semantic: boolean;
  total: number;
  took: number;
  cached: boolean;
}

export interface DetectedContext {
  id: string;
  title: string;
  type: string;
  confidence: number;
  reason: string;
  filePath?: string;
}

export interface AutoDetectResponse {
  suggestedContexts: DetectedContext[];
  primaryContext: DetectedContext | null;
  metadata: {
    detectionTimeMs: number;
    sourcesUsed: string[];
  };
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface GraphQueryResponse {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  query: string;
  took: number;
}

/**
 * API Client for communicating with the Memory Bank backend service
 */
export class MemoryBankApiClient {
  private baseUrl: string;
  private projectId: string;
  private timeout: number;

  constructor() {
    const config = vscode.workspace.getConfiguration('egce');
    this.baseUrl = config.get<string>('memoryServiceUrl', 'http://localhost:3000');
    this.projectId = this.getProjectId();
    this.timeout = config.get<number>('apiTimeout', 10000);
  }

  private getProjectId(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    return 'default-project';
  }

  /**
   * Perform semantic search across the Memory Bank
   */
  async search(query: string, options: Partial<SearchQuery> = {}): Promise<SearchResponse> {
    const searchQuery: SearchQuery = {
      query,
      projectId: this.projectId,
      semantic: true,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      minSimilarity: options.minSimilarity ?? 0.5,
      includeHighlights: true,
      ...options,
    };

    try {
      const response = await this.fetch<SearchResponse>(
        `/api/v1/projects/${this.projectId}/context/search`,
        {
          method: 'POST',
          body: JSON.stringify(searchQuery),
        }
      );

      return response;
    } catch (error) {
      // If backend is not available, fall back to local search
      console.warn('Memory Bank API not available, using local fallback:', error);
      return this.localSearchFallback(query);
    }
  }

  /**
   * Get automatically detected context for the current workspace
   */
  async autoDetectContext(currentFile?: string): Promise<AutoDetectResponse> {
    const activeEditor = vscode.window.activeTextEditor;
    const gitBranch = await this.getGitBranch();

    try {
      const response = await this.fetch<AutoDetectResponse>(
        `/api/v1/auto-detect`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId: 'vscode-user',
            projectId: this.projectId,
            currentFile: currentFile ?? activeEditor?.document.uri.fsPath,
            gitBranch,
          }),
        }
      );

      return response;
    } catch (error) {
      console.warn('Auto-detect API not available:', error);
      return {
        suggestedContexts: [],
        primaryContext: null,
        metadata: { detectionTimeMs: 0, sourcesUsed: [] },
      };
    }
  }

  /**
   * Query the knowledge graph for related concepts
   */
  async queryKnowledgeGraph(query: string): Promise<GraphQueryResponse> {
    try {
      const response = await this.fetch<GraphQueryResponse>(
        `/api/v1/projects/${this.projectId}/knowledge-graph/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            query,
            maxNodes: 20,
            maxDepth: 2,
          }),
        }
      );

      return response;
    } catch (error) {
      console.warn('Knowledge graph API not available:', error);
      return { nodes: [], edges: [], query, took: 0 };
    }
  }

  /**
   * Get a specific context entry by ID
   */
  async getEntry(entryId: string): Promise<ContextEntry | null> {
    try {
      const response = await this.fetch<ContextEntry>(
        `/api/v1/projects/${this.projectId}/context/${entryId}`
      );
      return response;
    } catch {
      return null;
    }
  }

  /**
   * Get entries by type
   */
  async getEntriesByType(type: string, limit = 10): Promise<ContextEntry[]> {
    try {
      const response = await this.fetch<{ entries: ContextEntry[] }>(
        `/api/v1/projects/${this.projectId}/context?type=${type}&limit=${limit}`
      );
      return response.entries ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Local fallback search when API is unavailable
   * Searches .memory-bank files directly
   */
  private async localSearchFallback(query: string): Promise<SearchResponse> {
    const results: SearchResult[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return { results: [], query, semantic: false, total: 0, took: 0, cached: false };
    }

    const startTime = Date.now();
    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');

    const pattern = new vscode.RelativePattern(
      workspaceFolders[0],
      `${memoryBankPath}/**/*.md`
    );

    const files = await vscode.workspace.findFiles(pattern, null, 50);

    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file);
        const content = document.getText();
        const title = this.extractTitle(content) ?? file.fsPath.split('/').pop() ?? 'Untitled';

        // Calculate simple relevance score
        const contentLower = content.toLowerCase();
        const titleLower = title.toLowerCase();
        let score = 0;

        for (const term of queryTerms) {
          if (titleLower.includes(term)) score += 0.5;
          const matches = (contentLower.match(new RegExp(term, 'g')) ?? []).length;
          score += Math.min(matches * 0.1, 0.5);
        }

        if (score > 0) {
          results.push({
            entry: {
              id: file.fsPath,
              projectId: this.projectId,
              moduleId: null,
              type: this.inferType(file.fsPath),
              title,
              content: content.substring(0, 2000),
              contentFormat: 'markdown',
              status: 'active',
              supersededBy: null,
              tags: [],
              metadata: { filePath: file.fsPath },
              version: 1,
              createdBy: null,
              updatedBy: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            similarity: Math.min(score, 1),
            highlights: this.extractHighlights(content, queryTerms),
          });
        }
      } catch (error) {
        console.error('Error reading file:', file.fsPath, error);
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return {
      results: results.slice(0, 10),
      query,
      semantic: false,
      total: results.length,
      took: Date.now() - startTime,
      cached: false,
    };
  }

  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  private inferType(filePath: string): ContextEntry['type'] {
    if (filePath.includes('decisions') || filePath.includes('adr')) return 'adr';
    if (filePath.includes('pattern')) return 'pattern';
    if (filePath.includes('knowledge')) return 'knowledge';
    if (filePath.includes('module')) return 'module';
    if (filePath.includes('glossary')) return 'glossary';
    return 'context';
  }

  private extractHighlights(content: string, queryTerms: string[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 10) continue;

      const matchedTerms: string[] = [];
      for (const term of queryTerms) {
        if (trimmed.toLowerCase().includes(term)) {
          matchedTerms.push(term);
        }
      }

      if (matchedTerms.length > 0) {
        highlights.push({
          field: 'content',
          text: trimmed.substring(0, 200) + (trimmed.length > 200 ? '...' : ''),
          matchedTerms,
        });
        if (highlights.length >= 3) break;
      }
    }

    return highlights;
  }

  private async getGitBranch(): Promise<string | undefined> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        const git = gitExtension.exports.getAPI(1);
        const repo = git.repositories[0];
        return repo?.state?.HEAD?.name;
      }
    } catch {
      // Git extension not available
    }
    return undefined;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Singleton instance
let apiClient: MemoryBankApiClient | null = null;

export function getMemoryBankApiClient(): MemoryBankApiClient {
  if (!apiClient) {
    apiClient = new MemoryBankApiClient();
  }
  return apiClient;
}

export function resetMemoryBankApiClient(): void {
  apiClient = null;
}
