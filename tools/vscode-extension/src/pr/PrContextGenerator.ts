/**
 * PR Context Generator - US-015
 * Implements: Generación de Contexto para PRs
 *
 * This module provides automatic generation of rich context for Pull Requests,
 * including semantic diff analysis, ADR detection, pattern identification,
 * reviewer suggestions, and breaking change detection.
 *
 * Acceptance Criteria:
 * - AC-015.1: Generates PR description based on commits and context
 * - AC-015.2: Includes related ADRs with the changes
 * - AC-015.3: Lists patterns used or modified
 * - AC-015.4: Suggests reviewers based on module ownership
 * - AC-015.5: Detects potential breaking changes
 */

import * as vscode from 'vscode';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a commit in a PR
 */
export interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  body?: string;
  author: string;
  authorEmail: string;
  date: Date;
  files: string[];
}

/**
 * Represents a file change in a PR
 */
export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
  diff?: string;
}

/**
 * Represents a semantic change category
 */
export type ChangeCategory =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'documentation'
  | 'test'
  | 'configuration'
  | 'dependency'
  | 'security'
  | 'performance'
  | 'style';

/**
 * Semantic analysis result for a diff
 */
export interface SemanticDiffAnalysis {
  categories: ChangeCategory[];
  primaryCategory: ChangeCategory;
  summary: string;
  impacts: ImpactAnalysis[];
  complexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedModules: string[];
  affectedLayers: string[];
}

/**
 * Impact analysis for changes
 */
export interface ImpactAnalysis {
  area: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * ADR (Architecture Decision Record) reference
 */
export interface RelatedAdr {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  relevance: 'high' | 'medium' | 'low';
  reason: string;
  filePath: string;
}

/**
 * Pattern detected in changes
 */
export interface DetectedPattern {
  name: string;
  type: 'architectural' | 'design' | 'coding' | 'security';
  usage: 'introduced' | 'modified' | 'removed' | 'applied';
  files: string[];
  description: string;
  documentationLink?: string;
}

/**
 * Suggested reviewer
 */
export interface SuggestedReviewer {
  username: string;
  displayName?: string;
  email?: string;
  reason: string;
  expertise: string[];
  relevanceScore: number;
  modules: string[];
}

/**
 * Breaking change detection result
 */
export interface BreakingChange {
  type: 'api' | 'schema' | 'contract' | 'behavior' | 'configuration';
  severity: 'minor' | 'major' | 'critical';
  description: string;
  location: CodeLocation;
  affectedConsumers: string[];
  migrationRequired: boolean;
  suggestedMigration?: string;
}

/**
 * Code location reference
 */
export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  content?: string;
}

/**
 * Module ownership information
 */
export interface ModuleOwnership {
  module: string;
  path: string;
  owners: string[];
  contributors: string[];
  lastModified: Date;
  expertise: string[];
}

/**
 * Complete PR context
 */
export interface PrContext {
  title: string;
  description: string;
  summary: string;
  commits: Commit[];
  fileChanges: FileChange[];
  semanticAnalysis: SemanticDiffAnalysis;
  relatedAdrs: RelatedAdr[];
  detectedPatterns: DetectedPattern[];
  suggestedReviewers: SuggestedReviewer[];
  breakingChanges: BreakingChange[];
  labels: string[];
  testingChecklist: string[];
  deploymentNotes: string[];
  generatedAt: Date;
}

/**
 * Options for PR context generation
 */
export interface PrContextOptions {
  baseBranch?: string;
  headBranch?: string;
  includeCommitDetails?: boolean;
  maxCommits?: number;
  detectPatterns?: boolean;
  suggestReviewers?: boolean;
  detectBreakingChanges?: boolean;
  includeTestChecklist?: boolean;
}

// ============================================================================
// PR Context Generator Class
// ============================================================================

/**
 * Main class for generating rich PR context
 * Implements all acceptance criteria for US-015
 */
export class PrContextGenerator implements vscode.Disposable {
  private static instance: PrContextGenerator | undefined;
  private disposables: vscode.Disposable[] = [];
  private memoryBankPath: string;
  private outputChannel: vscode.OutputChannel;
  private moduleOwnershipCache: Map<string, ModuleOwnership> = new Map();
  private adrCache: Map<string, RelatedAdr[]> = new Map();
  private patternCache: Map<string, DetectedPattern[]> = new Map();
  private cacheTimeout: number = 60000; // 1 minute cache

  private constructor() {
    const config = vscode.workspace.getConfiguration('egce');
    this.memoryBankPath = config.get<string>('memoryBankPath', '.memory-bank');
    this.outputChannel = vscode.window.createOutputChannel('EGCE PR Context');
    this.disposables.push(this.outputChannel);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PrContextGenerator {
    if (!PrContextGenerator.instance) {
      PrContextGenerator.instance = new PrContextGenerator();
    }
    return PrContextGenerator.instance;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.moduleOwnershipCache.clear();
    this.adrCache.clear();
    this.patternCache.clear();
    PrContextGenerator.instance = undefined;
  }

  // ==========================================================================
  // T-015.1: Semantic Diff Analyzer (5 SP)
  // ==========================================================================

  /**
   * Analyzes the diff semantically to understand the nature of changes
   * AC-015.1: Generates description based on commits and context
   */
  public async analyzeSemanticDiff(
    fileChanges: FileChange[],
    commits: Commit[]
  ): Promise<SemanticDiffAnalysis> {
    this.log('Analyzing semantic diff...');

    const categories = this.detectChangeCategories(fileChanges, commits);
    const primaryCategory = this.determinePrimaryCategory(categories, fileChanges);
    const affectedModules = this.extractAffectedModules(fileChanges);
    const affectedLayers = this.extractAffectedLayers(fileChanges);
    const impacts = this.analyzeImpacts(fileChanges, affectedModules);
    const complexity = this.calculateComplexity(fileChanges, commits);
    const riskLevel = this.calculateRiskLevel(fileChanges, impacts, affectedLayers);

    const summary = this.generateChangeSummary(
      primaryCategory,
      affectedModules,
      commits.length,
      fileChanges.length
    );

    return {
      categories,
      primaryCategory,
      summary,
      impacts,
      complexity,
      riskLevel,
      affectedModules,
      affectedLayers,
    };
  }

  /**
   * Detects change categories based on file patterns and commit messages
   */
  private detectChangeCategories(
    fileChanges: FileChange[],
    commits: Commit[]
  ): ChangeCategory[] {
    const categories = new Set<ChangeCategory>();

    // Analyze commit messages
    for (const commit of commits) {
      const message = commit.message.toLowerCase();

      if (message.includes('feat') || message.includes('feature') || message.includes('add')) {
        categories.add('feature');
      }
      if (message.includes('fix') || message.includes('bug') || message.includes('hotfix')) {
        categories.add('bugfix');
      }
      if (message.includes('refactor') || message.includes('restructure') || message.includes('clean')) {
        categories.add('refactor');
      }
      if (message.includes('doc') || message.includes('readme') || message.includes('comment')) {
        categories.add('documentation');
      }
      if (message.includes('test') || message.includes('spec') || message.includes('coverage')) {
        categories.add('test');
      }
      if (message.includes('config') || message.includes('setting') || message.includes('env')) {
        categories.add('configuration');
      }
      if (message.includes('depend') || message.includes('upgrade') || message.includes('bump')) {
        categories.add('dependency');
      }
      if (message.includes('security') || message.includes('vuln') || message.includes('auth')) {
        categories.add('security');
      }
      if (message.includes('perf') || message.includes('optim') || message.includes('speed')) {
        categories.add('performance');
      }
      if (message.includes('style') || message.includes('format') || message.includes('lint')) {
        categories.add('style');
      }
    }

    // Analyze file patterns
    for (const file of fileChanges) {
      const filePath = file.path.toLowerCase();
      const fileName = path.basename(filePath);

      if (filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__')) {
        categories.add('test');
      }
      if (filePath.includes('doc') || fileName.endsWith('.md')) {
        categories.add('documentation');
      }
      if (fileName.includes('config') || fileName.includes('.env') || filePath.includes('settings')) {
        categories.add('configuration');
      }
      if (fileName === 'package.json' || fileName === 'pom.xml' || fileName.endsWith('.csproj')) {
        categories.add('dependency');
      }
    }

    // Default to feature if no category detected
    if (categories.size === 0) {
      categories.add('feature');
    }

    return Array.from(categories);
  }

  /**
   * Determines the primary category based on impact and frequency
   */
  private determinePrimaryCategory(
    categories: ChangeCategory[],
    fileChanges: FileChange[]
  ): ChangeCategory {
    // Priority order for categories
    const priorityOrder: ChangeCategory[] = [
      'security',
      'bugfix',
      'feature',
      'performance',
      'refactor',
      'dependency',
      'test',
      'documentation',
      'configuration',
      'style',
    ];

    // Return highest priority category found
    for (const category of priorityOrder) {
      if (categories.includes(category)) {
        return category;
      }
    }

    return 'feature';
  }

  /**
   * Extracts affected modules from file changes
   */
  private extractAffectedModules(fileChanges: FileChange[]): string[] {
    const modules = new Set<string>();

    for (const file of fileChanges) {
      const parts = file.path.split('/');

      // Extract module from common patterns
      if (parts.length >= 2) {
        // src/module/... or packages/module/...
        if (parts[0] === 'src' || parts[0] === 'packages' || parts[0] === 'libs') {
          modules.add(parts[1]);
        }
        // module/src/...
        else if (parts[1] === 'src' || parts[1] === 'lib') {
          modules.add(parts[0]);
        }
        // Default: use first directory
        else {
          modules.add(parts[0]);
        }
      }
    }

    return Array.from(modules);
  }

  /**
   * Extracts affected architectural layers from file changes
   */
  private extractAffectedLayers(fileChanges: FileChange[]): string[] {
    const layers = new Set<string>();

    const layerPatterns: Record<string, RegExp[]> = {
      'presentation': [/controller/i, /view/i, /component/i, /page/i, /ui\//i],
      'application': [/service/i, /usecase/i, /handler/i, /facade/i],
      'domain': [/domain/i, /entity/i, /model/i, /aggregate/i],
      'infrastructure': [/repository/i, /adapter/i, /client/i, /gateway/i],
      'api': [/api\//i, /endpoint/i, /route/i, /controller/i],
      'database': [/migration/i, /schema/i, /entity/i, /repository/i],
      'configuration': [/config/i, /setting/i, /\.env/i, /properties/i],
    };

    for (const file of fileChanges) {
      for (const [layer, patterns] of Object.entries(layerPatterns)) {
        if (patterns.some(pattern => pattern.test(file.path))) {
          layers.add(layer);
        }
      }
    }

    return Array.from(layers);
  }

  /**
   * Analyzes impacts of the changes
   */
  private analyzeImpacts(fileChanges: FileChange[], modules: string[]): ImpactAnalysis[] {
    const impacts: ImpactAnalysis[] = [];

    // Check for API changes
    const apiFiles = fileChanges.filter(f =>
      /api|controller|endpoint|route/i.test(f.path)
    );
    if (apiFiles.length > 0) {
      impacts.push({
        area: 'API',
        description: `${apiFiles.length} API file(s) modified - may affect external consumers`,
        severity: 'warning',
      });
    }

    // Check for database changes
    const dbFiles = fileChanges.filter(f =>
      /migration|schema|entity|model/i.test(f.path)
    );
    if (dbFiles.length > 0) {
      impacts.push({
        area: 'Database',
        description: `${dbFiles.length} database-related file(s) modified - may require migrations`,
        severity: 'warning',
      });
    }

    // Check for configuration changes
    const configFiles = fileChanges.filter(f =>
      /config|\.env|setting|propert/i.test(f.path)
    );
    if (configFiles.length > 0) {
      impacts.push({
        area: 'Configuration',
        description: `${configFiles.length} configuration file(s) modified - review deployment settings`,
        severity: 'info',
      });
    }

    // Check for security-related changes
    const securityFiles = fileChanges.filter(f =>
      /auth|security|permission|role|token|cred/i.test(f.path)
    );
    if (securityFiles.length > 0) {
      impacts.push({
        area: 'Security',
        description: `${securityFiles.length} security-related file(s) modified - security review recommended`,
        severity: 'critical',
      });
    }

    // Check for multi-module changes
    if (modules.length > 3) {
      impacts.push({
        area: 'Cross-cutting',
        description: `Changes span ${modules.length} modules - coordination may be needed`,
        severity: 'warning',
      });
    }

    return impacts;
  }

  /**
   * Calculates the complexity of changes
   */
  private calculateComplexity(
    fileChanges: FileChange[],
    commits: Commit[]
  ): 'low' | 'medium' | 'high' {
    const totalLines = fileChanges.reduce((sum, f) => sum + f.additions + f.deletions, 0);
    const fileCount = fileChanges.length;

    // High complexity indicators
    if (totalLines > 1000 || fileCount > 30 || commits.length > 20) {
      return 'high';
    }

    // Medium complexity indicators
    if (totalLines > 300 || fileCount > 10 || commits.length > 5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculates risk level of changes
   */
  private calculateRiskLevel(
    fileChanges: FileChange[],
    impacts: ImpactAnalysis[],
    layers: string[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical if security impact
    if (impacts.some(i => i.area === 'Security')) {
      return 'critical';
    }

    // High if multiple critical areas affected
    const criticalAreas = ['API', 'Database', 'Security'];
    const criticalImpacts = impacts.filter(i => criticalAreas.includes(i.area)).length;
    if (criticalImpacts >= 2) {
      return 'high';
    }

    // High if many layers affected
    if (layers.length >= 4) {
      return 'high';
    }

    // Medium if API or Database affected
    if (impacts.some(i => i.area === 'API' || i.area === 'Database')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generates a human-readable summary of changes
   */
  private generateChangeSummary(
    category: ChangeCategory,
    modules: string[],
    commitCount: number,
    fileCount: number
  ): string {
    const categoryLabels: Record<ChangeCategory, string> = {
      feature: 'New feature',
      bugfix: 'Bug fix',
      refactor: 'Code refactoring',
      documentation: 'Documentation update',
      test: 'Test improvements',
      configuration: 'Configuration changes',
      dependency: 'Dependency updates',
      security: 'Security improvements',
      performance: 'Performance optimization',
      style: 'Code style changes',
    };

    const moduleList = modules.length <= 3
      ? modules.join(', ')
      : `${modules.slice(0, 3).join(', ')} and ${modules.length - 3} more`;

    return `${categoryLabels[category]} affecting ${moduleList} (${commitCount} commit${commitCount !== 1 ? 's' : ''}, ${fileCount} file${fileCount !== 1 ? 's' : ''})`;
  }

  // ==========================================================================
  // T-015.2: PR Description Generator (3 SP)
  // ==========================================================================

  /**
   * Generates a complete PR description
   * AC-015.1: Generates description based on commits and context
   */
  public async generatePrDescription(
    commits: Commit[],
    fileChanges: FileChange[],
    semanticAnalysis: SemanticDiffAnalysis,
    relatedAdrs: RelatedAdr[],
    detectedPatterns: DetectedPattern[],
    breakingChanges: BreakingChange[]
  ): Promise<{ title: string; description: string }> {
    this.log('Generating PR description...');

    const title = this.generatePrTitle(commits, semanticAnalysis);
    const description = this.buildPrDescription(
      commits,
      fileChanges,
      semanticAnalysis,
      relatedAdrs,
      detectedPatterns,
      breakingChanges
    );

    return { title, description };
  }

  /**
   * Generates a concise PR title
   */
  private generatePrTitle(commits: Commit[], analysis: SemanticDiffAnalysis): string {
    const categoryPrefixes: Record<ChangeCategory, string> = {
      feature: 'feat',
      bugfix: 'fix',
      refactor: 'refactor',
      documentation: 'docs',
      test: 'test',
      configuration: 'config',
      dependency: 'deps',
      security: 'security',
      performance: 'perf',
      style: 'style',
    };

    const prefix = categoryPrefixes[analysis.primaryCategory];
    const scope = analysis.affectedModules.length === 1
      ? `(${analysis.affectedModules[0]})`
      : analysis.affectedModules.length > 1
        ? `(${analysis.affectedModules[0]},+${analysis.affectedModules.length - 1})`
        : '';

    // Use first commit message as base, cleaned up
    const baseMessage = commits[0]?.message || 'Update codebase';
    const cleanMessage = baseMessage
      .replace(/^(feat|fix|docs|test|refactor|chore|style|perf|ci)(\(.+\))?:\s*/i, '')
      .replace(/\n.*/s, '')
      .trim();

    return `${prefix}${scope}: ${cleanMessage}`;
  }

  /**
   * Builds the complete PR description body
   */
  private buildPrDescription(
    commits: Commit[],
    fileChanges: FileChange[],
    analysis: SemanticDiffAnalysis,
    relatedAdrs: RelatedAdr[],
    patterns: DetectedPattern[],
    breakingChanges: BreakingChange[]
  ): string {
    const sections: string[] = [];

    // Summary section
    sections.push('## Summary\n');
    sections.push(analysis.summary + '\n');

    // Risk and complexity badges
    sections.push(`**Complexity:** ${this.getComplexityBadge(analysis.complexity)} | `);
    sections.push(`**Risk:** ${this.getRiskBadge(analysis.riskLevel)}\n`);

    // Changes overview
    sections.push('\n## Changes Overview\n');
    sections.push(`- **Files changed:** ${fileChanges.length}`);
    sections.push(`- **Lines added:** +${fileChanges.reduce((s, f) => s + f.additions, 0)}`);
    sections.push(`- **Lines removed:** -${fileChanges.reduce((s, f) => s + f.deletions, 0)}`);
    sections.push(`- **Modules affected:** ${analysis.affectedModules.join(', ') || 'N/A'}`);
    sections.push(`- **Layers affected:** ${analysis.affectedLayers.join(', ') || 'N/A'}\n`);

    // Breaking changes (if any)
    if (breakingChanges.length > 0) {
      sections.push('\n## ⚠️ Breaking Changes\n');
      for (const bc of breakingChanges) {
        sections.push(`### ${bc.severity.toUpperCase()}: ${bc.type}`);
        sections.push(`- **Description:** ${bc.description}`);
        sections.push(`- **Location:** \`${bc.location.file}:${bc.location.startLine}\``);
        if (bc.migrationRequired && bc.suggestedMigration) {
          sections.push(`- **Migration:** ${bc.suggestedMigration}`);
        }
        sections.push('');
      }
    }

    // Related ADRs
    if (relatedAdrs.length > 0) {
      sections.push('\n## 📋 Related Architecture Decisions\n');
      for (const adr of relatedAdrs) {
        const statusIcon = this.getAdrStatusIcon(adr.status);
        sections.push(`- ${statusIcon} **[${adr.id}] ${adr.title}** (${adr.relevance} relevance)`);
        sections.push(`  - Reason: ${adr.reason}`);
      }
      sections.push('');
    }

    // Detected patterns
    if (patterns.length > 0) {
      sections.push('\n## 🏗️ Patterns\n');
      for (const pattern of patterns) {
        const usageIcon = this.getPatternUsageIcon(pattern.usage);
        sections.push(`- ${usageIcon} **${pattern.name}** (${pattern.type})`);
        sections.push(`  - ${pattern.description}`);
      }
      sections.push('');
    }

    // Impacts
    if (analysis.impacts.length > 0) {
      sections.push('\n## 📊 Impact Analysis\n');
      for (const impact of analysis.impacts) {
        const severityIcon = impact.severity === 'critical' ? '🔴' : impact.severity === 'warning' ? '🟡' : '🟢';
        sections.push(`- ${severityIcon} **${impact.area}:** ${impact.description}`);
      }
      sections.push('');
    }

    // Commits
    sections.push('\n## 📝 Commits\n');
    for (const commit of commits.slice(0, 10)) {
      sections.push(`- \`${commit.shortHash}\` ${commit.message}`);
    }
    if (commits.length > 10) {
      sections.push(`- ... and ${commits.length - 10} more commits`);
    }
    sections.push('');

    // Testing checklist
    sections.push('\n## ✅ Testing Checklist\n');
    sections.push('- [ ] Unit tests pass');
    sections.push('- [ ] Integration tests pass');
    if (analysis.riskLevel === 'high' || analysis.riskLevel === 'critical') {
      sections.push('- [ ] Manual testing completed');
      sections.push('- [ ] Performance regression checked');
    }
    if (breakingChanges.length > 0) {
      sections.push('- [ ] Migration scripts tested');
      sections.push('- [ ] Backward compatibility verified');
    }
    sections.push('');

    // Footer
    sections.push('\n---');
    sections.push('*Generated by EGCE PR Context Generator*');

    return sections.join('\n');
  }

  private getComplexityBadge(complexity: 'low' | 'medium' | 'high'): string {
    const badges: Record<string, string> = {
      low: '🟢 Low',
      medium: '🟡 Medium',
      high: '🔴 High',
    };
    return badges[complexity];
  }

  private getRiskBadge(risk: 'low' | 'medium' | 'high' | 'critical'): string {
    const badges: Record<string, string> = {
      low: '🟢 Low',
      medium: '🟡 Medium',
      high: '🟠 High',
      critical: '🔴 Critical',
    };
    return badges[risk];
  }

  private getAdrStatusIcon(status: RelatedAdr['status']): string {
    const icons: Record<string, string> = {
      proposed: '📝',
      accepted: '✅',
      deprecated: '⚠️',
      superseded: '🔄',
    };
    return icons[status] || '📋';
  }

  private getPatternUsageIcon(usage: DetectedPattern['usage']): string {
    const icons: Record<string, string> = {
      introduced: '➕',
      modified: '✏️',
      removed: '➖',
      applied: '✓',
    };
    return icons[usage] || '•';
  }

  // ==========================================================================
  // T-015.3: ADR Detection Integration (2 SP)
  // ==========================================================================

  /**
   * Finds ADRs related to the changes
   * AC-015.2: Includes related ADRs with the changes
   */
  public async findRelatedAdrs(
    fileChanges: FileChange[],
    affectedModules: string[]
  ): Promise<RelatedAdr[]> {
    this.log('Finding related ADRs...');

    const relatedAdrs: RelatedAdr[] = [];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return relatedAdrs;
    }

    const memoryBankUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      this.memoryBankPath
    );

    try {
      // Look for ADR files
      const adrPatterns = [
        new vscode.RelativePattern(memoryBankUri, '**/adr-*.md'),
        new vscode.RelativePattern(memoryBankUri, '**/ADR-*.md'),
        new vscode.RelativePattern(memoryBankUri, '**/decisions/*.md'),
      ];

      const adrFiles: vscode.Uri[] = [];
      for (const pattern of adrPatterns) {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
        adrFiles.push(...files);
      }

      // Analyze each ADR for relevance
      for (const adrFile of adrFiles) {
        const content = await this.readFile(adrFile);
        if (!content) continue;

        const adr = this.parseAdr(adrFile, content);
        if (!adr) continue;

        const relevance = this.calculateAdrRelevance(
          adr,
          fileChanges,
          affectedModules,
          content
        );

        if (relevance.score > 0.3) {
          relatedAdrs.push({
            id: adr.id,
            title: adr.title,
            status: adr.status,
            relevance: relevance.level,
            reason: relevance.reason,
            filePath: vscode.workspace.asRelativePath(adrFile),
          });
        }
      }

      // Sort by relevance
      relatedAdrs.sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return order[b.relevance] - order[a.relevance];
      });

      return relatedAdrs.slice(0, 10); // Limit to top 10
    } catch (error) {
      this.log(`Error finding related ADRs: ${error}`);
      return relatedAdrs;
    }
  }

  /**
   * Parses an ADR file
   */
  private parseAdr(uri: vscode.Uri, content: string): {
    id: string;
    title: string;
    status: RelatedAdr['status'];
  } | null {
    const fileName = path.basename(uri.fsPath, '.md');

    // Extract ID from filename (e.g., adr-001, ADR-002)
    const idMatch = fileName.match(/(?:adr|ADR)-?(\d+)/i);
    const id = idMatch ? `ADR-${idMatch[1].padStart(3, '0')}` : fileName;

    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].replace(/^(?:ADR-?\d+[:\s-]*)/i, '').trim() : fileName;

    // Extract status
    const statusMatch = content.match(/\*\*Status\*\*:\s*(\w+)/i) ||
      content.match(/Status:\s*(\w+)/i);
    let status: RelatedAdr['status'] = 'accepted';

    if (statusMatch) {
      const statusText = statusMatch[1].toLowerCase();
      if (statusText.includes('propos')) status = 'proposed';
      else if (statusText.includes('deprecat')) status = 'deprecated';
      else if (statusText.includes('supersed')) status = 'superseded';
    }

    return { id, title, status };
  }

  /**
   * Calculates relevance score of an ADR to the changes
   */
  private calculateAdrRelevance(
    adr: { id: string; title: string; status: RelatedAdr['status'] },
    fileChanges: FileChange[],
    modules: string[],
    content: string
  ): { score: number; level: 'high' | 'medium' | 'low'; reason: string } {
    let score = 0;
    const reasons: string[] = [];
    const contentLower = content.toLowerCase();

    // Check for module mentions
    for (const module of modules) {
      if (contentLower.includes(module.toLowerCase())) {
        score += 0.3;
        reasons.push(`Mentions module "${module}"`);
      }
    }

    // Check for file path mentions
    for (const file of fileChanges) {
      const fileName = path.basename(file.path, path.extname(file.path));
      if (contentLower.includes(fileName.toLowerCase())) {
        score += 0.2;
        reasons.push(`References file "${fileName}"`);
      }
    }

    // Check for pattern keywords
    const changedExtensions = new Set(fileChanges.map(f => path.extname(f.path)));
    const techKeywords: Record<string, string[]> = {
      '.java': ['java', 'spring', 'jpa', 'hibernate'],
      '.ts': ['typescript', 'angular', 'react', 'node'],
      '.cs': ['csharp', 'dotnet', 'entity framework'],
      '.py': ['python', 'django', 'flask'],
    };

    for (const ext of changedExtensions) {
      const keywords = techKeywords[ext] || [];
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          score += 0.1;
          reasons.push(`Related to ${keyword} technology`);
          break;
        }
      }
    }

    // Determine level
    let level: 'high' | 'medium' | 'low' = 'low';
    if (score >= 0.6) level = 'high';
    else if (score >= 0.4) level = 'medium';

    return {
      score: Math.min(score, 1),
      level,
      reason: reasons.slice(0, 2).join('; ') || 'Potentially relevant based on context',
    };
  }

  // ==========================================================================
  // T-015.3: Pattern Detection (Part of 2 SP with ADR detection)
  // ==========================================================================

  /**
   * Identifies patterns used or modified in the changes
   * AC-015.3: Lists patterns used or modified
   */
  public async identifyPatterns(
    fileChanges: FileChange[],
    diffs: Map<string, string>
  ): Promise<DetectedPattern[]> {
    this.log('Identifying patterns...');

    const patterns: DetectedPattern[] = [];

    // Define pattern detection rules
    const patternRules: Array<{
      name: string;
      type: DetectedPattern['type'];
      filePatterns: RegExp[];
      codePatterns?: RegExp[];
      description: string;
    }> = [
      {
        name: 'Repository Pattern',
        type: 'architectural',
        filePatterns: [/repository/i, /repo\./i],
        codePatterns: [/interface\s+\w*Repository/i, /class\s+\w*Repository/i],
        description: 'Data access abstraction layer for domain entities',
      },
      {
        name: 'Service Layer Pattern',
        type: 'architectural',
        filePatterns: [/service\./i, /\.service\./i],
        codePatterns: [/@Service/i, /class\s+\w*Service/i],
        description: 'Business logic encapsulation in service classes',
      },
      {
        name: 'Factory Pattern',
        type: 'design',
        filePatterns: [/factory/i],
        codePatterns: [/class\s+\w*Factory/i, /create\w+\(/i],
        description: 'Object creation abstraction for complex instantiation',
      },
      {
        name: 'Singleton Pattern',
        type: 'design',
        codePatterns: [/getInstance\s*\(/i, /private\s+static\s+\w+\s+instance/i],
        filePatterns: [],
        description: 'Single instance pattern for shared resources',
      },
      {
        name: 'Observer/Event Pattern',
        type: 'design',
        filePatterns: [/event/i, /listener/i, /handler/i],
        codePatterns: [/@EventListener/i, /addEventListener/i, /emit\(/i],
        description: 'Event-driven communication between components',
      },
      {
        name: 'Strategy Pattern',
        type: 'design',
        filePatterns: [/strategy/i],
        codePatterns: [/interface\s+\w*Strategy/i, /class\s+\w*Strategy/i],
        description: 'Interchangeable algorithms encapsulation',
      },
      {
        name: 'DTO Pattern',
        type: 'architectural',
        filePatterns: [/dto\./i, /\.dto\./i, /request\./i, /response\./i],
        codePatterns: [/class\s+\w*Dto/i, /class\s+\w*Request/i, /class\s+\w*Response/i],
        description: 'Data Transfer Objects for layer boundary crossing',
      },
      {
        name: 'Dependency Injection',
        type: 'architectural',
        codePatterns: [/@Inject/i, /@Autowired/i, /constructor\s*\(\s*private/i],
        filePatterns: [],
        description: 'Inversion of Control for dependency management',
      },
      {
        name: 'Controller Pattern',
        type: 'architectural',
        filePatterns: [/controller/i],
        codePatterns: [/@Controller/i, /@RestController/i, /@GetMapping/i, /@PostMapping/i],
        description: 'HTTP request handling and routing',
      },
      {
        name: 'Middleware/Filter Pattern',
        type: 'architectural',
        filePatterns: [/middleware/i, /filter/i, /interceptor/i],
        codePatterns: [/@Filter/i, /implements\s+Filter/i, /next\s*\(/i],
        description: 'Request/response processing pipeline',
      },
      {
        name: 'CQRS Pattern',
        type: 'architectural',
        filePatterns: [/command/i, /query/i],
        codePatterns: [/Command\s*{/i, /Query\s*{/i, /CommandHandler/i, /QueryHandler/i],
        description: 'Command Query Responsibility Segregation',
      },
      {
        name: 'Input Validation',
        type: 'security',
        codePatterns: [/@Valid/i, /@NotNull/i, /@NotEmpty/i, /validate\(/i],
        filePatterns: [/validator/i],
        description: 'Input validation and sanitization',
      },
    ];

    // Analyze each file change
    for (const file of fileChanges) {
      const diff = diffs.get(file.path) || '';

      for (const rule of patternRules) {
        let detected = false;
        let usage: DetectedPattern['usage'] = 'applied';

        // Check file path patterns
        for (const pattern of rule.filePatterns) {
          if (pattern.test(file.path)) {
            detected = true;
            break;
          }
        }

        // Check code patterns in diff
        if (!detected && rule.codePatterns) {
          for (const pattern of rule.codePatterns) {
            if (pattern.test(diff)) {
              detected = true;
              break;
            }
          }
        }

        if (detected) {
          // Determine usage type
          if (file.status === 'added') {
            usage = 'introduced';
          } else if (file.status === 'deleted') {
            usage = 'removed';
          } else if (file.status === 'modified') {
            usage = 'modified';
          }

          // Check if pattern already detected
          const existing = patterns.find(p => p.name === rule.name);
          if (existing) {
            if (!existing.files.includes(file.path)) {
              existing.files.push(file.path);
            }
          } else {
            patterns.push({
              name: rule.name,
              type: rule.type,
              usage,
              files: [file.path],
              description: rule.description,
            });
          }
        }
      }
    }

    return patterns;
  }

  // ==========================================================================
  // T-015.4: Reviewer Suggestion (2 SP)
  // ==========================================================================

  /**
   * Suggests reviewers based on module ownership
   * AC-015.4: Suggests reviewers based on ownership
   */
  public async suggestReviewers(
    fileChanges: FileChange[],
    affectedModules: string[]
  ): Promise<SuggestedReviewer[]> {
    this.log('Suggesting reviewers...');

    const reviewers: Map<string, SuggestedReviewer> = new Map();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return [];
    }

    try {
      // Load CODEOWNERS file if exists
      const codeownersPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        '.github',
        'CODEOWNERS'
      );
      const codeownersContent = await this.readFile(codeownersPath);

      if (codeownersContent) {
        const codeownerMappings = this.parseCodeowners(codeownersContent);

        for (const file of fileChanges) {
          const owners = this.findCodeowners(file.path, codeownerMappings);
          for (const owner of owners) {
            this.addOrUpdateReviewer(reviewers, owner, file.path, 'CODEOWNERS match');
          }
        }
      }

      // Load module ownership from Memory Bank
      const ownershipPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        this.memoryBankPath,
        'team',
        'ownership.md'
      );
      const ownershipContent = await this.readFile(ownershipPath);

      if (ownershipContent) {
        const moduleOwners = this.parseOwnershipFile(ownershipContent);

        for (const module of affectedModules) {
          const ownership = moduleOwners.get(module.toLowerCase());
          if (ownership) {
            for (const owner of ownership.owners) {
              this.addOrUpdateReviewer(
                reviewers,
                owner,
                module,
                `Module owner for ${module}`,
                ownership.expertise
              );
            }
          }
        }
      }

      // Sort by relevance score
      const sortedReviewers = Array.from(reviewers.values())
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      return sortedReviewers.slice(0, 5); // Top 5 reviewers
    } catch (error) {
      this.log(`Error suggesting reviewers: ${error}`);
      return [];
    }
  }

  /**
   * Parses CODEOWNERS file
   */
  private parseCodeowners(content: string): Map<string, string[]> {
    const mappings = new Map<string, string[]>();

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const pattern = parts[0];
        const owners = parts.slice(1).map(o => o.replace('@', ''));
        mappings.set(pattern, owners);
      }
    }

    return mappings;
  }

  /**
   * Finds codeowners for a file path
   */
  private findCodeowners(filePath: string, mappings: Map<string, string[]>): string[] {
    const owners: string[] = [];

    for (const [pattern, patternOwners] of mappings) {
      if (this.matchCodeownerPattern(filePath, pattern)) {
        owners.push(...patternOwners);
      }
    }

    return [...new Set(owners)];
  }

  /**
   * Matches a file path against a CODEOWNERS pattern
   */
  private matchCodeownerPattern(filePath: string, pattern: string): boolean {
    // Simple pattern matching
    if (pattern === '*') return true;
    if (pattern.endsWith('/')) {
      return filePath.startsWith(pattern) || filePath.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return filePath.endsWith(pattern.slice(1));
    }
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$'
      );
      return regex.test(filePath);
    }
    return filePath.startsWith(pattern) || filePath === pattern;
  }

  /**
   * Parses ownership file from Memory Bank
   */
  private parseOwnershipFile(content: string): Map<string, ModuleOwnership> {
    const ownership = new Map<string, ModuleOwnership>();

    // Parse markdown table or list format
    const moduleRegex = /##?\s+(\w+[-\w]*)\s*\n([\s\S]*?)(?=\n##?\s+|\n$|$)/gi;
    let match;

    while ((match = moduleRegex.exec(content)) !== null) {
      const moduleName = match[1].toLowerCase();
      const moduleContent = match[2];

      const owners: string[] = [];
      const expertise: string[] = [];

      // Extract owners
      const ownerMatch = moduleContent.match(/owners?:\s*(.+)/i);
      if (ownerMatch) {
        owners.push(...ownerMatch[1].split(/[,;]/).map(o => o.trim().replace('@', '')));
      }

      // Extract expertise
      const expertiseMatch = moduleContent.match(/expertise:\s*(.+)/i);
      if (expertiseMatch) {
        expertise.push(...expertiseMatch[1].split(/[,;]/).map(e => e.trim()));
      }

      if (owners.length > 0) {
        ownership.set(moduleName, {
          module: moduleName,
          path: '',
          owners,
          contributors: [],
          lastModified: new Date(),
          expertise,
        });
      }
    }

    return ownership;
  }

  /**
   * Adds or updates a reviewer in the map
   */
  private addOrUpdateReviewer(
    reviewers: Map<string, SuggestedReviewer>,
    username: string,
    context: string,
    reason: string,
    expertise?: string[]
  ): void {
    const existing = reviewers.get(username);

    if (existing) {
      existing.relevanceScore += 1;
      if (!existing.modules.includes(context)) {
        existing.modules.push(context);
      }
      if (expertise) {
        existing.expertise = [...new Set([...existing.expertise, ...expertise])];
      }
    } else {
      reviewers.set(username, {
        username,
        reason,
        expertise: expertise || [],
        relevanceScore: 1,
        modules: [context],
      });
    }
  }

  // ==========================================================================
  // T-015.5: Breaking Change Detection (3 SP)
  // ==========================================================================

  /**
   * Detects potential breaking changes
   * AC-015.5: Detects potential breaking changes
   */
  public async detectBreakingChanges(
    fileChanges: FileChange[],
    diffs: Map<string, string>
  ): Promise<BreakingChange[]> {
    this.log('Detecting breaking changes...');

    const breakingChanges: BreakingChange[] = [];

    // Breaking change detection rules
    const detectionRules: Array<{
      type: BreakingChange['type'];
      patterns: {
        file?: RegExp;
        removed?: RegExp;
        description: string;
        severity: BreakingChange['severity'];
        migrationHint?: string;
      }[];
    }> = [
      {
        type: 'api',
        patterns: [
          {
            file: /controller|endpoint|api|route/i,
            removed: /^-\s*(public|@\w+Mapping|@Get|@Post|@Put|@Delete|@Patch).*\(/m,
            description: 'Public API endpoint removed or signature changed',
            severity: 'major',
            migrationHint: 'Update API consumers to use new endpoint signatures',
          },
          {
            file: /controller|endpoint|api|route/i,
            removed: /^-.*@RequestParam.*required\s*=\s*false/m,
            description: 'Optional parameter may have become required',
            severity: 'minor',
            migrationHint: 'Review parameter requirements in API documentation',
          },
        ],
      },
      {
        type: 'schema',
        patterns: [
          {
            file: /migration|schema|\.sql/i,
            removed: /^-\s*(DROP|ALTER.*DROP|DELETE)/im,
            description: 'Database schema destructive change detected',
            severity: 'critical',
            migrationHint: 'Ensure database migration scripts are reversible',
          },
          {
            file: /entity|model/i,
            removed: /^-\s*(private|protected|public)\s+\w+\s+\w+;/m,
            description: 'Entity field removed - may break persistence',
            severity: 'major',
            migrationHint: 'Create migration script for removed fields',
          },
        ],
      },
      {
        type: 'contract',
        patterns: [
          {
            file: /dto|request|response|contract/i,
            removed: /^-\s*(private|public)\s+\w+\s+\w+/m,
            description: 'DTO field removed - may break API consumers',
            severity: 'major',
            migrationHint: 'Consider deprecating field before removal',
          },
          {
            file: /interface/i,
            removed: /^-\s*\w+\s*\([^)]*\)\s*:/m,
            description: 'Interface method removed - breaks implementations',
            severity: 'critical',
            migrationHint: 'Provide default implementation or migration path',
          },
        ],
      },
      {
        type: 'behavior',
        patterns: [
          {
            file: /service|handler|processor/i,
            removed: /^-\s*throw\s+new\s+\w+Exception/m,
            description: 'Exception handling changed - may affect error handling',
            severity: 'minor',
            migrationHint: 'Review exception handling in consumers',
          },
          {
            file: /service|handler/i,
            removed: /^-\s*return\s+null/m,
            description: 'Null return removed - behavior change',
            severity: 'minor',
            migrationHint: 'Update consumers to handle new return values',
          },
        ],
      },
      {
        type: 'configuration',
        patterns: [
          {
            file: /application\.(yml|yaml|properties)|config/i,
            removed: /^-\s*\w+[.:]\w+\s*[=:]/m,
            description: 'Configuration property removed',
            severity: 'minor',
            migrationHint: 'Update deployment configurations',
          },
          {
            file: /\.env/i,
            removed: /^-\s*[A-Z_]+=.*/m,
            description: 'Environment variable removed',
            severity: 'major',
            migrationHint: 'Update environment configuration in all deployments',
          },
        ],
      },
    ];

    // Analyze each file change for breaking changes
    for (const file of fileChanges) {
      if (file.status === 'deleted') {
        // Entire file deleted - could be breaking if public API
        if (/controller|api|service|interface|dto/i.test(file.path)) {
          breakingChanges.push({
            type: 'api',
            severity: 'critical',
            description: `File deleted: ${file.path} - may contain public APIs`,
            location: { file: file.path, startLine: 1, endLine: 1 },
            affectedConsumers: [],
            migrationRequired: true,
            suggestedMigration: 'Verify all consumers have been updated before deletion',
          });
        }
        continue;
      }

      const diff = diffs.get(file.path);
      if (!diff) continue;

      // Apply detection rules
      for (const rule of detectionRules) {
        for (const pattern of rule.patterns) {
          // Check file pattern
          if (pattern.file && !pattern.file.test(file.path)) continue;

          // Check removal pattern
          if (pattern.removed && pattern.removed.test(diff)) {
            const lineMatch = diff.match(pattern.removed);
            const lineNumber = this.findLineNumber(diff, lineMatch?.[0] || '');

            breakingChanges.push({
              type: rule.type,
              severity: pattern.severity,
              description: pattern.description,
              location: {
                file: file.path,
                startLine: lineNumber,
                endLine: lineNumber,
                content: lineMatch?.[0],
              },
              affectedConsumers: [],
              migrationRequired: pattern.severity !== 'minor',
              suggestedMigration: pattern.migrationHint,
            });
          }
        }
      }
    }

    // Sort by severity
    const severityOrder: Record<BreakingChange['severity'], number> = {
      critical: 3,
      major: 2,
      minor: 1,
    };

    return breakingChanges.sort(
      (a, b) => severityOrder[b.severity] - severityOrder[a.severity]
    );
  }

  /**
   * Finds the line number of a match in the diff
   */
  private findLineNumber(diff: string, match: string): number {
    const lines = diff.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match.trim())) {
        // Try to extract actual line number from diff header
        const headerMatch = lines.slice(0, i).reverse().find(l => l.startsWith('@@'));
        if (headerMatch) {
          const lineMatch = headerMatch.match(/@@ -(\d+)/);
          if (lineMatch) {
            return parseInt(lineMatch[1], 10) + i;
          }
        }
        return i + 1;
      }
    }
    return 1;
  }

  // ==========================================================================
  // Main Generation Method
  // ==========================================================================

  /**
   * Generates complete PR context
   * Main entry point for US-015
   */
  public async generatePrContext(
    commits: Commit[],
    fileChanges: FileChange[],
    diffs: Map<string, string>,
    options: PrContextOptions = {}
  ): Promise<PrContext> {
    this.log('Generating PR context...');

    const opts = {
      detectPatterns: true,
      suggestReviewers: true,
      detectBreakingChanges: true,
      includeTestChecklist: true,
      ...options,
    };

    // Analyze semantic diff
    const semanticAnalysis = await this.analyzeSemanticDiff(fileChanges, commits);

    // Find related ADRs
    const relatedAdrs = await this.findRelatedAdrs(
      fileChanges,
      semanticAnalysis.affectedModules
    );

    // Identify patterns
    const detectedPatterns = opts.detectPatterns
      ? await this.identifyPatterns(fileChanges, diffs)
      : [];

    // Suggest reviewers
    const suggestedReviewers = opts.suggestReviewers
      ? await this.suggestReviewers(fileChanges, semanticAnalysis.affectedModules)
      : [];

    // Detect breaking changes
    const breakingChanges = opts.detectBreakingChanges
      ? await this.detectBreakingChanges(fileChanges, diffs)
      : [];

    // Generate PR description
    const { title, description } = await this.generatePrDescription(
      commits,
      fileChanges,
      semanticAnalysis,
      relatedAdrs,
      detectedPatterns,
      breakingChanges
    );

    // Generate labels
    const labels = this.generateLabels(semanticAnalysis, breakingChanges);

    // Generate testing checklist
    const testingChecklist = opts.includeTestChecklist
      ? this.generateTestingChecklist(semanticAnalysis, breakingChanges)
      : [];

    // Generate deployment notes
    const deploymentNotes = this.generateDeploymentNotes(
      semanticAnalysis,
      breakingChanges
    );

    return {
      title,
      description,
      summary: semanticAnalysis.summary,
      commits,
      fileChanges,
      semanticAnalysis,
      relatedAdrs,
      detectedPatterns,
      suggestedReviewers,
      breakingChanges,
      labels,
      testingChecklist,
      deploymentNotes,
      generatedAt: new Date(),
    };
  }

  /**
   * Generates labels based on analysis
   */
  private generateLabels(
    analysis: SemanticDiffAnalysis,
    breakingChanges: BreakingChange[]
  ): string[] {
    const labels: string[] = [];

    // Category labels
    const categoryLabels: Partial<Record<ChangeCategory, string>> = {
      feature: 'enhancement',
      bugfix: 'bug',
      documentation: 'documentation',
      security: 'security',
      performance: 'performance',
    };

    const categoryLabel = categoryLabels[analysis.primaryCategory];
    if (categoryLabel) {
      labels.push(categoryLabel);
    }

    // Risk labels
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      labels.push('high-risk');
    }

    // Breaking change label
    if (breakingChanges.length > 0) {
      labels.push('breaking-change');
    }

    // Size labels
    const totalChanges = analysis.affectedModules.length;
    if (totalChanges >= 5) {
      labels.push('size/large');
    } else if (totalChanges >= 2) {
      labels.push('size/medium');
    } else {
      labels.push('size/small');
    }

    return labels;
  }

  /**
   * Generates testing checklist
   */
  private generateTestingChecklist(
    analysis: SemanticDiffAnalysis,
    breakingChanges: BreakingChange[]
  ): string[] {
    const checklist: string[] = [
      'Unit tests pass',
      'Integration tests pass',
    ];

    if (analysis.affectedLayers.includes('api')) {
      checklist.push('API contract tests pass');
    }

    if (analysis.affectedLayers.includes('database')) {
      checklist.push('Database migration tested');
    }

    if (analysis.riskLevel === 'high' || analysis.riskLevel === 'critical') {
      checklist.push('Manual testing completed');
      checklist.push('Performance regression checked');
    }

    if (breakingChanges.length > 0) {
      checklist.push('Migration scripts tested');
      checklist.push('Backward compatibility verified');
      checklist.push('Consumer impact assessed');
    }

    if (analysis.categories.includes('security')) {
      checklist.push('Security review completed');
    }

    return checklist;
  }

  /**
   * Generates deployment notes
   */
  private generateDeploymentNotes(
    analysis: SemanticDiffAnalysis,
    breakingChanges: BreakingChange[]
  ): string[] {
    const notes: string[] = [];

    if (analysis.affectedLayers.includes('database')) {
      notes.push('Database migration required before deployment');
    }

    if (analysis.affectedLayers.includes('configuration')) {
      notes.push('Configuration changes - update environment variables');
    }

    if (breakingChanges.length > 0) {
      notes.push('Breaking changes detected - coordinate with consumers');
      for (const bc of breakingChanges.filter(b => b.severity === 'critical')) {
        notes.push(`CRITICAL: ${bc.description}`);
      }
    }

    if (analysis.categories.includes('dependency')) {
      notes.push('Dependency updates - verify compatibility');
    }

    return notes;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Reads a file and returns its content
   */
  private async readFile(uri: vscode.Uri): Promise<string | undefined> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder('utf-8').decode(content);
    } catch {
      return undefined;
    }
  }

  /**
   * Logs a message to the output channel
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }
}

// ============================================================================
// Singleton Accessor
// ============================================================================

/**
 * Gets the singleton instance of PrContextGenerator
 */
export function getPrContextGenerator(): PrContextGenerator {
  return PrContextGenerator.getInstance();
}
