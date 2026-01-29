import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getMemoryBankApiClient } from '../services/MemoryBankApiClient';
import { getPatternValidator, ChangeValidationResult } from './PatternValidator';

/**
 * ADR (Architecture Decision Record) structure
 */
export interface Adr {
  id: string;
  title: string;
  status: AdrStatus;
  date: Date;
  context: string;
  decision: string;
  consequences: AdrConsequences;
  alternatives: AdrAlternative[];
  relatedAdrs: string[];
  references: AdrReference[];
  tags: string[];
  metadata: AdrMetadata;
}

/**
 * ADR status
 */
export type AdrStatus =
  | 'proposed'
  | 'accepted'
  | 'deprecated'
  | 'superseded'
  | 'rejected';

/**
 * ADR consequences
 */
export interface AdrConsequences {
  positive: string[];
  negative: string[];
  neutral: string[];
}

/**
 * ADR alternative option
 */
export interface AdrAlternative {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  rejected: boolean;
  rejectionReason?: string;
}

/**
 * ADR reference
 */
export interface AdrReference {
  title: string;
  url?: string;
  description?: string;
}

/**
 * ADR metadata
 */
export interface AdrMetadata {
  author?: string;
  reviewers?: string[];
  deciders?: string[];
  createdAt: Date;
  updatedAt: Date;
  supersededBy?: string;
  relatedPatterns: string[];
  affectedModules: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * ADR generation options
 */
export interface AdrGenerationOptions {
  title: string;
  context?: string;
  decision?: string;
  codeChanges?: string;
  validationResult?: ChangeValidationResult;
  detectedPatterns?: string[];
  affectedFiles?: string[];
  author?: string;
}

/**
 * ADR detection result
 */
export interface AdrDetectionResult {
  requiresAdr: boolean;
  confidence: number;
  reasons: string[];
  suggestedTitle: string;
  suggestedContext: string;
  detectedPatterns: string[];
  affectedModules: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * ADR Draft Generator Service
 * Generates ADR drafts when architectural changes are detected
 *
 * Implements AC-014.5: Generates ADR drafts when making architectural changes
 */
export class AdrDraftGenerator {
  private static instance: AdrDraftGenerator | null = null;
  private workspaceRoot: string | undefined;
  private existingAdrs: Map<string, Adr> = new Map();
  private adrsLoaded = false;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  static getInstance(): AdrDraftGenerator {
    if (!AdrDraftGenerator.instance) {
      AdrDraftGenerator.instance = new AdrDraftGenerator();
    }
    return AdrDraftGenerator.instance;
  }

  /**
   * Initialize by loading existing ADRs
   */
  async initialize(): Promise<void> {
    if (this.adrsLoaded) return;
    await this.loadExistingAdrs();
    this.adrsLoaded = true;
  }

  /**
   * Detect if code changes require an ADR (AC-014.5)
   */
  async detectAdrRequirement(
    codeChanges: string,
    affectedFiles: string[] = []
  ): Promise<AdrDetectionResult> {
    await this.initialize();

    const result: AdrDetectionResult = {
      requiresAdr: false,
      confidence: 0,
      reasons: [],
      suggestedTitle: '',
      suggestedContext: '',
      detectedPatterns: [],
      affectedModules: [],
      riskLevel: 'low',
    };

    // Analyze code changes
    const analysis = this.analyzeChanges(codeChanges, affectedFiles);

    // Check for architectural indicators
    const architecturalIndicators = this.detectArchitecturalIndicators(codeChanges);
    if (architecturalIndicators.length > 0) {
      result.reasons.push(...architecturalIndicators);
      result.confidence += 0.3;
    }

    // Check for pattern changes
    const patternValidator = getPatternValidator();
    await patternValidator.initialize();

    // Validate the code changes
    const validationResult = await patternValidator.validateCode(codeChanges);
    result.detectedPatterns = validationResult.matchedPatterns.map((p) => p.name);

    if (validationResult.matchedPatterns.length > 2) {
      result.reasons.push('Multiple architectural patterns detected');
      result.confidence += 0.2;
    }

    // Check for new dependencies/integrations
    const newDependencies = this.detectNewDependencies(codeChanges);
    if (newDependencies.length > 0) {
      result.reasons.push(`New dependencies introduced: ${newDependencies.join(', ')}`);
      result.confidence += 0.15;
    }

    // Check for API changes
    const apiChanges = this.detectApiChanges(codeChanges);
    if (apiChanges.breaking) {
      result.reasons.push('Breaking API changes detected');
      result.confidence += 0.3;
      result.riskLevel = 'high';
    } else if (apiChanges.additions) {
      result.reasons.push('New API endpoints or interfaces added');
      result.confidence += 0.15;
    }

    // Check for database schema changes
    const schemaChanges = this.detectSchemaChanges(codeChanges);
    if (schemaChanges) {
      result.reasons.push('Database schema changes detected');
      result.confidence += 0.25;
      result.riskLevel = result.riskLevel === 'high' ? 'high' : 'medium';
    }

    // Check for security-related changes
    const securityChanges = this.detectSecurityChanges(codeChanges);
    if (securityChanges.length > 0) {
      result.reasons.push(`Security-related changes: ${securityChanges.join(', ')}`);
      result.confidence += 0.2;
      result.riskLevel = 'high';
    }

    // Identify affected modules
    result.affectedModules = this.identifyAffectedModules(affectedFiles);

    // Determine if ADR is required
    result.requiresAdr = result.confidence >= 0.5;

    // Generate suggestions
    if (result.requiresAdr) {
      result.suggestedTitle = this.generateSuggestedTitle(result);
      result.suggestedContext = this.generateSuggestedContext(result, analysis);
    }

    return result;
  }

  /**
   * Generate an ADR draft
   */
  async generateAdrDraft(options: AdrGenerationOptions): Promise<Adr> {
    await this.initialize();

    const adrNumber = this.existingAdrs.size + 1;
    const adrId = `ADR-${String(adrNumber).padStart(4, '0')}`;
    const now = new Date();

    // Analyze context if code changes are provided
    let detectionResult: AdrDetectionResult | null = null;
    if (options.codeChanges) {
      detectionResult = await this.detectAdrRequirement(
        options.codeChanges,
        options.affectedFiles
      );
    }

    // Generate consequences based on analysis
    const consequences = this.generateConsequences(options, detectionResult);

    // Generate alternatives based on patterns
    const alternatives = await this.generateAlternatives(options, detectionResult);

    // Find related ADRs
    const relatedAdrs = this.findRelatedAdrs(options.title, options.context || '');

    const adr: Adr = {
      id: adrId,
      title: options.title,
      status: 'proposed',
      date: now,
      context: options.context || this.generateContext(options, detectionResult),
      decision: options.decision || this.generateDecision(options),
      consequences,
      alternatives,
      relatedAdrs,
      references: [],
      tags: this.generateTags(options, detectionResult),
      metadata: {
        author: options.author,
        createdAt: now,
        updatedAt: now,
        relatedPatterns: detectionResult?.detectedPatterns || options.detectedPatterns || [],
        affectedModules: detectionResult?.affectedModules || [],
        riskLevel: detectionResult?.riskLevel || 'medium',
      },
    };

    return adr;
  }

  /**
   * Generate ADR markdown content
   */
  generateAdrMarkdown(adr: Adr): string {
    const date = adr.date.toISOString().split('T')[0];

    let markdown = `# ${adr.id}: ${adr.title}

## Status

${this.capitalizeFirst(adr.status)}

## Date

${date}

## Context

${adr.context}

## Decision

${adr.decision}

## Consequences

### Positive

${adr.consequences.positive.map((c) => `- ${c}`).join('\n') || '- [Add positive consequences]'}

### Negative

${adr.consequences.negative.map((c) => `- ${c}`).join('\n') || '- [Add negative consequences]'}

### Neutral

${adr.consequences.neutral.map((c) => `- ${c}`).join('\n') || '- [Add neutral consequences]'}

## Alternatives Considered

${adr.alternatives
  .map(
    (alt, i) => `### Alternative ${i + 1}: ${alt.name}

${alt.description}

**Pros:**
${alt.pros.map((p) => `- ${p}`).join('\n') || '- None listed'}

**Cons:**
${alt.cons.map((c) => `- ${c}`).join('\n') || '- None listed'}

${alt.rejected ? `**Rejected:** ${alt.rejectionReason || 'See decision rationale'}` : ''}`
  )
  .join('\n\n') || '### Alternative 1\n\nDescribe the alternative here.'}

## Related ADRs

${adr.relatedAdrs.map((id) => `- ${id}`).join('\n') || '- None'}

## References

${adr.references.map((ref) => `- [${ref.title}](${ref.url || '#'})`).join('\n') || '- [Add references]'}

---

## Metadata

- **Author:** ${adr.metadata.author || 'Unknown'}
- **Risk Level:** ${adr.metadata.riskLevel}
- **Related Patterns:** ${adr.metadata.relatedPatterns.join(', ') || 'None'}
- **Affected Modules:** ${adr.metadata.affectedModules.join(', ') || 'None'}
- **Tags:** ${adr.tags.join(', ') || 'None'}

---

*This ADR was auto-generated by EGCE Agent Mode on ${date}*
`;

    return markdown;
  }

  /**
   * Save ADR to Memory Bank
   */
  async saveAdr(adr: Adr): Promise<string> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const decisionsPath = path.join(this.workspaceRoot, memoryBankPath, 'decisions');

    // Ensure decisions directory exists
    try {
      await fs.mkdir(decisionsPath, { recursive: true });
    } catch {
      // Directory already exists
    }

    // Generate markdown content
    const markdown = this.generateAdrMarkdown(adr);

    // Save file
    const filename = `${adr.id.toLowerCase()}.md`;
    const filePath = path.join(decisionsPath, filename);
    await fs.writeFile(filePath, markdown);

    // Update cache
    this.existingAdrs.set(adr.id, adr);

    return filePath;
  }

  /**
   * Update an existing ADR status
   */
  async updateAdrStatus(adrId: string, newStatus: AdrStatus, supersededBy?: string): Promise<void> {
    const adr = this.existingAdrs.get(adrId);
    if (!adr) {
      throw new Error(`ADR not found: ${adrId}`);
    }

    adr.status = newStatus;
    adr.metadata.updatedAt = new Date();

    if (supersededBy) {
      adr.metadata.supersededBy = supersededBy;
    }

    await this.saveAdr(adr);
  }

  /**
   * Get all existing ADRs
   */
  async getAllAdrs(): Promise<Adr[]> {
    await this.initialize();
    return Array.from(this.existingAdrs.values());
  }

  /**
   * Get ADR by ID
   */
  async getAdr(id: string): Promise<Adr | null> {
    await this.initialize();
    return this.existingAdrs.get(id) || null;
  }

  /**
   * Search ADRs
   */
  async searchAdrs(query: string): Promise<Adr[]> {
    await this.initialize();

    const queryLower = query.toLowerCase();
    const results: Array<{ adr: Adr; score: number }> = [];

    for (const adr of this.existingAdrs.values()) {
      let score = 0;

      if (adr.title.toLowerCase().includes(queryLower)) score += 3;
      if (adr.context.toLowerCase().includes(queryLower)) score += 2;
      if (adr.decision.toLowerCase().includes(queryLower)) score += 2;
      if (adr.tags.some((t) => t.toLowerCase().includes(queryLower))) score += 1;

      if (score > 0) {
        results.push({ adr, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.map((r) => r.adr);
  }

  /**
   * Load existing ADRs from Memory Bank
   */
  private async loadExistingAdrs(): Promise<void> {
    if (!this.workspaceRoot) return;

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const decisionsPath = path.join(this.workspaceRoot, memoryBankPath, 'decisions');

    try {
      const files = await fs.readdir(decisionsPath);

      for (const file of files) {
        if (file.endsWith('.md')) {
          try {
            const content = await fs.readFile(path.join(decisionsPath, file), 'utf-8');
            const adr = this.parseAdrFile(file, content);
            if (adr) {
              this.existingAdrs.set(adr.id, adr);
            }
          } catch (error) {
            console.warn(`Failed to parse ADR: ${file}`, error);
          }
        }
      }
    } catch {
      // Decisions directory doesn't exist
    }

    console.log(`AdrDraftGenerator loaded ${this.existingAdrs.size} existing ADRs`);
  }

  /**
   * Parse an ADR markdown file
   */
  private parseAdrFile(filename: string, content: string): Adr | null {
    try {
      // Extract title and ID
      const titleMatch = content.match(/^#\s+(?:(ADR-\d+)[:\s]+)?(.+)$/m);
      const id = titleMatch?.[1] || filename.replace('.md', '').toUpperCase();
      const title = titleMatch?.[2]?.trim() || filename.replace('.md', '');

      // Extract status
      const statusMatch = content.match(/##\s*Status\s*\n+(\w+)/i);
      const status = (statusMatch?.[1]?.toLowerCase() as AdrStatus) || 'proposed';

      // Extract date
      const dateMatch = content.match(/##\s*Date\s*\n+(\d{4}-\d{2}-\d{2})/i);
      const date = dateMatch ? new Date(dateMatch[1]) : new Date();

      // Extract context
      const context = this.extractSection(content, 'Context');

      // Extract decision
      const decision = this.extractSection(content, 'Decision');

      // Extract consequences
      const consequences = this.extractConsequences(content);

      // Extract alternatives
      const alternatives = this.extractAlternatives(content);

      // Extract related ADRs
      const relatedSection = this.extractSection(content, 'Related ADRs');
      const relatedAdrs = relatedSection
        ? (relatedSection.match(/ADR-\d+/g) || [])
        : [];

      // Extract tags
      const tagsMatch = content.match(/Tags?:\s*(.+)/i);
      const tags = tagsMatch
        ? tagsMatch[1].split(/[,\s]+/).filter((t) => t)
        : [];

      return {
        id,
        title,
        status,
        date,
        context,
        decision,
        consequences,
        alternatives,
        relatedAdrs,
        references: [],
        tags,
        metadata: {
          createdAt: date,
          updatedAt: new Date(),
          relatedPatterns: [],
          affectedModules: [],
          riskLevel: 'medium',
        },
      };
    } catch (error) {
      console.error(`Error parsing ADR file: ${filename}`, error);
      return null;
    }
  }

  /**
   * Extract a section from markdown
   */
  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(
      `##\\s*${sectionName}\\s*\\n+([\\s\\S]*?)(?=\\n##|$)`,
      'i'
    );
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract consequences from ADR content
   */
  private extractConsequences(content: string): AdrConsequences {
    const consequences: AdrConsequences = {
      positive: [],
      negative: [],
      neutral: [],
    };

    const consequencesSection = content.match(
      /##\s*Consequences[\s\S]*?(?=\n##\s*(?!###)|$)/i
    );

    if (consequencesSection) {
      const section = consequencesSection[0];

      const positiveMatch = section.match(
        /###\s*Positive[\s\S]*?(?=\n###|$)/i
      );
      if (positiveMatch) {
        consequences.positive = this.extractListItems(positiveMatch[0]);
      }

      const negativeMatch = section.match(
        /###\s*Negative[\s\S]*?(?=\n###|$)/i
      );
      if (negativeMatch) {
        consequences.negative = this.extractListItems(negativeMatch[0]);
      }

      const neutralMatch = section.match(
        /###\s*Neutral[\s\S]*?(?=\n###|$)/i
      );
      if (neutralMatch) {
        consequences.neutral = this.extractListItems(neutralMatch[0]);
      }
    }

    return consequences;
  }

  /**
   * Extract alternatives from ADR content
   */
  private extractAlternatives(content: string): AdrAlternative[] {
    const alternatives: AdrAlternative[] = [];
    const altSection = content.match(
      /##\s*Alternatives?\s*(?:Considered)?[\s\S]*?(?=\n##\s*(?!###)|$)/i
    );

    if (altSection) {
      const altMatches = altSection[0].match(
        /###\s*Alternative\s*\d*[:\s]+(.+)[\s\S]*?(?=\n###|$)/gi
      );

      if (altMatches) {
        for (const match of altMatches) {
          const nameMatch = match.match(/###\s*Alternative\s*\d*[:\s]+(.+)/i);
          const name = nameMatch ? nameMatch[1].trim() : 'Alternative';

          const descMatch = match.match(/\n\n([^*\-#][^\n]+)/);
          const description = descMatch ? descMatch[1].trim() : '';

          const prosMatch = match.match(/\*\*Pros:?\*\*[\s\S]*?(?=\*\*|$)/i);
          const pros = prosMatch ? this.extractListItems(prosMatch[0]) : [];

          const consMatch = match.match(/\*\*Cons:?\*\*[\s\S]*?(?=\*\*|$)/i);
          const cons = consMatch ? this.extractListItems(consMatch[0]) : [];

          alternatives.push({
            name,
            description,
            pros,
            cons,
            rejected: match.toLowerCase().includes('rejected'),
          });
        }
      }
    }

    return alternatives;
  }

  /**
   * Extract list items from text
   */
  private extractListItems(text: string): string[] {
    const items = text.match(/[-*]\s+(.+)/g);
    return items
      ? items.map((item) => item.replace(/^[-*]\s+/, '').trim())
      : [];
  }

  /**
   * Analyze code changes
   */
  private analyzeChanges(
    code: string,
    affectedFiles: string[]
  ): {
    addedLines: number;
    removedLines: number;
    changedFiles: number;
    primaryLanguage: string;
  } {
    const lines = code.split('\n');
    let addedLines = 0;
    let removedLines = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) addedLines++;
      if (line.startsWith('-') && !line.startsWith('---')) removedLines++;
    }

    // Detect primary language from affected files
    const extensions = affectedFiles.map((f) => path.extname(f).toLowerCase());
    const extCount = new Map<string, number>();
    for (const ext of extensions) {
      extCount.set(ext, (extCount.get(ext) || 0) + 1);
    }
    const primaryExt = [...extCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.java': 'Java',
      '.cs': 'C#',
      '.py': 'Python',
      '.go': 'Go',
    };

    return {
      addedLines,
      removedLines,
      changedFiles: affectedFiles.length,
      primaryLanguage: langMap[primaryExt] || 'Unknown',
    };
  }

  /**
   * Detect architectural indicators in code
   */
  private detectArchitecturalIndicators(code: string): string[] {
    const indicators: string[] = [];

    const patterns = [
      { regex: /new\s+(?:architecture|pattern|layer)/i, desc: 'New architecture/pattern introduced' },
      { regex: /(?:refactor|migrate|replace).*(?:to|with)/i, desc: 'Major refactoring or migration' },
      { regex: /(?:create|add|implement)\s+(?:new\s+)?(?:service|repository|controller|module)/i, desc: 'New service/module added' },
      { regex: /(?:event|message|queue)\s*(?:driven|bus|broker)/i, desc: 'Event-driven architecture changes' },
      { regex: /(?:microservice|distributed|cluster)/i, desc: 'Distributed system changes' },
      { regex: /(?:cache|caching|redis|memcached)/i, desc: 'Caching layer changes' },
      { regex: /(?:authentication|authorization|oauth|jwt)/i, desc: 'Auth mechanism changes' },
      { regex: /(?:api\s*gateway|load\s*balancer|reverse\s*proxy)/i, desc: 'Infrastructure layer changes' },
    ];

    for (const { regex, desc } of patterns) {
      if (regex.test(code)) {
        indicators.push(desc);
      }
    }

    return indicators;
  }

  /**
   * Detect new dependencies
   */
  private detectNewDependencies(code: string): string[] {
    const dependencies: string[] = [];

    // Check for new imports
    const importMatches = code.match(/import\s+.*from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      for (const match of importMatches) {
        const pkgMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        if (pkgMatch && pkgMatch[1].startsWith('@') || !pkgMatch?.[1].startsWith('.')) {
          dependencies.push(pkgMatch![1]);
        }
      }
    }

    // Check for Maven/Gradle dependencies
    const mavenMatch = code.match(/<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>/g);
    if (mavenMatch) {
      dependencies.push(...mavenMatch.map((m) => m.match(/<artifactId>([^<]+)/)?.[1] || ''));
    }

    // Check for NuGet packages
    const nugetMatch = code.match(/PackageReference\s+Include="([^"]+)"/g);
    if (nugetMatch) {
      dependencies.push(...nugetMatch.map((m) => m.match(/Include="([^"]+)"/)?.[1] || ''));
    }

    return [...new Set(dependencies.filter((d) => d))];
  }

  /**
   * Detect API changes
   */
  private detectApiChanges(code: string): { breaking: boolean; additions: boolean } {
    const result = { breaking: false, additions: false };

    // Check for breaking changes
    const breakingPatterns = [
      /(?:delete|remove)\s+(?:endpoint|route|api)/i,
      /(?:rename|change)\s+(?:parameter|field|property)/i,
      /(?:required|mandatory)\s+(?:field|parameter)/i,
      /(?:breaking|incompatible)\s+change/i,
    ];

    for (const pattern of breakingPatterns) {
      if (pattern.test(code)) {
        result.breaking = true;
        break;
      }
    }

    // Check for additions
    const additionPatterns = [
      /@(?:Get|Post|Put|Delete|Patch)(?:Mapping)?/i,
      /router\s*\.\s*(?:get|post|put|delete|patch)/i,
      /app\s*\.\s*(?:get|post|put|delete|patch)/i,
      /\[Http(?:Get|Post|Put|Delete|Patch)\]/i,
    ];

    for (const pattern of additionPatterns) {
      if (pattern.test(code)) {
        result.additions = true;
        break;
      }
    }

    return result;
  }

  /**
   * Detect database schema changes
   */
  private detectSchemaChanges(code: string): boolean {
    const schemaPatterns = [
      /(?:create|alter|drop)\s+table/i,
      /(?:add|modify|drop)\s+(?:column|index)/i,
      /@(?:Entity|Table|Column|JoinColumn)/i,
      /migration|migrate/i,
      /schema\s*(?:change|update|version)/i,
    ];

    return schemaPatterns.some((pattern) => pattern.test(code));
  }

  /**
   * Detect security-related changes
   */
  private detectSecurityChanges(code: string): string[] {
    const changes: string[] = [];

    const securityPatterns = [
      { regex: /(?:password|secret|key|token)\s*[:=]/i, desc: 'Credential handling' },
      { regex: /(?:encrypt|decrypt|hash|bcrypt)/i, desc: 'Encryption/hashing' },
      { regex: /(?:cors|csrf|xss)\s*(?:config|policy|protection)/i, desc: 'Security policy' },
      { regex: /(?:rate\s*limit|throttle)/i, desc: 'Rate limiting' },
      { regex: /(?:sanitize|validate|escape).*input/i, desc: 'Input validation' },
      { regex: /(?:ssl|tls|https)/i, desc: 'Transport security' },
    ];

    for (const { regex, desc } of securityPatterns) {
      if (regex.test(code)) {
        changes.push(desc);
      }
    }

    return changes;
  }

  /**
   * Identify affected modules from file paths
   */
  private identifyAffectedModules(files: string[]): string[] {
    const modules = new Set<string>();

    for (const file of files) {
      // Extract module name from path
      const parts = file.split(path.sep);
      const srcIndex = parts.findIndex((p) => p === 'src' || p === 'lib' || p === 'app');

      if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
        modules.add(parts[srcIndex + 1]);
      }
    }

    return [...modules];
  }

  /**
   * Generate suggested title for ADR
   */
  private generateSuggestedTitle(detection: AdrDetectionResult): string {
    if (detection.reasons.length > 0) {
      // Use the most significant reason
      const mainReason = detection.reasons[0];
      return mainReason.replace(/\s+detected$/i, '');
    }

    if (detection.detectedPatterns.length > 0) {
      return `Implement ${detection.detectedPatterns[0]} Pattern`;
    }

    return 'Architectural Change';
  }

  /**
   * Generate suggested context
   */
  private generateSuggestedContext(
    detection: AdrDetectionResult,
    analysis: { addedLines: number; removedLines: number; changedFiles: number; primaryLanguage: string }
  ): string {
    let context = '';

    if (detection.reasons.length > 0) {
      context += `The following changes have been detected:\n\n`;
      context += detection.reasons.map((r) => `- ${r}`).join('\n');
      context += '\n\n';
    }

    context += `This change affects ${analysis.changedFiles} file(s) with ${analysis.addedLines} additions and ${analysis.removedLines} deletions`;

    if (detection.affectedModules.length > 0) {
      context += ` across the following modules: ${detection.affectedModules.join(', ')}`;
    }

    context += '.';

    if (detection.detectedPatterns.length > 0) {
      context += `\n\nArchitectural patterns involved: ${detection.detectedPatterns.join(', ')}.`;
    }

    return context;
  }

  /**
   * Generate context section
   */
  private generateContext(
    options: AdrGenerationOptions,
    detection: AdrDetectionResult | null
  ): string {
    if (detection) {
      return this.generateSuggestedContext(detection, {
        addedLines: 0,
        removedLines: 0,
        changedFiles: options.affectedFiles?.length || 0,
        primaryLanguage: 'Unknown',
      });
    }

    return '[Describe the context and problem statement that led to this decision]';
  }

  /**
   * Generate decision section
   */
  private generateDecision(options: AdrGenerationOptions): string {
    const patterns = options.detectedPatterns || [];

    if (patterns.length > 0) {
      return `We will implement the ${patterns.join(', ')} pattern(s) to address the architectural requirements.\n\n[Provide more details about the specific implementation approach]`;
    }

    return '[Describe the decision that was made and the rationale behind it]';
  }

  /**
   * Generate consequences
   */
  private generateConsequences(
    options: AdrGenerationOptions,
    detection: AdrDetectionResult | null
  ): AdrConsequences {
    const consequences: AdrConsequences = {
      positive: [],
      negative: [],
      neutral: [],
    };

    // Add pattern-based consequences
    if (detection?.detectedPatterns.includes('Layered Architecture')) {
      consequences.positive.push('Better separation of concerns');
      consequences.positive.push('Easier to maintain and test');
      consequences.negative.push('Additional complexity in cross-cutting concerns');
    }

    if (detection?.detectedPatterns.includes('Dependency Injection')) {
      consequences.positive.push('Improved testability');
      consequences.positive.push('Loose coupling between components');
      consequences.negative.push('Requires DI container setup');
    }

    // Add risk-based consequences
    if (detection?.riskLevel === 'high') {
      consequences.negative.push('Higher risk of regression');
      consequences.neutral.push('Requires comprehensive testing');
    }

    // Add module-based consequences
    if (detection?.affectedModules && detection.affectedModules.length > 1) {
      consequences.neutral.push(
        `Changes affect multiple modules: ${detection.affectedModules.join(', ')}`
      );
    }

    // Ensure there's at least one item in each category
    if (consequences.positive.length === 0) {
      consequences.positive.push('[Add positive consequences]');
    }
    if (consequences.negative.length === 0) {
      consequences.negative.push('[Add negative consequences]');
    }
    if (consequences.neutral.length === 0) {
      consequences.neutral.push('[Add neutral consequences]');
    }

    return consequences;
  }

  /**
   * Generate alternatives
   */
  private async generateAlternatives(
    options: AdrGenerationOptions,
    detection: AdrDetectionResult | null
  ): Promise<AdrAlternative[]> {
    const alternatives: AdrAlternative[] = [];

    // Search Memory Bank for related patterns/alternatives
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(options.title, {
      types: ['pattern', 'adr'],
      limit: 3,
    });

    for (const result of searchResponse.results) {
      if (result.similarity > 0.5) {
        alternatives.push({
          name: result.entry.title,
          description: result.entry.content.substring(0, 200) + '...',
          pros: ['Existing pattern/decision'],
          cons: ['May not fully address current requirements'],
          rejected: true,
          rejectionReason: 'Alternative considered but not chosen',
        });
      }
    }

    // Add "Do Nothing" alternative
    alternatives.push({
      name: 'Do Nothing',
      description: 'Keep the current implementation without changes',
      pros: ['No development effort required', 'No risk of introducing bugs'],
      cons: ['Does not address the architectural needs', 'Technical debt may accumulate'],
      rejected: true,
      rejectionReason: 'Does not meet the requirements',
    });

    return alternatives;
  }

  /**
   * Find related ADRs
   */
  private findRelatedAdrs(title: string, context: string): string[] {
    const related: string[] = [];
    const searchText = (title + ' ' + context).toLowerCase();

    for (const [id, adr] of this.existingAdrs) {
      const adrText = (adr.title + ' ' + adr.context + ' ' + adr.decision).toLowerCase();

      // Simple word overlap check
      const searchWords = searchText.split(/\s+/).filter((w) => w.length > 4);
      const matchCount = searchWords.filter((w) => adrText.includes(w)).length;

      if (matchCount >= 2) {
        related.push(id);
      }
    }

    return related.slice(0, 3);
  }

  /**
   * Generate tags
   */
  private generateTags(
    options: AdrGenerationOptions,
    detection: AdrDetectionResult | null
  ): string[] {
    const tags = new Set<string>();

    // Add pattern-based tags
    if (detection?.detectedPatterns) {
      for (const pattern of detection.detectedPatterns) {
        tags.add(pattern.toLowerCase().replace(/\s+/g, '-'));
      }
    }

    // Add module tags
    if (detection?.affectedModules) {
      for (const module of detection.affectedModules) {
        tags.add(module.toLowerCase());
      }
    }

    // Add risk tag
    if (detection?.riskLevel) {
      tags.add(`risk-${detection.riskLevel}`);
    }

    // Extract keywords from title
    const titleWords = options.title.toLowerCase().split(/\s+/);
    const significantWords = titleWords.filter(
      (w) => w.length > 4 && !['about', 'using', 'with', 'from', 'into'].includes(w)
    );
    for (const word of significantWords.slice(0, 3)) {
      tags.add(word);
    }

    return [...tags];
  }

  /**
   * Helper: Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Reload ADRs
   */
  async reload(): Promise<void> {
    this.existingAdrs.clear();
    this.adrsLoaded = false;
    await this.initialize();
  }
}

// Export singleton accessor
let adrDraftGenerator: AdrDraftGenerator | null = null;

export function getAdrDraftGenerator(): AdrDraftGenerator {
  if (!adrDraftGenerator) {
    adrDraftGenerator = new AdrDraftGenerator();
  }
  return adrDraftGenerator;
}
