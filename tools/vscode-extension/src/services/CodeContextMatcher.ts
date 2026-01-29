/**
 * US-010: Code Context Matcher Service
 *
 * Implements T-010.2: Code-to-context matching logic.
 * Matches code symbols (functions, classes, imports) to Memory Bank entries.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  MemoryBankService,
  ContextFile,
  ContextFileType,
} from './MemoryBankService';

// ============================================
// Types
// ============================================

export interface ContextMatch {
  type: ContextMatchType;
  title: string;
  description: string;
  source: string;
  sourcePath: string;
  relevance: number; // 0-1 score
  metadata?: Record<string, string>;
  codeExamples?: string[];
  relatedDecisions?: string[];
  patterns?: string[];
}

export enum ContextMatchType {
  Function = 'function',
  Class = 'class',
  Module = 'module',
  Import = 'import',
  Pattern = 'pattern',
  Decision = 'decision',
  Convention = 'convention',
  Knowledge = 'knowledge',
}

export interface SymbolInfo {
  name: string;
  kind: vscode.SymbolKind | 'import';
  modulePath?: string;
  containerName?: string;
}

interface ParsedContextFile {
  path: string;
  type: ContextFileType;
  title: string;
  sections: Map<string, string>;
  patterns: string[];
  functions: string[];
  modules: string[];
  keywords: string[];
}

// ============================================
// Code Context Matcher
// ============================================

export class CodeContextMatcher {
  private memoryBankService: MemoryBankService;
  private parsedContextCache: Map<string, ParsedContextFile> = new Map();
  private workspaceRoot: string | undefined;

  constructor(memoryBankService: MemoryBankService) {
    this.memoryBankService = memoryBankService;
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Find context matches for a given symbol
   */
  async findMatches(symbol: SymbolInfo, document: vscode.TextDocument): Promise<ContextMatch[]> {
    const matches: ContextMatch[] = [];

    // Refresh context cache if needed
    await this.refreshContextCache();

    // Search different sources based on symbol kind
    if (symbol.kind === 'import' || symbol.modulePath) {
      matches.push(...await this.findModuleMatches(symbol));
    }

    if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method) {
      matches.push(...await this.findFunctionMatches(symbol, document));
    }

    if (symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Interface) {
      matches.push(...await this.findClassMatches(symbol));
    }

    // Always check for pattern matches
    matches.push(...await this.findPatternMatches(symbol));

    // Check for decision/ADR matches
    matches.push(...await this.findDecisionMatches(symbol));

    // Sort by relevance and deduplicate
    return this.deduplicateAndSort(matches);
  }

  /**
   * Extract symbol information from document at position
   */
  async extractSymbol(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<SymbolInfo | undefined> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return undefined;
    }

    const word = document.getText(wordRange);
    if (!word || word.length < 2) {
      return undefined;
    }

    const line = document.lineAt(position.line).text;

    // Check if it's an import statement
    const importInfo = this.parseImportStatement(line, word, document.languageId);
    if (importInfo) {
      return {
        name: word,
        kind: 'import',
        modulePath: importInfo.modulePath,
      };
    }

    // Try to get symbol information from VS Code
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      if (symbols) {
        const matchedSymbol = this.findSymbolAtPosition(symbols, position, word);
        if (matchedSymbol) {
          return {
            name: matchedSymbol.name,
            kind: matchedSymbol.kind,
            containerName: matchedSymbol.containerName,
          };
        }
      }
    } catch {
      // Symbol provider not available, continue with heuristics
    }

    // Fallback: use heuristics based on context
    return this.inferSymbolFromContext(line, word);
  }

  // ============================================
  // Private Methods - Matching
  // ============================================

  /**
   * Find matches for module/import symbols
   */
  private async findModuleMatches(symbol: SymbolInfo): Promise<ContextMatch[]> {
    const matches: ContextMatch[] = [];
    const searchTerm = symbol.modulePath || symbol.name;

    for (const [, parsedFile] of this.parsedContextCache) {
      if (parsedFile.type !== ContextFileType.ModuleContext) {
        continue;
      }

      // Check if module name matches
      const moduleNameMatch = parsedFile.modules.some((m) =>
        this.fuzzyMatch(m, searchTerm)
      );

      if (moduleNameMatch || this.fuzzyMatch(parsedFile.title, searchTerm)) {
        const description = parsedFile.sections.get('overview') ||
          parsedFile.sections.get('description') ||
          `Module context for ${parsedFile.title}`;

        matches.push({
          type: ContextMatchType.Module,
          title: parsedFile.title,
          description,
          source: 'Memory Bank - Module Context',
          sourcePath: parsedFile.path,
          relevance: moduleNameMatch ? 0.9 : 0.7,
          metadata: this.extractMetadata(parsedFile),
        });
      }
    }

    return matches;
  }

  /**
   * Find matches for function symbols
   */
  private async findFunctionMatches(
    symbol: SymbolInfo,
    document: vscode.TextDocument
  ): Promise<ContextMatch[]> {
    const matches: ContextMatch[] = [];
    const modulePath = this.getRelativeModulePath(document.uri.fsPath);

    for (const [, parsedFile] of this.parsedContextCache) {
      // Check if function is documented in module context
      const functionMatch = parsedFile.functions.some((f) =>
        this.fuzzyMatch(f, symbol.name)
      );

      if (functionMatch) {
        const description = this.findFunctionDescription(parsedFile, symbol.name);

        matches.push({
          type: ContextMatchType.Function,
          title: `${symbol.name}()`,
          description: description || `Function documented in ${parsedFile.title}`,
          source: 'Memory Bank - Documentation',
          sourcePath: parsedFile.path,
          relevance: 0.85,
        });
      }

      // Check if module path matches (for related context)
      if (modulePath && parsedFile.modules.some((m) => modulePath.includes(m))) {
        const keywordMatch = parsedFile.keywords.some((k) =>
          symbol.name.toLowerCase().includes(k.toLowerCase())
        );

        if (keywordMatch) {
          matches.push({
            type: ContextMatchType.Knowledge,
            title: parsedFile.title,
            description: `Related context from ${parsedFile.title}`,
            source: 'Memory Bank - Related',
            sourcePath: parsedFile.path,
            relevance: 0.5,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find matches for class symbols
   */
  private async findClassMatches(
    symbol: SymbolInfo
  ): Promise<ContextMatch[]> {
    const matches: ContextMatch[] = [];

    for (const [, parsedFile] of this.parsedContextCache) {
      // Direct class name match
      if (this.fuzzyMatch(parsedFile.title, symbol.name) ||
          parsedFile.keywords.some((k) => this.fuzzyMatch(k, symbol.name))) {

        const description = parsedFile.sections.get('overview') ||
          parsedFile.sections.get('description') ||
          `Class/Interface documented in ${parsedFile.title}`;

        matches.push({
          type: ContextMatchType.Class,
          title: symbol.name,
          description,
          source: 'Memory Bank - Class Documentation',
          sourcePath: parsedFile.path,
          relevance: 0.85,
        });
      }
    }

    return matches;
  }

  /**
   * Find matches for design patterns
   */
  private async findPatternMatches(symbol: SymbolInfo): Promise<ContextMatch[]> {
    const matches: ContextMatch[] = [];
    const name = symbol.name.toLowerCase();

    // Common pattern indicators in symbol names
    const patternIndicators: Record<string, string> = {
      factory: 'Factory Pattern',
      singleton: 'Singleton Pattern',
      builder: 'Builder Pattern',
      adapter: 'Adapter Pattern',
      decorator: 'Decorator Pattern',
      observer: 'Observer Pattern',
      strategy: 'Strategy Pattern',
      repository: 'Repository Pattern',
      service: 'Service Pattern',
      controller: 'Controller Pattern',
      middleware: 'Middleware Pattern',
      handler: 'Handler Pattern',
      provider: 'Provider Pattern',
      facade: 'Facade Pattern',
      proxy: 'Proxy Pattern',
    };

    for (const [indicator, patternName] of Object.entries(patternIndicators)) {
      if (name.includes(indicator)) {
        // Check if we have documentation for this pattern
        for (const [, parsedFile] of this.parsedContextCache) {
          if (parsedFile.patterns.some((p) => p.toLowerCase().includes(indicator))) {
            matches.push({
              type: ContextMatchType.Pattern,
              title: patternName,
              description: `This code implements the ${patternName}. See Memory Bank for implementation guidelines.`,
              source: 'Memory Bank - Patterns',
              sourcePath: parsedFile.path,
              relevance: 0.75,
              patterns: [patternName],
            });
            break;
          }
        }
      }
    }

    return matches;
  }

  /**
   * Find matches in Architecture Decision Records
   */
  private async findDecisionMatches(symbol: SymbolInfo): Promise<ContextMatch[]> {
    const matches: ContextMatch[] = [];

    try {
      const decisions = await this.memoryBankService.getDecisions();

      for (const decision of decisions) {
        // Check if symbol name appears in decision title or content
        if (this.fuzzyMatch(decision.title, symbol.name)) {
          const content = await this.readFileContent(decision.filePath);
          const context = this.extractDecisionContext(content);

          matches.push({
            type: ContextMatchType.Decision,
            title: `ADR-${decision.id}: ${decision.title}`,
            description: context || `Architecture decision related to ${symbol.name}`,
            source: 'Memory Bank - ADR',
            sourcePath: decision.filePath,
            relevance: 0.8,
            metadata: {
              status: decision.status,
              date: decision.date,
            },
          });
        }
      }
    } catch {
      // ADRs not available
    }

    return matches;
  }

  // ============================================
  // Private Methods - Parsing
  // ============================================

  /**
   * Refresh the context cache from Memory Bank files
   */
  private async refreshContextCache(): Promise<void> {
    try {
      const contextFiles = await this.memoryBankService.getContextFiles();

      for (const file of contextFiles) {
        if (!file.exists) {
          continue;
        }

        // Skip if already cached and file hasn't changed
        if (this.parsedContextCache.has(file.path)) {
          continue;
        }

        const content = await this.readFileContent(file.path);
        if (content) {
          const parsed = this.parseContextFile(file, content);
          this.parsedContextCache.set(file.path, parsed);
        }
      }
    } catch {
      // Memory Bank not available
    }
  }

  /**
   * Parse a context file into searchable structure
   */
  private parseContextFile(file: ContextFile, content: string): ParsedContextFile {
    const sections = this.parseSections(content);
    const title = this.extractTitle(content) || path.basename(file.path, '.md');

    return {
      path: file.path,
      type: file.type,
      title,
      sections,
      patterns: this.extractPatterns(content),
      functions: this.extractFunctions(content),
      modules: this.extractModules(content),
      keywords: this.extractKeywords(content, title),
    };
  }

  /**
   * Parse markdown sections from content
   */
  private parseSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const sectionRegex = /^##\s+(.+)$/gm;
    let lastMatch: { name: string; index: number } | null = null;

    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      if (lastMatch) {
        const sectionContent = content
          .slice(lastMatch.index, match.index)
          .replace(/^##\s+.+$/m, '')
          .trim();
        sections.set(lastMatch.name.toLowerCase(), sectionContent);
      }
      lastMatch = { name: match[1], index: match.index };
    }

    // Capture last section
    if (lastMatch) {
      const sectionContent = content
        .slice(lastMatch.index)
        .replace(/^##\s+.+$/m, '')
        .trim();
      sections.set(lastMatch.name.toLowerCase(), sectionContent);
    }

    return sections;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string): string | undefined {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract mentioned patterns from content
   */
  private extractPatterns(content: string): string[] {
    const patterns: string[] = [];
    const patternKeywords = [
      'pattern', 'factory', 'singleton', 'builder', 'adapter',
      'decorator', 'observer', 'strategy', 'repository', 'service',
      'controller', 'middleware', 'handler', 'provider', 'facade',
    ];

    for (const keyword of patternKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(content)) {
        patterns.push(keyword);
      }
    }

    return [...new Set(patterns)];
  }

  /**
   * Extract function names from content
   */
  private extractFunctions(content: string): string[] {
    const functions: string[] = [];

    // Match function references like `functionName()` or `functionName`
    const funcRegex = /`([a-zA-Z_][a-zA-Z0-9_]*)\(\)`/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    // Match code block function definitions
    const defRegex = /(?:function|def|fn|func)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = defRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    return [...new Set(functions)];
  }

  /**
   * Extract module names from content
   */
  private extractModules(content: string): string[] {
    const modules: string[] = [];

    // Match module paths like `src/services/auth`
    const pathRegex = /`([a-zA-Z0-9_/-]+(?:\/[a-zA-Z0-9_-]+)+)`/g;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      modules.push(match[1]);
    }

    // Match package/module names
    const packageRegex = /@?[a-zA-Z][a-zA-Z0-9_-]*(?:\/[a-zA-Z][a-zA-Z0-9_-]*)*/g;
    while ((match = packageRegex.exec(content)) !== null) {
      if (match[0].includes('/')) {
        modules.push(match[0]);
      }
    }

    return [...new Set(modules)];
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string, title: string): string[] {
    const keywords: string[] = [];

    // Add words from title
    keywords.push(...title.toLowerCase().split(/\s+/));

    // Extract bold terms
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    while ((match = boldRegex.exec(content)) !== null) {
      keywords.push(...match[1].toLowerCase().split(/\s+/));
    }

    // Filter out common words
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    return [...new Set(keywords.filter((k) => k.length > 2 && !stopWords.has(k)))];
  }

  // ============================================
  // Private Methods - Utilities
  // ============================================

  /**
   * Parse import statement to extract module path
   */
  private parseImportStatement(
    line: string,
    word: string,
    languageId: string
  ): { modulePath: string } | undefined {
    // JavaScript/TypeScript imports
    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
      const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        return { modulePath: importMatch[1] };
      }
      const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        return { modulePath: requireMatch[1] };
      }
    }

    // Python imports
    if (languageId === 'python') {
      const fromImportMatch = line.match(/from\s+([^\s]+)\s+import/);
      if (fromImportMatch) {
        return { modulePath: fromImportMatch[1] };
      }
      const importMatch = line.match(/import\s+([^\s,]+)/);
      if (importMatch) {
        return { modulePath: importMatch[1] };
      }
    }

    // Java imports
    if (languageId === 'java') {
      const importMatch = line.match(/import\s+(?:static\s+)?([^;]+);/);
      if (importMatch) {
        return { modulePath: importMatch[1] };
      }
    }

    // C# using
    if (languageId === 'csharp') {
      const usingMatch = line.match(/using\s+(?:static\s+)?([^;=]+);/);
      if (usingMatch) {
        return { modulePath: usingMatch[1].trim() };
      }
    }

    return undefined;
  }

  /**
   * Find symbol at position in symbol tree
   */
  private findSymbolAtPosition(
    symbols: vscode.DocumentSymbol[],
    position: vscode.Position,
    word: string
  ): (vscode.DocumentSymbol & { containerName?: string }) | undefined {
    for (const symbol of symbols) {
      if (symbol.range.contains(position)) {
        // Check children first for more specific match
        if (symbol.children && symbol.children.length > 0) {
          const childMatch = this.findSymbolAtPosition(symbol.children, position, word);
          if (childMatch) {
            return { ...childMatch, containerName: symbol.name };
          }
        }

        // Check if this symbol matches
        if (symbol.name === word || symbol.name.includes(word)) {
          return symbol;
        }
      }
    }
    return undefined;
  }

  /**
   * Infer symbol type from context when symbol provider is unavailable
   */
  private inferSymbolFromContext(
    line: string,
    word: string
  ): SymbolInfo {
    // Check for function definition patterns
    const funcPatterns = [
      /(?:function|def|fn|func|async)\s+\w+\s*\(/,
      /\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/,
      /(?:public|private|protected|static)?\s*\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/,
    ];

    if (funcPatterns.some((p) => p.test(line))) {
      return { name: word, kind: vscode.SymbolKind.Function };
    }

    // Check for class definition
    if (/(?:class|interface|struct|enum)\s+\w+/.test(line)) {
      return { name: word, kind: vscode.SymbolKind.Class };
    }

    // Default to variable
    return { name: word, kind: vscode.SymbolKind.Variable };
  }

  /**
   * Fuzzy match two strings
   */
  private fuzzyMatch(text: string, search: string): boolean {
    if (!text || !search) {
      return false;
    }

    const normalizedText = text.toLowerCase().replace(/[-_]/g, '');
    const normalizedSearch = search.toLowerCase().replace(/[-_]/g, '');

    // Exact match
    if (normalizedText === normalizedSearch) {
      return true;
    }

    // Contains match
    if (normalizedText.includes(normalizedSearch) || normalizedSearch.includes(normalizedText)) {
      return true;
    }

    // Word boundary match
    const words = normalizedText.split(/\s+/);
    return words.some((w) => w === normalizedSearch || w.startsWith(normalizedSearch));
  }

  /**
   * Get relative module path from workspace
   */
  private getRelativeModulePath(filePath: string): string | undefined {
    if (!this.workspaceRoot) {
      return undefined;
    }
    return path.relative(this.workspaceRoot, filePath);
  }

  /**
   * Read file content safely
   */
  private async readFileContent(filePath: string): Promise<string | undefined> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * Find function description in parsed file
   */
  private findFunctionDescription(parsedFile: ParsedContextFile, functionName: string): string | undefined {
    // Look for the function in API or functions section
    const apiSection = parsedFile.sections.get('api') || parsedFile.sections.get('functions');
    if (apiSection) {
      const funcPattern = new RegExp(`\`?${functionName}\\(?\\)?\`?\\s*[-:]\\s*(.+)`, 'i');
      const match = apiSection.match(funcPattern);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Extract context from ADR content
   */
  private extractDecisionContext(content: string | undefined): string | undefined {
    if (!content) {
      return undefined;
    }

    // Try to extract the decision section
    const decisionMatch = content.match(/##\s*Decision\s*\n+([\s\S]*?)(?=##|$)/i);
    if (decisionMatch) {
      const text = decisionMatch[1].trim().replace(/<!--[\s\S]*?-->/g, '').trim();
      if (text) {
        return text.slice(0, 200) + (text.length > 200 ? '...' : '');
      }
    }

    // Fallback to context section
    const contextMatch = content.match(/##\s*Context\s*\n+([\s\S]*?)(?=##|$)/i);
    if (contextMatch) {
      const text = contextMatch[1].trim().replace(/<!--[\s\S]*?-->/g, '').trim();
      if (text) {
        return text.slice(0, 200) + (text.length > 200 ? '...' : '');
      }
    }

    return undefined;
  }

  /**
   * Extract metadata from parsed file
   */
  private extractMetadata(parsedFile: ParsedContextFile): Record<string, string> {
    const metadata: Record<string, string> = {};

    const techStack = parsedFile.sections.get('technology stack');
    if (techStack) {
      metadata.techStack = techStack.slice(0, 100);
    }

    return metadata;
  }

  /**
   * Deduplicate and sort matches by relevance
   */
  private deduplicateAndSort(matches: ContextMatch[]): ContextMatch[] {
    const seen = new Set<string>();
    const unique: ContextMatch[] = [];

    for (const match of matches) {
      const key = `${match.type}:${match.title}:${match.sourcePath}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(match);
      }
    }

    return unique.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Clear the context cache (for file changes)
   */
  clearCache(): void {
    this.parsedContextCache.clear();
  }

  /**
   * Invalidate specific file from cache
   */
  invalidateFile(filePath: string): void {
    this.parsedContextCache.delete(filePath);
  }
}
