/**
 * US-011: ADR Code Mapper Service
 *
 * Implements T-011.2: Code-to-ADR mapping logic.
 * Scans code files and identifies lines that are related to Architecture Decision Records.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MemoryBankService, Decision } from './MemoryBankService';

// ============================================
// Types
// ============================================

export interface AdrMapping {
  decision: Decision;
  lineNumber: number;
  matchType: AdrMatchType;
  matchedText: string;
  summary: string;
}

export enum AdrMatchType {
  DirectReference = 'direct-reference',    // Explicit ADR reference in code (e.g., comment)
  PatternMatch = 'pattern-match',          // Design pattern mentioned in ADR
  ModuleMatch = 'module-match',            // Module/package referenced in ADR
  KeywordMatch = 'keyword-match',          // Keywords from ADR found in code
  TechnologyMatch = 'technology-match',    // Technology/framework mentioned in ADR
}

interface ParsedAdr {
  decision: Decision;
  keywords: string[];
  patterns: string[];
  modules: string[];
  technologies: string[];
  context: string;
  decisionText: string;
}

// ============================================
// ADR Code Mapper
// ============================================

export class AdrCodeMapper {
  private memoryBankService: MemoryBankService;
  private parsedAdrCache: Map<string, ParsedAdr> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  constructor(memoryBankService: MemoryBankService) {
    this.memoryBankService = memoryBankService;
  }

  /**
   * Find all ADR mappings for a given document
   */
  async findMappings(document: vscode.TextDocument): Promise<AdrMapping[]> {
    const mappings: AdrMapping[] = [];

    // Refresh ADR cache if needed
    await this.refreshCache();

    if (this.parsedAdrCache.size === 0) {
      return mappings;
    }

    const text = document.getText();
    const lines = text.split('\n');

    // Get the relative path for module matching
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const relativePath = workspaceRoot
      ? path.relative(workspaceRoot, document.uri.fsPath)
      : document.uri.fsPath;

    // Check each line for potential ADR matches
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineMappings = this.findLineMappings(line, lineIndex, relativePath);
      mappings.push(...lineMappings);
    }

    // Deduplicate mappings (same ADR on same line)
    return this.deduplicateMappings(mappings);
  }

  /**
   * Find mappings for a specific line
   */
  private findLineMappings(
    line: string,
    lineNumber: number,
    relativePath: string
  ): AdrMapping[] {
    const mappings: AdrMapping[] = [];
    const lineLower = line.toLowerCase();

    // Check for direct ADR references in comments
    const directMatch = line.match(/\bADR[-\s]?(\d+)\b/i);
    if (directMatch) {
      const adrId = directMatch[1].padStart(4, '0');
      const parsedAdr = this.findAdrById(adrId);
      if (parsedAdr) {
        mappings.push({
          decision: parsedAdr.decision,
          lineNumber,
          matchType: AdrMatchType.DirectReference,
          matchedText: directMatch[0],
          summary: this.getSummary(parsedAdr),
        });
      }
    }

    // Check against each parsed ADR
    for (const [, parsedAdr] of this.parsedAdrCache) {
      // Skip if we already have a direct reference to this ADR on this line
      if (mappings.some((m) => m.decision.id === parsedAdr.decision.id)) {
        continue;
      }

      // Check for pattern matches (e.g., Factory, Repository, Singleton)
      for (const pattern of parsedAdr.patterns) {
        if (this.matchesPattern(lineLower, pattern)) {
          mappings.push({
            decision: parsedAdr.decision,
            lineNumber,
            matchType: AdrMatchType.PatternMatch,
            matchedText: pattern,
            summary: this.getSummary(parsedAdr),
          });
          break;
        }
      }

      // Check for module matches
      for (const module of parsedAdr.modules) {
        if (relativePath.includes(module) || lineLower.includes(module.toLowerCase())) {
          mappings.push({
            decision: parsedAdr.decision,
            lineNumber,
            matchType: AdrMatchType.ModuleMatch,
            matchedText: module,
            summary: this.getSummary(parsedAdr),
          });
          break;
        }
      }

      // Check for technology matches
      for (const tech of parsedAdr.technologies) {
        if (this.matchesTechnology(line, tech)) {
          mappings.push({
            decision: parsedAdr.decision,
            lineNumber,
            matchType: AdrMatchType.TechnologyMatch,
            matchedText: tech,
            summary: this.getSummary(parsedAdr),
          });
          break;
        }
      }

      // Check for keyword matches (only if we haven't found other matches for this ADR)
      if (!mappings.some((m) => m.decision.id === parsedAdr.decision.id)) {
        for (const keyword of parsedAdr.keywords) {
          if (keyword.length >= 4 && this.matchesKeyword(lineLower, keyword)) {
            mappings.push({
              decision: parsedAdr.decision,
              lineNumber,
              matchType: AdrMatchType.KeywordMatch,
              matchedText: keyword,
              summary: this.getSummary(parsedAdr),
            });
            break;
          }
        }
      }
    }

    return mappings;
  }

  /**
   * Refresh the ADR cache if expired
   */
  private async refreshCache(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_TTL_MS && this.parsedAdrCache.size > 0) {
      return;
    }

    try {
      const decisions = await this.memoryBankService.getDecisions();

      for (const decision of decisions) {
        if (this.parsedAdrCache.has(decision.filePath)) {
          continue;
        }

        const content = await this.readFileContent(decision.filePath);
        if (content) {
          const parsed = this.parseAdr(decision, content);
          this.parsedAdrCache.set(decision.filePath, parsed);
        }
      }

      this.cacheTimestamp = now;
    } catch {
      // Memory Bank not available
    }
  }

  /**
   * Parse an ADR file to extract searchable content
   */
  private parseAdr(decision: Decision, content: string): ParsedAdr {
    return {
      decision,
      keywords: this.extractKeywords(content, decision.title),
      patterns: this.extractPatterns(content),
      modules: this.extractModules(content),
      technologies: this.extractTechnologies(content),
      context: this.extractSection(content, 'Context') || '',
      decisionText: this.extractSection(content, 'Decision') || '',
    };
  }

  /**
   * Extract keywords from ADR content
   */
  private extractKeywords(content: string, title: string): string[] {
    const keywords = new Set<string>();

    // Add words from title (split by spaces and hyphens)
    title
      .split(/[\s-]+/)
      .filter((w) => w.length >= 3)
      .forEach((w) => keywords.add(w.toLowerCase()));

    // Extract bold terms from content
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    while ((match = boldRegex.exec(content)) !== null) {
      const words = match[1].split(/\s+/).filter((w) => w.length >= 3);
      words.forEach((w) => keywords.add(w.toLowerCase()));
    }

    // Extract backtick terms (code references)
    const codeRegex = /`([^`]+)`/g;
    while ((match = codeRegex.exec(content)) !== null) {
      const term = match[1].trim();
      if (term.length >= 3 && !term.includes(' ')) {
        keywords.add(term.toLowerCase());
      }
    }

    // Remove common stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'this', 'that', 'with', 'from', 'are', 'was', 'were',
      'been', 'being', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'use', 'used', 'using',
    ]);

    return [...keywords].filter((k) => !stopWords.has(k));
  }

  /**
   * Extract design patterns mentioned in ADR
   */
  private extractPatterns(content: string): string[] {
    const patterns: string[] = [];
    const patternKeywords = [
      'factory', 'singleton', 'builder', 'adapter', 'decorator',
      'observer', 'strategy', 'repository', 'service', 'controller',
      'middleware', 'handler', 'provider', 'facade', 'proxy',
      'command', 'state', 'template', 'visitor', 'mediator',
      'chain', 'iterator', 'composite', 'bridge', 'flyweight',
    ];

    const contentLower = content.toLowerCase();
    for (const pattern of patternKeywords) {
      if (contentLower.includes(pattern)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Extract module/path references from ADR
   */
  private extractModules(content: string): string[] {
    const modules: string[] = [];

    // Match path-like patterns
    const pathRegex = /`([a-zA-Z0-9_/-]+\/[a-zA-Z0-9_/-]+)`/g;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      modules.push(match[1]);
    }

    // Match src/*, lib/*, packages/* patterns
    const dirRegex = /\b(src|lib|packages|modules|services|controllers|models|views|components)\/[a-zA-Z0-9_/-]+/g;
    while ((match = dirRegex.exec(content)) !== null) {
      modules.push(match[0]);
    }

    return [...new Set(modules)];
  }

  /**
   * Extract technology/framework references from ADR
   */
  private extractTechnologies(content: string): string[] {
    const technologies: string[] = [];
    const techKeywords = [
      'typescript', 'javascript', 'react', 'angular', 'vue',
      'node', 'express', 'nestjs', 'spring', 'dotnet',
      'postgresql', 'mongodb', 'redis', 'mysql', 'sqlite',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp',
      'graphql', 'rest', 'grpc', 'websocket', 'http',
      'jest', 'mocha', 'junit', 'pytest', 'vitest',
    ];

    const contentLower = content.toLowerCase();
    for (const tech of techKeywords) {
      if (contentLower.includes(tech)) {
        technologies.push(tech);
      }
    }

    return technologies;
  }

  /**
   * Extract a specific section from markdown content
   */
  private extractSection(content: string, sectionName: string): string | undefined {
    const regex = new RegExp(`##\\s*${sectionName}\\s*\\n+([\\s\\S]*?)(?=##|$)`, 'i');
    const match = content.match(regex);
    if (match) {
      const text = match[1].trim().replace(/<!--[\s\S]*?-->/g, '').trim();
      return text || undefined;
    }
    return undefined;
  }

  /**
   * Check if a line matches a design pattern
   */
  private matchesPattern(lineLower: string, pattern: string): boolean {
    // Check for pattern in class/function names
    const patternLower = pattern.toLowerCase();

    // Match patterns like UserFactory, createFactory, FactoryMethod
    const regex = new RegExp(`\\b\\w*${patternLower}\\w*\\b`, 'i');
    return regex.test(lineLower);
  }

  /**
   * Check if a line references a technology
   */
  private matchesTechnology(line: string, tech: string): boolean {
    const techLower = tech.toLowerCase();

    // Check for imports/requires
    if (line.includes('import') || line.includes('require') || line.includes('from')) {
      return line.toLowerCase().includes(techLower);
    }

    // Check for decorators (e.g., @Injectable for NestJS)
    if (line.includes('@')) {
      return line.toLowerCase().includes(techLower);
    }

    return false;
  }

  /**
   * Check if a line contains a keyword
   */
  private matchesKeyword(lineLower: string, keyword: string): boolean {
    // Only match as whole words or parts of identifiers
    const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
    return regex.test(lineLower);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Find an ADR by its ID
   */
  private findAdrById(id: string): ParsedAdr | undefined {
    for (const [, parsedAdr] of this.parsedAdrCache) {
      if (parsedAdr.decision.id === id) {
        return parsedAdr;
      }
    }
    return undefined;
  }

  /**
   * Get a summary for tooltip display
   */
  private getSummary(parsedAdr: ParsedAdr): string {
    const decisionText = parsedAdr.decisionText || parsedAdr.context || '';
    if (decisionText) {
      const cleaned = decisionText.replace(/\n+/g, ' ').trim();
      return cleaned.length > 150 ? cleaned.slice(0, 147) + '...' : cleaned;
    }
    return `Architecture decision: ${parsedAdr.decision.title}`;
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
   * Deduplicate mappings (keep highest priority match type per ADR per line)
   */
  private deduplicateMappings(mappings: AdrMapping[]): AdrMapping[] {
    const priority: Record<AdrMatchType, number> = {
      [AdrMatchType.DirectReference]: 5,
      [AdrMatchType.PatternMatch]: 4,
      [AdrMatchType.ModuleMatch]: 3,
      [AdrMatchType.TechnologyMatch]: 2,
      [AdrMatchType.KeywordMatch]: 1,
    };

    const seen = new Map<string, AdrMapping>();

    for (const mapping of mappings) {
      const key = `${mapping.decision.id}:${mapping.lineNumber}`;
      const existing = seen.get(key);

      if (!existing || priority[mapping.matchType] > priority[existing.matchType]) {
        seen.set(key, mapping);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.parsedAdrCache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Invalidate a specific ADR from cache
   */
  invalidateAdr(filePath: string): void {
    this.parsedAdrCache.delete(filePath);
  }
}
