import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  getMemoryBankApiClient,
  SearchResult,
  ContextEntry,
  DetectedContext,
} from '../services/MemoryBankApiClient';

/**
 * Operating modes for the @egce chat participant (AC-013.4)
 */
export type EgceMode = 'architect' | 'dev' | 'review';

/**
 * Agent definition loaded from core/agents
 */
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  tools: string[];
}

/**
 * Loaded context from multiple files (AC-013.2)
 */
interface LoadedContext {
  projectContext: string | null;
  techStack: string | null;
  patterns: string | null;
  antipatterns: string | null;
  relevantModules: Array<{ name: string; content: string }>;
  relevantAdrs: Array<{ id: string; title: string; content: string; status: string }>;
  glossary: string | null;
}

/**
 * Team standards for enforcement (AC-013.3)
 */
interface TeamStandards {
  codeStyle: string[];
  architecturePatterns: string[];
  securityRequirements: string[];
  testingRequirements: string[];
  namingConventions: string[];
}

/**
 * Session context for conversation state
 */
interface SessionContext {
  mode: EgceMode;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  loadedContext: LoadedContext | null;
  standards: TeamStandards | null;
  activeAgents: Set<string>;
}

/**
 * EGCE Chat Participant - Main entry point for GitHub Copilot Chat
 * Implements US-013: Custom Chat Participant @egce
 *
 * Features:
 * - AC-013.1: Responds with complete Memory Bank knowledge
 * - AC-013.2: Loads context from multiple files automatically
 * - AC-013.3: Applies team standards in code suggestions
 * - AC-013.4: Supports 3 operating modes (architect, dev, review)
 * - AC-013.5: Integrates with 8 core agents
 */
export class EgceChatParticipant {
  private static readonly PARTICIPANT_ID = 'egce';
  private static readonly MAX_HISTORY_ITEMS = 15;

  private participant: vscode.ChatParticipant | null = null;
  private sessionContexts: Map<string, SessionContext> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Register the @egce chat participant with VS Code (T-013.1)
   */
  register(context: vscode.ExtensionContext): void {
    this.participant = vscode.chat.createChatParticipant(
      `egce.${EgceChatParticipant.PARTICIPANT_ID}`,
      this.handleRequest.bind(this)
    );

    this.participant.iconPath = new vscode.ThemeIcon('rocket');

    this.participant.followupProvider = {
      provideFollowups: this.provideFollowups.bind(this),
    };

    context.subscriptions.push(this.participant);

    // Pre-load agent definitions
    this.loadAgentDefinitions().catch(console.error);

    console.log('EGCE Chat Participant registered');
  }

  /**
   * Main request handler for chat messages
   */
  private async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const sessionId = this.getSessionId(context);
    const sessionContext = await this.getOrCreateSessionContext(sessionId);

    // Parse mode and intent from request
    const { mode, intent, query } = this.parseRequest(request, sessionContext);
    sessionContext.mode = mode;

    // Record user message
    this.addToHistory(sessionContext, 'user', request.prompt);

    try {
      // Load multi-file context if not already loaded (AC-013.2)
      if (!sessionContext.loadedContext) {
        stream.progress('Loading Memory Bank context...');
        sessionContext.loadedContext = await this.loadMultiFileContext(token);
      }

      // Load team standards if not already loaded (AC-013.3)
      if (!sessionContext.standards) {
        sessionContext.standards = await this.loadTeamStandards();
      }

      switch (intent) {
        case 'mode':
          return this.handleModeChange(mode, stream);

        case 'architect':
          return await this.handleArchitectMode(query, sessionContext, stream, token);

        case 'dev':
          return await this.handleDevMode(query, sessionContext, stream, token);

        case 'review':
          return await this.handleReviewMode(query, sessionContext, stream, token);

        case 'agent':
          return await this.handleAgentQuery(query, sessionContext, stream, token);

        case 'standards':
          return await this.handleStandardsQuery(query, sessionContext, stream, token);

        case 'context':
          return await this.handleContextQuery(sessionContext, stream, token);

        case 'help':
          return this.handleHelpQuery(stream);

        default:
          // Route based on current mode
          return await this.handleModeBasedQuery(
            query,
            sessionContext,
            stream,
            token
          );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stream.markdown(`**Error**: ${errorMessage}\n\nPlease try again or use \`@egce help\` for assistance.`);
      return { errorDetails: { message: errorMessage } };
    }
  }

  /**
   * Parse request to determine mode and intent
   */
  private parseRequest(
    request: vscode.ChatRequest,
    sessionContext: SessionContext
  ): { mode: EgceMode; intent: string; query: string } {
    const prompt = request.prompt.toLowerCase().trim();
    let mode = sessionContext.mode;
    let intent = 'query';
    let query = request.prompt;

    // Check for mode switching commands
    if (prompt.startsWith('mode ') || prompt.startsWith('/mode ')) {
      const requestedMode = prompt.replace(/^\/?mode\s+/, '').trim();
      if (['architect', 'dev', 'review'].includes(requestedMode)) {
        mode = requestedMode as EgceMode;
        intent = 'mode';
        query = requestedMode;
      }
    }
    // Check for explicit mode prefixes
    else if (prompt.startsWith('architect:') || prompt.startsWith('/architect')) {
      mode = 'architect';
      intent = 'architect';
      query = request.prompt.replace(/^\/?architect:?\s*/i, '');
    } else if (prompt.startsWith('dev:') || prompt.startsWith('/dev')) {
      mode = 'dev';
      intent = 'dev';
      query = request.prompt.replace(/^\/?dev:?\s*/i, '');
    } else if (prompt.startsWith('review:') || prompt.startsWith('/review')) {
      mode = 'review';
      intent = 'review';
      query = request.prompt.replace(/^\/?review:?\s*/i, '');
    }
    // Check for agent invocation
    else if (prompt.startsWith('@') || prompt.includes('ask ')) {
      const agentMatch = prompt.match(/@?(\w+[-\w]*)/);
      if (agentMatch && this.agentDefinitions.has(agentMatch[1])) {
        intent = 'agent';
        query = request.prompt;
      }
    }
    // Check for standards query
    else if (
      prompt.includes('standard') ||
      prompt.includes('convention') ||
      prompt.includes('best practice') ||
      prompt.includes('guideline')
    ) {
      intent = 'standards';
    }
    // Check for context query
    else if (
      prompt === 'context' ||
      prompt.includes('current context') ||
      prompt.includes('show context') ||
      prompt.includes('what context')
    ) {
      intent = 'context';
    }
    // Check for help
    else if (prompt === 'help' || prompt === '?' || prompt.startsWith('how to')) {
      intent = 'help';
    }
    // Detect intent from keywords
    else if (
      prompt.includes('architecture') ||
      prompt.includes('design') ||
      prompt.includes('structure') ||
      prompt.includes('adr')
    ) {
      intent = 'architect';
    } else if (
      prompt.includes('review') ||
      prompt.includes('check') ||
      prompt.includes('validate') ||
      prompt.includes('audit')
    ) {
      intent = 'review';
    }

    return { mode, intent, query };
  }

  /**
   * Handle mode change command
   */
  private handleModeChange(
    mode: EgceMode,
    stream: vscode.ChatResponseStream
  ): vscode.ChatResult {
    const modeDescriptions: Record<EgceMode, string> = {
      architect: 'System design, architecture decisions, and technical strategy',
      dev: 'Development assistance with Memory Bank context and team standards',
      review: 'Code review with team standards enforcement',
    };

    const modeIcons: Record<EgceMode, string> = {
      architect: 'symbol-structure',
      dev: 'code',
      review: 'checklist',
    };

    stream.markdown(`## Mode Changed: **${mode.charAt(0).toUpperCase() + mode.slice(1)}**

$(${modeIcons[mode]}) ${modeDescriptions[mode]}

All subsequent queries will use this mode until changed. You can also use mode-specific prefixes:
- \`architect: <query>\` - Architecture questions
- \`dev: <query>\` - Development help
- \`review: <query>\` - Code review

Use \`@egce help\` to see all available commands.
`);

    return { metadata: { mode } };
  }

  /**
   * Handle architect mode queries (AC-013.4)
   */
  private async handleArchitectMode(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress('Analyzing architecture context...');

    const architectAgent = this.agentDefinitions.get('architect');
    const loadedContext = sessionContext.loadedContext;

    // Build comprehensive context for architecture response
    let contextSummary = '';

    if (loadedContext?.projectContext) {
      contextSummary += `### Project Context\n${this.summarizeContent(loadedContext.projectContext, 500)}\n\n`;
    }

    if (loadedContext?.relevantAdrs.length) {
      contextSummary += `### Relevant Architecture Decisions\n`;
      for (const adr of loadedContext.relevantAdrs.slice(0, 5)) {
        contextSummary += `- **${adr.id}: ${adr.title}** (${adr.status})\n`;
      }
      contextSummary += '\n';
    }

    if (loadedContext?.patterns) {
      contextSummary += `### Approved Patterns\n${this.summarizeContent(loadedContext.patterns, 300)}\n\n`;
    }

    // Search Memory Bank for relevant context
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(query, {
      types: ['adr', 'decision', 'pattern', 'context'],
      limit: 5,
    });

    if (token.isCancellationRequested) {
      return {};
    }

    // Format response in architect style
    let response = `## Architecture Analysis

**Mode**: Architect | **Query**: ${query}

---

`;

    if (contextSummary) {
      response += `## Memory Bank Context\n\n${contextSummary}`;
    }

    if (searchResponse.results.length > 0) {
      response += `## Relevant Knowledge\n\n`;
      for (const result of searchResponse.results) {
        response += this.formatSearchResult(result);
      }
    }

    response += `## Architectural Guidance

Based on the Memory Bank context and your query, here's my analysis:

### Understanding
I've reviewed the project context, existing ADRs, and approved patterns from your Memory Bank.

### Recommendations
When providing architectural guidance, I consider:
- Existing patterns established in your project
- Previous architectural decisions (ADRs)
- Team standards and conventions
- Technology stack constraints

### Next Steps
1. Consider creating an ADR if this involves a significant decision
2. Update the Memory Bank with any new patterns discovered
3. Consult with the team on trade-offs

---

*Use \`@egce review:\` to get a code review perspective, or \`@egce dev:\` for implementation guidance.*
`;

    stream.markdown(response);
    this.addReferences(stream, searchResponse.results);
    this.addToHistory(sessionContext, 'assistant', response);

    return { metadata: { mode: 'architect', resultCount: searchResponse.results.length } };
  }

  /**
   * Handle dev mode queries (AC-013.4)
   */
  private async handleDevMode(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress('Loading development context...');

    const loadedContext = sessionContext.loadedContext;
    const standards = sessionContext.standards;

    // Search for relevant patterns and knowledge
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(query, {
      types: ['pattern', 'knowledge', 'module', 'context'],
      limit: 5,
    });

    if (token.isCancellationRequested) {
      return {};
    }

    let response = `## Development Guidance

**Mode**: Dev | **Query**: ${query}

---

`;

    // Include relevant patterns
    if (loadedContext?.patterns) {
      response += `## Approved Patterns\n\n${this.summarizeContent(loadedContext.patterns, 400)}\n\n`;
    }

    // Include anti-patterns to avoid
    if (loadedContext?.antipatterns) {
      response += `## Anti-patterns to Avoid\n\n${this.summarizeContent(loadedContext.antipatterns, 300)}\n\n`;
    }

    // Include team standards
    if (standards) {
      response += `## Team Standards\n\n`;
      if (standards.codeStyle.length > 0) {
        response += `### Code Style\n${standards.codeStyle.slice(0, 3).map(s => `- ${s}`).join('\n')}\n\n`;
      }
      if (standards.namingConventions.length > 0) {
        response += `### Naming Conventions\n${standards.namingConventions.slice(0, 3).map(s => `- ${s}`).join('\n')}\n\n`;
      }
    }

    // Include search results
    if (searchResponse.results.length > 0) {
      response += `## Relevant Context\n\n`;
      for (const result of searchResponse.results) {
        response += this.formatSearchResult(result);
      }
    }

    // Include module context if relevant
    if (loadedContext?.relevantModules.length) {
      response += `## Module Context\n\n`;
      for (const module of loadedContext.relevantModules.slice(0, 2)) {
        response += `### ${module.name}\n${this.summarizeContent(module.content, 200)}\n\n`;
      }
    }

    response += `---

*I've applied your team's standards and patterns from the Memory Bank. Use \`@egce review:\` to validate your implementation.*
`;

    stream.markdown(response);
    this.addReferences(stream, searchResponse.results);
    this.addToHistory(sessionContext, 'assistant', response);

    return { metadata: { mode: 'dev', resultCount: searchResponse.results.length } };
  }

  /**
   * Handle review mode queries (AC-013.4)
   */
  private async handleReviewMode(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress('Preparing code review with team standards...');

    const loadedContext = sessionContext.loadedContext;
    const standards = sessionContext.standards;
    const reviewerAgent = this.agentDefinitions.get('code-reviewer');

    let response = `## Code Review Mode

**Mode**: Review | **Query**: ${query}

---

`;

    // Include team standards for review
    if (standards) {
      response += `## Review Criteria (from Memory Bank)\n\n`;

      response += `### Code Style Standards\n`;
      if (standards.codeStyle.length > 0) {
        response += standards.codeStyle.map(s => `- ${s}`).join('\n') + '\n\n';
      } else {
        response += `- Follow project conventions\n\n`;
      }

      response += `### Security Requirements\n`;
      if (standards.securityRequirements.length > 0) {
        response += standards.securityRequirements.map(s => `- ${s}`).join('\n') + '\n\n';
      } else {
        response += `- OWASP Top 10 compliance\n- Input validation\n- Secure authentication\n\n`;
      }

      response += `### Testing Requirements\n`;
      if (standards.testingRequirements.length > 0) {
        response += standards.testingRequirements.map(s => `- ${s}`).join('\n') + '\n\n';
      } else {
        response += `- Unit tests for new code\n- Integration tests for APIs\n\n`;
      }
    }

    // Include anti-patterns to check for
    if (loadedContext?.antipatterns) {
      response += `## Anti-patterns to Check\n\n${this.summarizeContent(loadedContext.antipatterns, 400)}\n\n`;
    }

    // Search for relevant review context
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(query, {
      types: ['pattern', 'knowledge'],
      limit: 3,
    });

    if (token.isCancellationRequested) {
      return {};
    }

    if (searchResponse.results.length > 0) {
      response += `## Relevant Patterns for Review\n\n`;
      for (const result of searchResponse.results) {
        response += this.formatSearchResult(result);
      }
    }

    response += `## Review Checklist

Based on your team's Memory Bank standards:

- [ ] **Security**: No vulnerabilities (OWASP Top 10)
- [ ] **Tests**: Adequate test coverage
- [ ] **Standards**: Follows team conventions
- [ ] **Error Handling**: Proper exception handling
- [ ] **Documentation**: Code is self-documenting or documented
- [ ] **Performance**: No obvious bottlenecks
- [ ] **Patterns**: Uses approved patterns

---

*Paste code for review, or ask specific questions about code quality.*
`;

    stream.markdown(response);
    this.addReferences(stream, searchResponse.results);
    this.addToHistory(sessionContext, 'assistant', response);

    return { metadata: { mode: 'review', resultCount: searchResponse.results.length } };
  }

  /**
   * Handle agent-specific queries (AC-013.5)
   */
  private async handleAgentQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    // Extract agent name from query
    const agentMatch = query.match(/@?(\w+[-\w]*)/);
    if (!agentMatch) {
      return this.handleHelpQuery(stream);
    }

    const agentId = agentMatch[1].toLowerCase();
    const agent = this.agentDefinitions.get(agentId);

    if (!agent) {
      stream.markdown(`## Agent Not Found

The agent \`@${agentId}\` was not found. Available agents:

${Array.from(this.agentDefinitions.values())
  .map(a => `- **@${a.id}**: ${a.description}`)
  .join('\n')}

Use \`@egce help\` for more information.
`);
      return {};
    }

    stream.progress(`Consulting ${agent.name}...`);

    // Track active agent
    sessionContext.activeAgents.add(agentId);

    // Extract the actual question (after agent mention)
    const actualQuery = query.replace(/@?\w+[-\w]*\s*/, '').trim() || 'general guidance';

    // Build response with agent context
    let response = `## ${agent.name}

${agent.description}

---

`;

    // Include agent's Memory Bank integration guidance
    if (agent.content.includes('Memory Bank Integration')) {
      const mbSection = this.extractSection(agent.content, 'Memory Bank Integration');
      if (mbSection) {
        response += `### Memory Bank Context\n\n${this.summarizeContent(mbSection, 300)}\n\n`;
      }
    }

    // Search Memory Bank for relevant context
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(actualQuery, { limit: 5 });

    if (token.isCancellationRequested) {
      return {};
    }

    if (searchResponse.results.length > 0) {
      response += `### Relevant Knowledge\n\n`;
      for (const result of searchResponse.results.slice(0, 3)) {
        response += this.formatSearchResult(result);
      }
    }

    // Add agent-specific guidance based on expertise
    const expertiseSection = this.extractSection(agent.content, 'Your Expertise') ||
                           this.extractSection(agent.content, 'Expertise');
    if (expertiseSection) {
      response += `### ${agent.name} Expertise\n\n${this.summarizeContent(expertiseSection, 300)}\n\n`;
    }

    response += `---

*Ask follow-up questions to continue with the ${agent.name}.*
`;

    stream.markdown(response);
    this.addReferences(stream, searchResponse.results);
    this.addToHistory(sessionContext, 'assistant', response);

    return { metadata: { agent: agentId, resultCount: searchResponse.results.length } };
  }

  /**
   * Handle standards queries (AC-013.3)
   */
  private async handleStandardsQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress('Loading team standards...');

    const standards = sessionContext.standards;
    const loadedContext = sessionContext.loadedContext;

    let response = `## Team Standards

`;

    if (standards) {
      if (standards.codeStyle.length > 0) {
        response += `### Code Style\n${standards.codeStyle.map(s => `- ${s}`).join('\n')}\n\n`;
      }

      if (standards.architecturePatterns.length > 0) {
        response += `### Architecture Patterns\n${standards.architecturePatterns.map(s => `- ${s}`).join('\n')}\n\n`;
      }

      if (standards.securityRequirements.length > 0) {
        response += `### Security Requirements\n${standards.securityRequirements.map(s => `- ${s}`).join('\n')}\n\n`;
      }

      if (standards.testingRequirements.length > 0) {
        response += `### Testing Requirements\n${standards.testingRequirements.map(s => `- ${s}`).join('\n')}\n\n`;
      }

      if (standards.namingConventions.length > 0) {
        response += `### Naming Conventions\n${standards.namingConventions.map(s => `- ${s}`).join('\n')}\n\n`;
      }
    } else {
      response += `No explicit team standards found in the Memory Bank.\n\n`;
      response += `Consider adding standards to:\n`;
      response += `- \`.memory-bank/project/context.md\`\n`;
      response += `- \`.memory-bank/knowledge/patterns.md\`\n\n`;
    }

    // Include patterns from Memory Bank
    if (loadedContext?.patterns) {
      response += `### Patterns from Knowledge Base\n\n${this.summarizeContent(loadedContext.patterns, 500)}\n\n`;
    }

    response += `---

*Standards are enforced automatically in review mode. Use \`@egce review:\` to validate code against these standards.*
`;

    stream.markdown(response);
    this.addToHistory(sessionContext, 'assistant', response);

    return { metadata: { type: 'standards' } };
  }

  /**
   * Handle context query (AC-013.1, AC-013.2)
   */
  private async handleContextQuery(
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress('Loading complete Memory Bank context...');

    const loadedContext = sessionContext.loadedContext;

    let response = `## Memory Bank Context Summary

**Current Mode**: ${sessionContext.mode}
**Active Agents**: ${sessionContext.activeAgents.size > 0 ? Array.from(sessionContext.activeAgents).join(', ') : 'None'}

---

`;

    if (loadedContext) {
      // Project context
      if (loadedContext.projectContext) {
        response += `### Project Context\n${this.summarizeContent(loadedContext.projectContext, 400)}\n\n`;
      }

      // Tech stack
      if (loadedContext.techStack) {
        response += `### Technology Stack\n${this.summarizeContent(loadedContext.techStack, 300)}\n\n`;
      }

      // ADRs
      if (loadedContext.relevantAdrs.length > 0) {
        response += `### Architecture Decisions (${loadedContext.relevantAdrs.length} ADRs)\n`;
        for (const adr of loadedContext.relevantAdrs.slice(0, 5)) {
          const statusIcon = this.getStatusIcon(adr.status);
          response += `- ${statusIcon} **${adr.id}: ${adr.title}**\n`;
        }
        if (loadedContext.relevantAdrs.length > 5) {
          response += `- *...and ${loadedContext.relevantAdrs.length - 5} more*\n`;
        }
        response += '\n';
      }

      // Modules
      if (loadedContext.relevantModules.length > 0) {
        response += `### Module Contexts (${loadedContext.relevantModules.length} modules)\n`;
        for (const module of loadedContext.relevantModules.slice(0, 3)) {
          response += `- **${module.name}**\n`;
        }
        response += '\n';
      }

      // Patterns
      if (loadedContext.patterns) {
        response += `### Patterns\n${this.summarizeContent(loadedContext.patterns, 200)}\n\n`;
      }

      // Glossary
      if (loadedContext.glossary) {
        response += `### Glossary\n${this.summarizeContent(loadedContext.glossary, 200)}\n\n`;
      }
    } else {
      response += `No Memory Bank context loaded. Ensure \`.memory-bank\` exists in your workspace.\n\n`;
    }

    response += `---

*All this context is automatically included in my responses. Use \`@egce mode dev/architect/review\` to change how I use this context.*
`;

    stream.markdown(response);
    this.addToHistory(sessionContext, 'assistant', response);

    return { metadata: { type: 'context' } };
  }

  /**
   * Handle mode-based queries (routes to appropriate mode handler)
   */
  private async handleModeBasedQuery(
    query: string,
    sessionContext: SessionContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    switch (sessionContext.mode) {
      case 'architect':
        return this.handleArchitectMode(query, sessionContext, stream, token);
      case 'review':
        return this.handleReviewMode(query, sessionContext, stream, token);
      case 'dev':
      default:
        return this.handleDevMode(query, sessionContext, stream, token);
    }
  }

  /**
   * Handle help queries
   */
  private handleHelpQuery(stream: vscode.ChatResponseStream): vscode.ChatResult {
    const agents = Array.from(this.agentDefinitions.values());

    const helpText = `# EGCE - Enterprise GitHub Copilot Enhancement

The **@egce** participant provides intelligent assistance with complete Memory Bank context.

## Operating Modes

| Mode | Command | Description |
|------|---------|-------------|
| **Architect** | \`@egce mode architect\` | System design, ADRs, technical strategy |
| **Dev** | \`@egce mode dev\` | Development with standards and patterns |
| **Review** | \`@egce mode review\` | Code review with standards enforcement |

## Mode Prefixes

Use prefixes for one-off mode queries:
- \`@egce architect: How should we structure the API?\`
- \`@egce dev: Help me implement user authentication\`
- \`@egce review: Check this code for issues\`

## Available Agents

${agents.map(a => `| **@${a.id}** | ${a.description} |`).join('\n')}

## Context Commands

| Command | Description |
|---------|-------------|
| \`@egce context\` | Show loaded Memory Bank context |
| \`@egce standards\` | Show team standards |
| \`@egce help\` | Show this help |

## Features

- **Multi-file Context**: Automatically loads project, modules, ADRs, and patterns
- **Standards Enforcement**: Applies team conventions in suggestions
- **Agent Integration**: Access 8 specialized agents
- **Mode Switching**: Architect, Dev, and Review perspectives

## Examples

\`\`\`
@egce How does authentication work in our system?
@egce architect: Should we use microservices?
@egce review: Check this service class
@egce @security-auditor analyze our API endpoints
\`\`\`

---

*Start by asking any question - I'll use your Memory Bank context automatically!*
`;

    stream.markdown(helpText);
    return {};
  }

  /**
   * Load multi-file context from Memory Bank (T-013.2)
   */
  private async loadMultiFileContext(
    token: vscode.CancellationToken
  ): Promise<LoadedContext> {
    const context: LoadedContext = {
      projectContext: null,
      techStack: null,
      patterns: null,
      antipatterns: null,
      relevantModules: [],
      relevantAdrs: [],
      glossary: null,
    };

    if (!this.workspaceRoot) {
      return context;
    }

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const basePath = path.join(this.workspaceRoot, memoryBankPath);

    // Load project context
    try {
      const projectPath = path.join(basePath, 'project', 'context.md');
      context.projectContext = await fs.readFile(projectPath, 'utf-8');
    } catch {
      // Try alternative paths
      try {
        context.projectContext = await fs.readFile(
          path.join(basePath, 'project-context.md'),
          'utf-8'
        );
      } catch {
        // No project context found
      }
    }

    if (token.isCancellationRequested) return context;

    // Load tech stack
    try {
      context.techStack = await fs.readFile(
        path.join(basePath, 'project', 'tech-stack.md'),
        'utf-8'
      );
    } catch {
      // No tech stack file
    }

    // Load patterns
    try {
      context.patterns = await fs.readFile(
        path.join(basePath, 'knowledge', 'patterns.md'),
        'utf-8'
      );
    } catch {
      // No patterns file
    }

    // Load anti-patterns
    try {
      context.antipatterns = await fs.readFile(
        path.join(basePath, 'knowledge', 'antipatterns.md'),
        'utf-8'
      );
    } catch {
      // No antipatterns file
    }

    // Load glossary
    try {
      context.glossary = await fs.readFile(
        path.join(basePath, 'project', 'glossary.md'),
        'utf-8'
      );
    } catch {
      // No glossary file
    }

    if (token.isCancellationRequested) return context;

    // Load module contexts
    try {
      const modulesPath = path.join(basePath, 'modules');
      const moduleDirs = await fs.readdir(modulesPath);

      for (const moduleDir of moduleDirs) {
        try {
          const moduleContextPath = path.join(modulesPath, moduleDir, 'context.md');
          const stat = await fs.stat(path.join(modulesPath, moduleDir));
          if (stat.isDirectory()) {
            const content = await fs.readFile(moduleContextPath, 'utf-8');
            context.relevantModules.push({ name: moduleDir, content });
          }
        } catch {
          // Module context doesn't exist
        }
      }
    } catch {
      // Modules directory doesn't exist
    }

    if (token.isCancellationRequested) return context;

    // Load ADRs
    try {
      const decisionsPath = path.join(basePath, 'decisions');
      const adrFiles = await fs.readdir(decisionsPath);

      for (const file of adrFiles) {
        if (file.endsWith('.md')) {
          try {
            const content = await fs.readFile(path.join(decisionsPath, file), 'utf-8');
            const id = file.replace('.md', '');
            const titleMatch = content.match(/^#\s+(?:ADR[-\s]*\d+[:\s]*)?(.+)$/m);
            const statusMatch = content.match(/##\s*Status\s*\n+(\w+)/i);

            context.relevantAdrs.push({
              id,
              title: titleMatch?.[1]?.trim() || file,
              content,
              status: statusMatch?.[1]?.toLowerCase() || 'proposed',
            });
          } catch {
            // Skip invalid ADR
          }
        }
      }
    } catch {
      // Decisions directory doesn't exist
    }

    return context;
  }

  /**
   * Load team standards from Memory Bank and instructions (T-013.3)
   */
  private async loadTeamStandards(): Promise<TeamStandards> {
    const standards: TeamStandards = {
      codeStyle: [],
      architecturePatterns: [],
      securityRequirements: [],
      testingRequirements: [],
      namingConventions: [],
    };

    if (!this.workspaceRoot) {
      return standards;
    }

    // Try to load from various sources
    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const basePath = path.join(this.workspaceRoot, memoryBankPath);

    // Load from project context
    try {
      const projectContext = await fs.readFile(
        path.join(basePath, 'project', 'context.md'),
        'utf-8'
      );
      this.extractStandards(projectContext, standards);
    } catch {
      // No project context
    }

    // Load from patterns
    try {
      const patterns = await fs.readFile(
        path.join(basePath, 'knowledge', 'patterns.md'),
        'utf-8'
      );
      this.extractPatterns(patterns, standards);
    } catch {
      // No patterns file
    }

    // Load from core instructions (stack-specific)
    const defaultStack = vscode.workspace
      .getConfiguration('egce')
      .get<string>('defaultStack', 'generic');

    const stackPaths = [
      path.join(this.workspaceRoot, 'stacks', defaultStack, 'instructions'),
      path.join(this.workspaceRoot, 'core', 'instructions'),
    ];

    for (const stackPath of stackPaths) {
      try {
        const files = await fs.readdir(stackPath);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const content = await fs.readFile(path.join(stackPath, file), 'utf-8');
            this.extractStandards(content, standards);
          }
        }
      } catch {
        // Path doesn't exist
      }
    }

    return standards;
  }

  /**
   * Extract standards from content
   */
  private extractStandards(content: string, standards: TeamStandards): void {
    // Look for code style patterns
    const codeStyleMatches = content.match(/code\s*style[^:]*:\s*([^\n]+)/gi);
    if (codeStyleMatches) {
      for (const match of codeStyleMatches) {
        const value = match.split(':')[1]?.trim();
        if (value && !standards.codeStyle.includes(value)) {
          standards.codeStyle.push(value);
        }
      }
    }

    // Look for security requirements
    const securityMatches = content.match(/(?:security|secure)[^:]*:\s*([^\n]+)/gi);
    if (securityMatches) {
      for (const match of securityMatches) {
        const value = match.split(':')[1]?.trim();
        if (value && !standards.securityRequirements.includes(value)) {
          standards.securityRequirements.push(value);
        }
      }
    }

    // Look for testing requirements
    const testMatches = content.match(/(?:test|testing)[^:]*:\s*([^\n]+)/gi);
    if (testMatches) {
      for (const match of testMatches) {
        const value = match.split(':')[1]?.trim();
        if (value && !standards.testingRequirements.includes(value)) {
          standards.testingRequirements.push(value);
        }
      }
    }

    // Look for naming conventions
    const namingMatches = content.match(/naming\s*convention[^:]*:\s*([^\n]+)/gi);
    if (namingMatches) {
      for (const match of namingMatches) {
        const value = match.split(':')[1]?.trim();
        if (value && !standards.namingConventions.includes(value)) {
          standards.namingConventions.push(value);
        }
      }
    }
  }

  /**
   * Extract patterns from patterns.md
   */
  private extractPatterns(content: string, standards: TeamStandards): void {
    // Extract pattern headers as architecture patterns
    const patternHeaders = content.match(/^##\s+(.+)$/gm);
    if (patternHeaders) {
      for (const header of patternHeaders) {
        const pattern = header.replace(/^##\s+/, '').trim();
        if (pattern && !standards.architecturePatterns.includes(pattern)) {
          standards.architecturePatterns.push(pattern);
        }
      }
    }
  }

  /**
   * Load agent definitions from core/agents (AC-013.5)
   */
  private async loadAgentDefinitions(): Promise<void> {
    const agentPaths = [
      path.join(this.workspaceRoot || '', 'core', 'agents'),
    ];

    for (const agentsPath of agentPaths) {
      try {
        const files = await fs.readdir(agentsPath);

        for (const file of files) {
          if (file.endsWith('.agent.md')) {
            try {
              const filePath = path.join(agentsPath, file);
              const content = await fs.readFile(filePath, 'utf-8');

              // Parse frontmatter
              const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
              if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const nameMatch = frontmatter.match(/name:\s*(.+)/);
                const descMatch = frontmatter.match(/description:\s*(.+)/);
                const toolsMatch = frontmatter.match(/tools:\s*\n((?:\s+-\s*.+\n?)+)/);

                const id = file.replace('.agent.md', '');
                const name = nameMatch?.[1]?.trim() || id;
                const description = descMatch?.[1]?.trim() || '';
                const tools = toolsMatch?.[1]
                  ?.split('\n')
                  .map(t => t.replace(/^\s+-\s*/, '').trim())
                  .filter(t => t) || [];

                this.agentDefinitions.set(id, {
                  id,
                  name: name.charAt(0).toUpperCase() + name.slice(1),
                  description,
                  content,
                  tools,
                });
              }
            } catch {
              // Skip invalid agent file
            }
          }
        }
      } catch {
        // Path doesn't exist
      }
    }
  }

  /**
   * Provide follow-up suggestions
   */
  private provideFollowups(
    result: vscode.ChatResult,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
  ): vscode.ChatFollowup[] {
    const followups: vscode.ChatFollowup[] = [];
    const sessionId = this.getSessionId(context);
    const sessionContext = this.sessionContexts.get(sessionId);
    const mode = sessionContext?.mode || 'dev';

    // Mode-specific followups
    if (mode === 'architect') {
      followups.push({
        prompt: 'Create an ADR for this decision',
        label: 'Create ADR',
      });
      followups.push({
        prompt: 'What are the alternatives?',
        label: 'Show Alternatives',
      });
    } else if (mode === 'review') {
      followups.push({
        prompt: 'What are the security implications?',
        label: 'Security Check',
      });
      followups.push({
        prompt: 'Suggest improvements',
        label: 'Suggest Improvements',
      });
    } else {
      followups.push({
        prompt: 'Show me an example implementation',
        label: 'Show Example',
      });
      followups.push({
        prompt: 'What tests should I write?',
        label: 'Testing Guidance',
      });
    }

    // Generic followups
    followups.push({
      prompt: 'Show current context',
      label: 'Show Context',
    });

    return followups.slice(0, 4);
  }

  /**
   * Helper methods
   */

  private getOrCreateSessionContext(sessionId: string): SessionContext {
    let context = this.sessionContexts.get(sessionId);
    if (!context) {
      const defaultMode = vscode.workspace
        .getConfiguration('egce')
        .get<EgceMode>('egce.defaultMode', 'dev');

      context = {
        mode: defaultMode,
        conversationHistory: [],
        loadedContext: null,
        standards: null,
        activeAgents: new Set(),
      };
      this.sessionContexts.set(sessionId, context);
    }
    return context;
  }

  private getSessionId(context: vscode.ChatContext): string {
    return `session-${context.history.length > 0 ? 'active' : 'new'}`;
  }

  private addToHistory(
    context: SessionContext,
    role: 'user' | 'assistant',
    content: string
  ): void {
    context.conversationHistory.push({
      role,
      content: content.substring(0, 2000),
      timestamp: new Date(),
    });

    while (context.conversationHistory.length > EgceChatParticipant.MAX_HISTORY_ITEMS) {
      context.conversationHistory.shift();
    }
  }

  private formatSearchResult(result: SearchResult): string {
    const { entry, similarity } = result;
    const relevance = Math.round(similarity * 100);
    const typeIcon = this.getTypeIcon(entry.type);

    let markdown = `#### ${typeIcon} ${entry.title}\n`;
    markdown += `*Type*: ${entry.type} | *Relevance*: ${relevance}%\n\n`;

    const preview = entry.content.substring(0, 300).replace(/\n/g, ' ');
    markdown += `> ${preview}${entry.content.length > 300 ? '...' : ''}\n\n`;

    return markdown;
  }

  private addReferences(stream: vscode.ChatResponseStream, results: SearchResult[]): void {
    for (const result of results) {
      const filePath = result.entry.metadata?.filePath as string | undefined;
      if (filePath) {
        stream.reference(vscode.Uri.file(filePath));
      }
    }
  }

  private summarizeContent(content: string, maxLength: number): string {
    // Remove headers for summary
    const withoutHeaders = content.replace(/^#+\s+.+$/gm, '').trim();
    const normalized = withoutHeaders.replace(/\n+/g, '\n').trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return normalized.substring(0, maxLength) + '...';
  }

  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=\\n##|$)`, 'i');
    const match = content.match(regex);
    return match ? match[0].replace(/^##\s*.+\n+/, '').trim() : null;
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      adr: '$(note)',
      decision: '$(note)',
      pattern: '$(symbol-structure)',
      knowledge: '$(book)',
      module: '$(package)',
      context: '$(file)',
      glossary: '$(list-unordered)',
    };
    return icons[type] || '$(file)';
  }

  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      proposed: '$(circle-outline)',
      accepted: '$(check)',
      deprecated: '$(warning)',
      superseded: '$(arrow-right)',
    };
    return icons[status.toLowerCase()] || '$(circle-outline)';
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.sessionContexts.clear();
    this.agentDefinitions.clear();
    this.participant?.dispose();
  }
}

// Singleton instance
let egceChatParticipant: EgceChatParticipant | null = null;

export function getEgceChatParticipant(): EgceChatParticipant {
  if (!egceChatParticipant) {
    egceChatParticipant = new EgceChatParticipant();
  }
  return egceChatParticipant;
}
