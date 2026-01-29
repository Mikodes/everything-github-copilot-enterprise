import * as vscode from 'vscode';
import {
  getMemoryBankApiClient,
  SearchResult,
  ContextEntry,
  DetectedContext,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '../services/MemoryBankApiClient';

/**
 * Conversation history item for context tracking (AC-007.4)
 */
interface ConversationItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  referencedEntries?: string[];
}

/**
 * Session context for maintaining conversation state
 */
interface SessionContext {
  conversationHistory: ConversationItem[];
  recentSearches: string[];
  relevantContextIds: Set<string>;
  lastAutoDetect?: DetectedContext[];
}

/**
 * Memory Bank Chat Participant for GitHub Copilot Chat
 * Implements US-007: Allows developers to query Memory Bank context directly from chat
 */
export class MemoryBankChatParticipant {
  private static readonly PARTICIPANT_ID = 'memory-bank';
  private static readonly MAX_HISTORY_ITEMS = 10;
  private static readonly MAX_SEARCH_RESULTS = 5;

  private participant: vscode.ChatParticipant | null = null;
  private sessionContexts: Map<string, SessionContext> = new Map();

  /**
   * Register the chat participant with VS Code (T-007.1)
   */
  register(context: vscode.ExtensionContext): void {
    // Create the chat participant
    this.participant = vscode.chat.createChatParticipant(
      `egce.${MemoryBankChatParticipant.PARTICIPANT_ID}`,
      this.handleRequest.bind(this)
    );

    // Set participant metadata
    this.participant.iconPath = new vscode.ThemeIcon('database');

    // Handle follow-up requests (AC-007.4)
    this.participant.followupProvider = {
      provideFollowups: this.provideFollowups.bind(this),
    };

    context.subscriptions.push(this.participant);

    console.log('Memory Bank Chat Participant registered');
  }

  /**
   * Main request handler for chat messages (T-007.2)
   * Processes natural language queries (AC-007.2)
   */
  private async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const sessionId = this.getSessionId(context);
    const sessionContext = this.getOrCreateSessionContext(sessionId);
    const apiClient = getMemoryBankApiClient();

    // Record user message in conversation history (T-007.5)
    this.addToHistory(sessionContext, 'user', request.prompt);

    // Parse the intent from the query
    const intent = this.parseIntent(request.prompt);

    try {
      switch (intent.type) {
        case 'search':
          return await this.handleSearchQuery(
            intent.query,
            sessionContext,
            stream,
            token
          );

        case 'context':
          return await this.handleContextQuery(sessionContext, stream, token);

        case 'decisions':
          return await this.handleDecisionsQuery(
            intent.query,
            sessionContext,
            stream,
            token
          );

        case 'patterns':
          return await this.handlePatternsQuery(
            intent.query,
            sessionContext,
            stream,
            token
          );

        case 'graph':
          return await this.handleGraphQuery(
            intent.query,
            sessionContext,
            stream,
            token
          );

        case 'help':
          return this.handleHelpQuery(stream);

        default:
          // Default to semantic search
          return await this.handleSearchQuery(
            request.prompt,
            sessionContext,
            stream,
            token
          );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stream.markdown(`⚠️ **Error**: ${errorMessage}\n\nPlease try again or check that the Memory Bank service is running.`);
      return { errorDetails: { message: errorMessage } };
    }
  }

  /**
   * Parse user intent from natural language query (AC-007.2)
   */
  private parseIntent(prompt: string): { type: string; query: string } {
    const promptLower = prompt.toLowerCase().trim();

    // Help intent
    if (promptLower === 'help' || promptLower === '?' || promptLower.startsWith('how to')) {
      return { type: 'help', query: prompt };
    }

    // Context detection intent
    if (
      promptLower.includes('current context') ||
      promptLower.includes('what am i working on') ||
      promptLower.includes('detect context') ||
      promptLower === 'context'
    ) {
      return { type: 'context', query: prompt };
    }

    // Decisions/ADR intent
    if (
      promptLower.includes('decision') ||
      promptLower.includes('adr') ||
      promptLower.includes('architecture decision')
    ) {
      return { type: 'decisions', query: prompt };
    }

    // Patterns intent
    if (
      promptLower.includes('pattern') ||
      promptLower.includes('best practice') ||
      promptLower.includes('how should i')
    ) {
      return { type: 'patterns', query: prompt };
    }

    // Knowledge graph intent
    if (
      promptLower.includes('related to') ||
      promptLower.includes('connections') ||
      promptLower.includes('relationships') ||
      promptLower.startsWith('graph')
    ) {
      return { type: 'graph', query: prompt };
    }

    // Default: search
    return { type: 'search', query: prompt };
  }

  /**
   * Handle semantic search queries (T-007.3)
   */
  private async handleSearchQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const apiClient = getMemoryBankApiClient();

    stream.progress('Searching Memory Bank...');

    const response = await apiClient.search(query, {
      limit: MemoryBankChatParticipant.MAX_SEARCH_RESULTS,
      includeHighlights: true,
    });

    if (token.isCancellationRequested) {
      return {};
    }

    // Track the search
    sessionContext.recentSearches.push(query);
    if (sessionContext.recentSearches.length > 5) {
      sessionContext.recentSearches.shift();
    }

    // Format response (T-007.4)
    if (response.results.length === 0) {
      stream.markdown(this.formatNoResultsResponse(query));
      this.addToHistory(sessionContext, 'assistant', 'No results found');
      return {};
    }

    const formattedResponse = this.formatSearchResults(response.results, query);
    stream.markdown(formattedResponse);

    // Add file references (AC-007.5)
    this.addReferences(stream, response.results);

    // Track referenced entries for context
    for (const result of response.results) {
      sessionContext.relevantContextIds.add(result.entry.id);
    }

    this.addToHistory(
      sessionContext,
      'assistant',
      `Found ${response.results.length} results`,
      response.results.map((r) => r.entry.id)
    );

    return {
      metadata: {
        resultCount: response.results.length,
        searchTime: response.took,
        cached: response.cached,
      },
    };
  }

  /**
   * Handle automatic context detection
   */
  private async handleContextQuery(
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const apiClient = getMemoryBankApiClient();

    stream.progress('Detecting current context...');

    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    const response = await apiClient.autoDetectContext(activeFile);

    if (token.isCancellationRequested) {
      return {};
    }

    sessionContext.lastAutoDetect = response.suggestedContexts;

    const formattedResponse = this.formatContextDetectionResults(response);
    stream.markdown(formattedResponse);

    this.addToHistory(sessionContext, 'assistant', 'Detected context');

    return {
      metadata: {
        contextCount: response.suggestedContexts.length,
        detectionTime: response.metadata.detectionTimeMs,
      },
    };
  }

  /**
   * Handle ADR/decision queries
   */
  private async handleDecisionsQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const apiClient = getMemoryBankApiClient();

    stream.progress('Searching architecture decisions...');

    const response = await apiClient.search(query, {
      types: ['adr', 'decision'],
      limit: MemoryBankChatParticipant.MAX_SEARCH_RESULTS,
    });

    if (token.isCancellationRequested) {
      return {};
    }

    if (response.results.length === 0) {
      // Try to get all ADRs if search returned nothing
      const allAdrs = await apiClient.getEntriesByType('adr', 5);
      if (allAdrs.length > 0) {
        const formattedResponse = this.formatDecisionsList(allAdrs, query);
        stream.markdown(formattedResponse);
        return { metadata: { resultCount: allAdrs.length } };
      }

      stream.markdown(this.formatNoResultsResponse(query, 'architecture decisions'));
      return {};
    }

    const formattedResponse = this.formatDecisionsResults(response.results, query);
    stream.markdown(formattedResponse);
    this.addReferences(stream, response.results);

    return { metadata: { resultCount: response.results.length } };
  }

  /**
   * Handle pattern queries
   */
  private async handlePatternsQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const apiClient = getMemoryBankApiClient();

    stream.progress('Searching patterns and best practices...');

    const response = await apiClient.search(query, {
      types: ['pattern', 'knowledge'],
      limit: MemoryBankChatParticipant.MAX_SEARCH_RESULTS,
    });

    if (token.isCancellationRequested) {
      return {};
    }

    if (response.results.length === 0) {
      stream.markdown(this.formatNoResultsResponse(query, 'patterns'));
      return {};
    }

    const formattedResponse = this.formatPatternsResults(response.results, query);
    stream.markdown(formattedResponse);
    this.addReferences(stream, response.results);

    return { metadata: { resultCount: response.results.length } };
  }

  /**
   * Handle knowledge graph queries
   */
  private async handleGraphQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const apiClient = getMemoryBankApiClient();

    stream.progress('Querying knowledge graph...');

    const response = await apiClient.queryKnowledgeGraph(query);

    if (token.isCancellationRequested) {
      return {};
    }

    if (response.nodes.length === 0) {
      stream.markdown(this.formatNoResultsResponse(query, 'knowledge graph'));
      return {};
    }

    const formattedResponse = this.formatGraphResults(response.nodes, response.edges, query);
    stream.markdown(formattedResponse);

    return {
      metadata: {
        nodeCount: response.nodes.length,
        edgeCount: response.edges.length,
      },
    };
  }

  /**
   * Handle help queries
   */
  private handleHelpQuery(stream: vscode.ChatResponseStream): vscode.ChatResult {
    const helpText = `# Memory Bank Help

The **@memory-bank** participant helps you access your project's Memory Bank context directly from Copilot Chat.

## Available Queries

| Query Type | Example |
|------------|---------|
| **Search** | \`@memory-bank authentication flow\` |
| **Context** | \`@memory-bank what am I working on?\` |
| **Decisions** | \`@memory-bank show ADRs about caching\` |
| **Patterns** | \`@memory-bank what patterns should I use for API calls?\` |
| **Relationships** | \`@memory-bank what is related to the user module?\` |

## Tips

- Use natural language queries for best results
- Ask follow-up questions to drill deeper
- Reference specific modules or features for focused results
- Use "context" to see auto-detected relevant information

## Examples

- \`@memory-bank how does payment processing work?\`
- \`@memory-bank why did we choose PostgreSQL?\`
- \`@memory-bank best practices for error handling\`
- \`@memory-bank current context\`
`;

    stream.markdown(helpText);
    return {};
  }

  /**
   * Format search results as Markdown (T-007.4)
   */
  private formatSearchResults(results: SearchResult[], query: string): string {
    let markdown = `## Memory Bank Results\n\n`;
    markdown += `Found **${results.length}** results for "${query}"\n\n`;

    for (const result of results) {
      markdown += this.formatResultEntry(result);
    }

    return markdown;
  }

  /**
   * Format a single result entry
   */
  private formatResultEntry(result: SearchResult): string {
    const { entry, similarity, highlights } = result;
    const relevancePercent = Math.round(similarity * 100);
    const typeEmoji = this.getTypeEmoji(entry.type);

    let markdown = `### ${typeEmoji} ${entry.title}\n\n`;
    markdown += `**Type**: ${entry.type} | **Relevance**: ${relevancePercent}%`;

    if (entry.tags.length > 0) {
      markdown += ` | **Tags**: ${entry.tags.map((t) => `\`${t}\``).join(', ')}`;
    }
    markdown += '\n\n';

    // Add highlights or content preview
    if (highlights.length > 0) {
      markdown += '> ';
      markdown += highlights
        .slice(0, 2)
        .map((h) => h.text)
        .join('\n> ');
      markdown += '\n\n';
    } else if (entry.content) {
      const preview = entry.content.substring(0, 300).replace(/\n/g, ' ');
      markdown += `> ${preview}${entry.content.length > 300 ? '...' : ''}\n\n`;
    }

    markdown += '---\n\n';
    return markdown;
  }

  /**
   * Format no results response
   */
  private formatNoResultsResponse(query: string, type?: string): string {
    const typeText = type ? ` in ${type}` : '';
    return `## No Results Found

No matching entries found${typeText} for "${query}".

### Suggestions

- Try different keywords or phrasing
- Use broader search terms
- Check if the Memory Bank has been initialized
- Use \`@memory-bank help\` to see available query types
`;
  }

  /**
   * Format context detection results
   */
  private formatContextDetectionResults(response: {
    suggestedContexts: DetectedContext[];
    primaryContext: DetectedContext | null;
    metadata: { detectionTimeMs: number; sourcesUsed: string[] };
  }): string {
    let markdown = `## Current Context\n\n`;

    if (response.primaryContext) {
      markdown += `### Primary Context\n\n`;
      markdown += `**${response.primaryContext.title}** (${response.primaryContext.type})\n`;
      markdown += `*Confidence*: ${Math.round(response.primaryContext.confidence * 100)}%\n`;
      markdown += `*Reason*: ${response.primaryContext.reason}\n\n`;
    }

    if (response.suggestedContexts.length > 0) {
      markdown += `### Suggested Contexts\n\n`;
      for (const ctx of response.suggestedContexts) {
        const confidence = Math.round(ctx.confidence * 100);
        markdown += `- **${ctx.title}** (${ctx.type}) - ${confidence}% confidence\n`;
        markdown += `  *${ctx.reason}*\n`;
      }
      markdown += '\n';
    } else {
      markdown += `No specific context detected. Try opening a file or checking out a feature branch.\n\n`;
    }

    markdown += `---\n*Detection took ${response.metadata.detectionTimeMs}ms using: ${response.metadata.sourcesUsed.join(', ') || 'local files'}*`;

    return markdown;
  }

  /**
   * Format ADR/decision results
   */
  private formatDecisionsResults(results: SearchResult[], query: string): string {
    let markdown = `## Architecture Decisions\n\n`;
    markdown += `Found **${results.length}** decisions related to "${query}"\n\n`;

    for (const result of results) {
      const { entry, similarity } = result;
      const relevancePercent = Math.round(similarity * 100);
      const status = (entry.metadata?.status as string) ?? 'unknown';

      markdown += `### 📋 ${entry.title}\n\n`;
      markdown += `**Status**: ${this.formatDecisionStatus(status)} | **Relevance**: ${relevancePercent}%\n\n`;

      // Extract decision summary from content
      const decisionMatch = entry.content.match(/##\s*Decision\s*\n+([\s\S]*?)(?=\n##|$)/i);
      if (decisionMatch) {
        const summary = decisionMatch[1].trim().substring(0, 500);
        markdown += `> ${summary}${decisionMatch[1].length > 500 ? '...' : ''}\n\n`;
      }

      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * Format decisions list
   */
  private formatDecisionsList(entries: ContextEntry[], query: string): string {
    let markdown = `## Architecture Decisions\n\n`;
    markdown += `Showing recent architecture decisions (query: "${query}")\n\n`;

    for (const entry of entries) {
      const status = (entry.metadata?.status as string) ?? 'active';
      markdown += `- ${this.formatDecisionStatus(status)} **${entry.title}**\n`;
    }

    return markdown;
  }

  /**
   * Format pattern results
   */
  private formatPatternsResults(results: SearchResult[], query: string): string {
    let markdown = `## Patterns & Best Practices\n\n`;
    markdown += `Found **${results.length}** patterns related to "${query}"\n\n`;

    for (const result of results) {
      const { entry, similarity } = result;
      const relevancePercent = Math.round(similarity * 100);

      markdown += `### 🎯 ${entry.title}\n\n`;
      markdown += `**Relevance**: ${relevancePercent}%`;

      if (entry.tags.length > 0) {
        markdown += ` | **Tags**: ${entry.tags.map((t) => `\`${t}\``).join(', ')}`;
      }
      markdown += '\n\n';

      // Preview content
      const preview = entry.content
        .replace(/^#.*\n/gm, '')
        .substring(0, 400)
        .trim();
      markdown += `> ${preview}${entry.content.length > 400 ? '...' : ''}\n\n`;

      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * Format knowledge graph results
   */
  private formatGraphResults(
    nodes: KnowledgeGraphNode[],
    edges: KnowledgeGraphEdge[],
    query: string
  ): string {
    let markdown = `## Knowledge Graph Results\n\n`;
    markdown += `Found **${nodes.length}** entities related to "${query}"\n\n`;

    // Group nodes by type
    const nodesByType = new Map<string, KnowledgeGraphNode[]>();
    for (const node of nodes) {
      const typeNodes = nodesByType.get(node.type) ?? [];
      typeNodes.push(node);
      nodesByType.set(node.type, typeNodes);
    }

    for (const [type, typeNodes] of nodesByType) {
      markdown += `### ${this.capitalizeFirst(type)}s\n\n`;
      for (const node of typeNodes) {
        markdown += `- **${node.label}**`;
        if (node.properties.description) {
          markdown += `: ${node.properties.description}`;
        }
        markdown += '\n';
      }
      markdown += '\n';
    }

    // Show key relationships
    if (edges.length > 0) {
      markdown += `### Relationships\n\n`;
      for (const edge of edges.slice(0, 10)) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          markdown += `- ${sourceNode.label} **${edge.relationship}** ${targetNode.label}\n`;
        }
      }
    }

    return markdown;
  }

  /**
   * Add file references to the response (AC-007.5)
   */
  private addReferences(stream: vscode.ChatResponseStream, results: SearchResult[]): void {
    for (const result of results) {
      const filePath = result.entry.metadata?.filePath as string | undefined;
      if (filePath) {
        const uri = vscode.Uri.file(filePath);
        stream.reference(uri);
      }
    }
  }

  /**
   * Provide follow-up suggestions (AC-007.4)
   */
  private provideFollowups(
    result: vscode.ChatResult,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
  ): vscode.ChatFollowup[] {
    const followups: vscode.ChatFollowup[] = [];

    // Get session context for smart followups
    const sessionId = this.getSessionId(context);
    const sessionContext = this.sessionContexts.get(sessionId);

    if (sessionContext?.recentSearches.length) {
      const lastSearch = sessionContext.recentSearches[sessionContext.recentSearches.length - 1];

      followups.push({
        prompt: `Show architecture decisions related to ${lastSearch}`,
        label: '📋 Related Decisions',
      });

      followups.push({
        prompt: `What patterns should I use for ${lastSearch}?`,
        label: '🎯 Related Patterns',
      });

      followups.push({
        prompt: `What is related to ${lastSearch} in the knowledge graph?`,
        label: '🔗 Show Relationships',
      });
    }

    // Always suggest context detection
    followups.push({
      prompt: 'What is my current context?',
      label: '📍 Current Context',
    });

    return followups.slice(0, 4);
  }

  /**
   * Get or create session context
   */
  private getOrCreateSessionContext(sessionId: string): SessionContext {
    let context = this.sessionContexts.get(sessionId);
    if (!context) {
      context = {
        conversationHistory: [],
        recentSearches: [],
        relevantContextIds: new Set(),
      };
      this.sessionContexts.set(sessionId, context);
    }
    return context;
  }

  /**
   * Add item to conversation history (T-007.5)
   */
  private addToHistory(
    context: SessionContext,
    role: 'user' | 'assistant',
    content: string,
    referencedEntries?: string[]
  ): void {
    context.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
      referencedEntries,
    });

    // Trim old history
    while (context.conversationHistory.length > MemoryBankChatParticipant.MAX_HISTORY_ITEMS) {
      context.conversationHistory.shift();
    }
  }

  /**
   * Get session ID from chat context
   */
  private getSessionId(context: vscode.ChatContext): string {
    // Use the history length as a simple session identifier
    // In a real implementation, this would use a proper session ID
    return `session-${context.history.length > 0 ? 'active' : 'new'}`;
  }

  /**
   * Get emoji for entry type
   */
  private getTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      adr: '📋',
      decision: '📋',
      pattern: '🎯',
      knowledge: '📚',
      module: '📦',
      context: '📄',
      glossary: '📖',
    };
    return emojiMap[type] ?? '📄';
  }

  /**
   * Format decision status
   */
  private formatDecisionStatus(status: string): string {
    const statusMap: Record<string, string> = {
      proposed: '🟡 Proposed',
      accepted: '🟢 Accepted',
      deprecated: '🔴 Deprecated',
      superseded: '⚪ Superseded',
      unknown: '⚫ Unknown',
    };
    return statusMap[status.toLowerCase()] ?? status;
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.sessionContexts.clear();
    this.participant?.dispose();
  }
}

// Singleton instance
let chatParticipant: MemoryBankChatParticipant | null = null;

export function getMemoryBankChatParticipant(): MemoryBankChatParticipant {
  if (!chatParticipant) {
    chatParticipant = new MemoryBankChatParticipant();
  }
  return chatParticipant;
}
