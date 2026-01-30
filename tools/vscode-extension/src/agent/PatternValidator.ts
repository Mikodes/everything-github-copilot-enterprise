import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getMemoryBankApiClient } from '../services/MemoryBankApiClient';

/**
 * Validation result for a code change
 */
export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100 compliance score
  violations: PatternViolation[];
  warnings: PatternWarning[];
  suggestions: PatternSuggestion[];
  matchedPatterns: MatchedPattern[];
  requiresAdr: boolean;
  adrSuggestion?: AdrSuggestion;
}

/**
 * Pattern violation that must be fixed
 */
export interface PatternViolation {
  id: string;
  severity: 'critical' | 'error';
  pattern: string;
  rule: string;
  message: string;
  location?: CodeLocation;
  suggestion: string;
  relatedAdrs: string[];
}

/**
 * Pattern warning that should be reviewed
 */
export interface PatternWarning {
  id: string;
  severity: 'warning';
  pattern: string;
  rule: string;
  message: string;
  location?: CodeLocation;
  suggestion: string;
}

/**
 * Suggestion for improvement
 */
export interface PatternSuggestion {
  id: string;
  pattern: string;
  message: string;
  benefit: string;
  example?: string;
}

/**
 * Pattern that was matched in the code
 */
export interface MatchedPattern {
  id: string;
  name: string;
  confidence: number;
  locations: CodeLocation[];
}

/**
 * Code location reference
 */
export interface CodeLocation {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: string;
}

/**
 * Suggestion to create an ADR
 */
export interface AdrSuggestion {
  title: string;
  context: string;
  reason: string;
  relatedPatterns: string[];
}

/**
 * Parsed architecture pattern from Memory Bank
 */
interface ParsedPattern {
  id: string;
  name: string;
  description: string;
  rules: PatternRule[];
  antiPatterns: AntiPattern[];
  indicators: PatternIndicator[];
  category: string;
}

/**
 * Rule within a pattern
 */
interface PatternRule {
  id: string;
  description: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  check: RuleCheck;
}

/**
 * Anti-pattern to detect
 */
interface AntiPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  suggestion: string;
}

/**
 * Indicators for pattern detection
 */
interface PatternIndicator {
  type: 'keyword' | 'structure' | 'import' | 'annotation' | 'naming';
  pattern: string | RegExp;
  weight: number;
}

/**
 * Rule check definition
 */
interface RuleCheck {
  type: 'regex' | 'structure' | 'presence' | 'absence' | 'naming' | 'dependency';
  pattern?: string | RegExp;
  target?: string;
  options?: Record<string, unknown>;
}

/**
 * Pattern Validator Service
 * Validates code changes against architecture patterns from Memory Bank
 *
 * Implements AC-014.2: Respects documented architecture patterns
 * Implements AC-014.4: Validates changes against team standards before applying
 */
export class PatternValidator {
  private static instance: PatternValidator | null = null;
  private patterns: Map<string, ParsedPattern> = new Map();
  private workspaceRoot: string | undefined;
  private patternsLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  static getInstance(): PatternValidator {
    if (!PatternValidator.instance) {
      PatternValidator.instance = new PatternValidator();
    }
    return PatternValidator.instance;
  }

  /**
   * Initialize the validator by loading patterns
   */
  async initialize(): Promise<void> {
    if (this.patternsLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.loadPatterns();
    await this.loadingPromise;
    this.patternsLoaded = true;
    this.loadingPromise = null;
  }

  /**
   * Validate code against architecture patterns (AC-014.2, AC-014.4)
   */
  async validateCode(
    code: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    await this.initialize();

    const result: ValidationResult = {
      valid: true,
      score: 100,
      violations: [],
      warnings: [],
      suggestions: [],
      matchedPatterns: [],
      requiresAdr: false,
    };

    const language = options.language || this.detectLanguage(code);
    const context = options.context || {};

    // Detect which patterns are being used
    const detectedPatterns = this.detectPatterns(code, language);
    result.matchedPatterns = detectedPatterns;

    // Validate against each relevant pattern
    for (const [patternId, pattern] of this.patterns) {
      // Check if pattern is relevant to this code
      const relevance = this.calculatePatternRelevance(code, pattern, language);
      if (relevance < 0.3) continue;

      // Validate pattern rules
      for (const rule of pattern.rules) {
        const ruleResult = this.checkRule(code, rule, pattern, options);
        if (ruleResult.violated) {
          if (rule.severity === 'critical' || rule.severity === 'error') {
            result.violations.push({
              id: `${patternId}-${rule.id}`,
              severity: rule.severity,
              pattern: pattern.name,
              rule: rule.description,
              message: ruleResult.message,
              location: ruleResult.location,
              suggestion: ruleResult.suggestion,
              relatedAdrs: this.findRelatedAdrs(pattern),
            });
            result.valid = false;
          } else if (rule.severity === 'warning') {
            result.warnings.push({
              id: `${patternId}-${rule.id}`,
              severity: 'warning',
              pattern: pattern.name,
              rule: rule.description,
              message: ruleResult.message,
              location: ruleResult.location,
              suggestion: ruleResult.suggestion,
            });
          }
        }
      }

      // Check for anti-patterns
      for (const antiPattern of pattern.antiPatterns) {
        const detected = this.detectAntiPattern(code, antiPattern, language);
        if (detected) {
          result.violations.push({
            id: `${patternId}-anti-${antiPattern.id}`,
            severity: 'error',
            pattern: pattern.name,
            rule: `Anti-pattern: ${antiPattern.name}`,
            message: antiPattern.description,
            location: detected.location,
            suggestion: antiPattern.suggestion,
            relatedAdrs: this.findRelatedAdrs(pattern),
          });
          result.valid = false;
        }
      }

      // Generate suggestions
      const patternSuggestions = this.generateSuggestions(code, pattern, detectedPatterns);
      result.suggestions.push(...patternSuggestions);
    }

    // Calculate compliance score
    result.score = this.calculateComplianceScore(result);

    // Determine if ADR is needed
    const adrAnalysis = this.analyzeForAdrRequirement(code, result, context);
    result.requiresAdr = adrAnalysis.required;
    if (adrAnalysis.required) {
      result.adrSuggestion = adrAnalysis.suggestion;
    }

    return result;
  }

  /**
   * Validate a file against patterns
   */
  async validateFile(uri: vscode.Uri): Promise<ValidationResult> {
    const document = await vscode.workspace.openTextDocument(uri);
    const code = document.getText();
    const language = document.languageId;

    return this.validateCode(code, {
      language,
      filePath: uri.fsPath,
      context: {
        fileName: path.basename(uri.fsPath),
        directory: path.dirname(uri.fsPath),
      },
    });
  }

  /**
   * Validate a diff/change against patterns
   */
  async validateChange(
    originalCode: string,
    newCode: string,
    options: ValidationOptions = {}
  ): Promise<ChangeValidationResult> {
    const originalResult = await this.validateCode(originalCode, options);
    const newResult = await this.validateCode(newCode, options);

    const introducedViolations = newResult.violations.filter(
      (v) => !originalResult.violations.some((ov) => ov.id === v.id)
    );

    const resolvedViolations = originalResult.violations.filter(
      (v) => !newResult.violations.some((nv) => nv.id === v.id)
    );

    const introducedWarnings = newResult.warnings.filter(
      (w) => !originalResult.warnings.some((ow) => ow.id === w.id)
    );

    // Detect pattern changes
    const patternChanges = this.detectPatternChanges(
      originalResult.matchedPatterns,
      newResult.matchedPatterns
    );

    // Determine if change introduces architectural impact
    const architecturalImpact = this.assessArchitecturalImpact(
      patternChanges,
      introducedViolations,
      newResult
    );

    return {
      originalResult,
      newResult,
      changeApproved: introducedViolations.length === 0,
      introducedViolations,
      resolvedViolations,
      introducedWarnings,
      patternChanges,
      architecturalImpact,
      requiresAdr: architecturalImpact.significant,
      summary: this.generateChangeSummary(
        introducedViolations,
        resolvedViolations,
        patternChanges
      ),
    };
  }

  /**
   * Get pattern recommendations for a given code context
   */
  async getPatternRecommendations(
    code: string,
    intent: string
  ): Promise<PatternRecommendation[]> {
    await this.initialize();

    const recommendations: PatternRecommendation[] = [];
    const language = this.detectLanguage(code);

    // Search Memory Bank for relevant patterns
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(intent, {
      types: ['pattern'],
      limit: 5,
    });

    // Also check local patterns
    for (const [, pattern] of this.patterns) {
      const relevance = this.calculateIntentRelevance(intent, pattern);
      if (relevance > 0.5) {
        recommendations.push({
          pattern: pattern.name,
          description: pattern.description,
          relevance,
          benefits: this.getPatternBenefits(pattern),
          example: this.getPatternExample(pattern, language),
          rules: pattern.rules.map((r) => r.description),
        });
      }
    }

    // Add results from Memory Bank search
    for (const result of searchResponse.results) {
      if (!recommendations.some((r) => r.pattern === result.entry.title)) {
        recommendations.push({
          pattern: result.entry.title,
          description: result.entry.content.substring(0, 200),
          relevance: result.similarity,
          benefits: [],
          rules: [],
        });
      }
    }

    // Sort by relevance
    recommendations.sort((a, b) => b.relevance - a.relevance);

    return recommendations.slice(0, 5);
  }

  /**
   * Load patterns from Memory Bank
   */
  private async loadPatterns(): Promise<void> {
    if (!this.workspaceRoot) return;

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const basePath = path.join(this.workspaceRoot, memoryBankPath);

    // Load from patterns.md
    try {
      const patternsFile = path.join(basePath, 'knowledge', 'patterns.md');
      const content = await fs.readFile(patternsFile, 'utf-8');
      this.parsePatternsFile(content);
    } catch {
      // No patterns file
    }

    // Load from patterns directory
    try {
      const patternsDir = path.join(basePath, 'patterns');
      const files = await fs.readdir(patternsDir);

      for (const file of files) {
        if (file.endsWith('.md')) {
          try {
            const content = await fs.readFile(path.join(patternsDir, file), 'utf-8');
            this.parsePatternFile(file.replace('.md', ''), content);
          } catch {
            // Skip invalid file
          }
        }
      }
    } catch {
      // Patterns directory doesn't exist
    }

    // Add built-in patterns
    this.addBuiltInPatterns();

    console.log(`PatternValidator loaded ${this.patterns.size} patterns`);
  }

  /**
   * Parse patterns from main patterns.md file
   */
  private parsePatternsFile(content: string): void {
    const sections = content.split(/\n##\s+/).filter((s) => s.trim());

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const name = lines[0]?.trim();

      if (!name || name.toLowerCase().includes('table of contents')) continue;

      const id = `pattern-${i + 1}`;
      const description = lines.slice(1, 3).join(' ').trim();

      const pattern: ParsedPattern = {
        id,
        name,
        description,
        rules: this.extractRules(section),
        antiPatterns: this.extractAntiPatterns(section),
        indicators: this.extractIndicators(name, section),
        category: this.inferCategory(name),
      };

      this.patterns.set(id, pattern);
    }
  }

  /**
   * Parse a dedicated pattern file
   */
  private parsePatternFile(id: string, content: string): void {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const name = titleMatch ? titleMatch[1].trim() : id;
    const description = this.extractDescription(content);

    const pattern: ParsedPattern = {
      id,
      name,
      description,
      rules: this.extractRules(content),
      antiPatterns: this.extractAntiPatterns(content),
      indicators: this.extractIndicators(name, content),
      category: this.inferCategory(name),
    };

    this.patterns.set(id, pattern);
  }

  /**
   * Extract rules from pattern content
   */
  private extractRules(content: string): PatternRule[] {
    const rules: PatternRule[] = [];
    const rulesSection = content.match(/###?\s*Rules?[\s\S]*?(?=\n###?|$)/i);

    if (rulesSection) {
      const ruleItems = rulesSection[0].match(/[-*]\s+(.+)/g);
      if (ruleItems) {
        ruleItems.forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, '').trim();
          rules.push({
            id: `rule-${index + 1}`,
            description: text,
            severity: this.inferRuleSeverity(text),
            check: this.inferRuleCheck(text),
          });
        });
      }
    }

    return rules;
  }

  /**
   * Extract anti-patterns from content
   */
  private extractAntiPatterns(content: string): AntiPattern[] {
    const antiPatterns: AntiPattern[] = [];
    const antiSection = content.match(/###?\s*Anti-?patterns?[\s\S]*?(?=\n###?|$)/i);

    if (antiSection) {
      const items = antiSection[0].match(/[-*]\s+(.+)/g);
      if (items) {
        items.forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, '').trim();
          antiPatterns.push({
            id: `anti-${index + 1}`,
            name: text.split(':')[0] || text.substring(0, 50),
            description: text,
            indicators: this.inferAntiPatternIndicators(text),
            suggestion: `Avoid: ${text}`,
          });
        });
      }
    }

    return antiPatterns;
  }

  /**
   * Extract pattern indicators for detection
   */
  private extractIndicators(name: string, content: string): PatternIndicator[] {
    const indicators: PatternIndicator[] = [];
    const nameLower = name.toLowerCase();

    // Add name-based indicators
    const keywords = nameLower.split(/\s+/).filter((w) => w.length > 3);
    for (const keyword of keywords) {
      indicators.push({
        type: 'keyword',
        pattern: new RegExp(`\\b${keyword}\\b`, 'i'),
        weight: 0.5,
      });
    }

    // Extract explicit indicators from content
    const indicatorSection = content.match(/###?\s*Indicators?[\s\S]*?(?=\n###?|$)/i);
    if (indicatorSection) {
      const items = indicatorSection[0].match(/[-*]\s+(.+)/g);
      if (items) {
        items.forEach((item) => {
          const text = item.replace(/^[-*]\s+/, '').trim();
          indicators.push({
            type: 'keyword',
            pattern: text,
            weight: 0.7,
          });
        });
      }
    }

    // Add pattern-specific indicators
    if (nameLower.includes('service')) {
      indicators.push(
        { type: 'naming', pattern: /Service$/i, weight: 0.8 },
        { type: 'annotation', pattern: /@Service|@Injectable/i, weight: 0.9 }
      );
    }
    if (nameLower.includes('repository')) {
      indicators.push(
        { type: 'naming', pattern: /Repository$/i, weight: 0.8 },
        { type: 'annotation', pattern: /@Repository/i, weight: 0.9 }
      );
    }
    if (nameLower.includes('controller')) {
      indicators.push(
        { type: 'naming', pattern: /Controller$/i, weight: 0.8 },
        { type: 'annotation', pattern: /@Controller|@RestController/i, weight: 0.9 }
      );
    }
    if (nameLower.includes('factory')) {
      indicators.push(
        { type: 'naming', pattern: /Factory$/i, weight: 0.8 },
        { type: 'keyword', pattern: /create[A-Z]/i, weight: 0.6 }
      );
    }
    if (nameLower.includes('singleton')) {
      indicators.push(
        { type: 'structure', pattern: /getInstance/i, weight: 0.9 },
        { type: 'structure', pattern: /private\s+static\s+instance/i, weight: 0.8 }
      );
    }

    return indicators;
  }

  /**
   * Add built-in patterns
   */
  private addBuiltInPatterns(): void {
    // Dependency Injection Pattern
    this.patterns.set('dependency-injection', {
      id: 'dependency-injection',
      name: 'Dependency Injection',
      description: 'Dependencies should be injected rather than instantiated directly',
      category: 'structural',
      rules: [
        {
          id: 'di-001',
          description: 'Use constructor injection for required dependencies',
          severity: 'warning',
          check: { type: 'presence', target: 'constructor', pattern: /constructor\s*\(/ },
        },
        {
          id: 'di-002',
          description: 'Avoid direct instantiation of dependencies with new',
          severity: 'warning',
          check: { type: 'absence', pattern: /new\s+[A-Z]\w*Service\s*\(/ },
        },
      ],
      antiPatterns: [
        {
          id: 'di-anti-001',
          name: 'Service Locator',
          description: 'Avoid using service locator pattern instead of DI',
          indicators: ['ServiceLocator', 'getService('],
          suggestion: 'Use constructor injection instead of service locator',
        },
      ],
      indicators: [
        { type: 'annotation', pattern: /@Inject|@Autowired/i, weight: 0.9 },
        { type: 'structure', pattern: /constructor\s*\(\s*private/i, weight: 0.8 },
      ],
    });

    // Single Responsibility Pattern
    this.patterns.set('single-responsibility', {
      id: 'single-responsibility',
      name: 'Single Responsibility Principle',
      description: 'A class should have only one reason to change',
      category: 'solid',
      rules: [
        {
          id: 'srp-001',
          description: 'Classes should focus on a single concern',
          severity: 'warning',
          check: { type: 'structure', options: { maxMethods: 15, maxLines: 300 } },
        },
      ],
      antiPatterns: [
        {
          id: 'srp-anti-001',
          name: 'God Class',
          description: 'Classes with too many responsibilities',
          indicators: ['Manager', 'Handler', 'Processor', 'Controller'],
          suggestion: 'Split into smaller, focused classes',
        },
      ],
      indicators: [],
    });

    // Layered Architecture Pattern
    this.patterns.set('layered-architecture', {
      id: 'layered-architecture',
      name: 'Layered Architecture',
      description: 'Organize code in layers: Controller -> Service -> Repository',
      category: 'architectural',
      rules: [
        {
          id: 'layer-001',
          description: 'Controllers should only call services, not repositories directly',
          severity: 'error',
          check: { type: 'absence', pattern: /Controller[\s\S]*Repository/ },
        },
        {
          id: 'layer-002',
          description: 'Repositories should not import controllers or services',
          severity: 'error',
          check: { type: 'absence', pattern: /Repository[\s\S]*import.*Controller/ },
        },
      ],
      antiPatterns: [
        {
          id: 'layer-anti-001',
          name: 'Layer Skipping',
          description: 'Bypassing intermediate layers',
          indicators: ['Controller', 'Repository'],
          suggestion: 'Go through the service layer',
        },
      ],
      indicators: [
        { type: 'naming', pattern: /(Controller|Service|Repository)$/i, weight: 0.9 },
      ],
    });

    // Error Handling Pattern
    this.patterns.set('error-handling', {
      id: 'error-handling',
      name: 'Error Handling',
      description: 'Proper error handling and propagation',
      category: 'reliability',
      rules: [
        {
          id: 'err-001',
          description: 'Catch blocks should not be empty',
          severity: 'error',
          check: { type: 'absence', pattern: /catch\s*\([^)]*\)\s*\{\s*\}/ },
        },
        {
          id: 'err-002',
          description: 'Avoid catching generic Exception without handling',
          severity: 'warning',
          check: { type: 'regex', pattern: /catch\s*\(\s*Exception\s/ },
        },
      ],
      antiPatterns: [
        {
          id: 'err-anti-001',
          name: 'Swallowed Exceptions',
          description: 'Catching exceptions without logging or rethrowing',
          indicators: ['catch', '{}'],
          suggestion: 'Log the error or rethrow with context',
        },
      ],
      indicators: [
        { type: 'keyword', pattern: /try|catch|throw|finally/i, weight: 0.5 },
      ],
    });
  }

  /**
   * Check a rule against code
   */
  private checkRule(
    code: string,
    rule: PatternRule,
    pattern: ParsedPattern,
    options: ValidationOptions
  ): RuleCheckResult {
    const result: RuleCheckResult = {
      violated: false,
      message: '',
      suggestion: '',
    };

    const { check } = rule;

    switch (check.type) {
      case 'regex':
        if (check.pattern) {
          const regex = typeof check.pattern === 'string'
            ? new RegExp(check.pattern, 'gi')
            : check.pattern;
          const matches = code.match(regex);
          if (matches) {
            result.violated = true;
            result.message = `Pattern violation: ${rule.description}. Found: ${matches.slice(0, 3).join(', ')}`;
            result.suggestion = `Review and fix the following: ${matches.slice(0, 3).join(', ')}`;
            result.location = this.findLocation(code, matches[0]);
          }
        }
        break;

      case 'absence':
        if (check.pattern) {
          const regex = typeof check.pattern === 'string'
            ? new RegExp(check.pattern, 'gi')
            : check.pattern;
          const matches = code.match(regex);
          if (matches) {
            result.violated = true;
            result.message = `Should not contain: ${rule.description}. Found: ${matches.slice(0, 3).join(', ')}`;
            result.suggestion = `Remove or refactor: ${matches[0]}`;
            result.location = this.findLocation(code, matches[0]);
          }
        }
        break;

      case 'presence':
        if (check.pattern) {
          const regex = typeof check.pattern === 'string'
            ? new RegExp(check.pattern, 'gi')
            : check.pattern;
          if (!regex.test(code)) {
            result.violated = true;
            result.message = `Missing required: ${rule.description}`;
            result.suggestion = `Add the required element following the ${pattern.name} pattern`;
          }
        }
        break;

      case 'structure':
        const structureCheck = this.checkStructure(code, check.options || {});
        if (!structureCheck.valid) {
          result.violated = true;
          result.message = structureCheck.message;
          result.suggestion = structureCheck.suggestion;
        }
        break;

      case 'naming':
        // Handled by naming convention checks
        break;

      case 'dependency':
        // Check for improper dependencies
        break;
    }

    return result;
  }

  /**
   * Check code structure against options
   */
  private checkStructure(
    code: string,
    options: Record<string, unknown>
  ): { valid: boolean; message: string; suggestion: string } {
    const lines = code.split('\n').length;
    const methods = (code.match(/(?:function|async\s+function|\w+\s*\([^)]*\)\s*(?:=>|\{))/g) || []).length;

    if (options.maxLines && lines > (options.maxLines as number)) {
      return {
        valid: false,
        message: `File has ${lines} lines, exceeds maximum of ${options.maxLines}`,
        suggestion: 'Consider splitting into smaller modules',
      };
    }

    if (options.maxMethods && methods > (options.maxMethods as number)) {
      return {
        valid: false,
        message: `Class has ${methods} methods, exceeds maximum of ${options.maxMethods}`,
        suggestion: 'Consider applying Single Responsibility Principle',
      };
    }

    return { valid: true, message: '', suggestion: '' };
  }

  /**
   * Detect anti-patterns in code
   */
  private detectAntiPattern(
    code: string,
    antiPattern: AntiPattern,
    language: string
  ): { detected: boolean; location?: CodeLocation } | null {
    for (const indicator of antiPattern.indicators) {
      if (code.includes(indicator)) {
        return {
          detected: true,
          location: this.findLocation(code, indicator),
        };
      }
    }
    return null;
  }

  /**
   * Detect which patterns are present in code
   */
  private detectPatterns(code: string, language: string): MatchedPattern[] {
    const matched: MatchedPattern[] = [];

    for (const [id, pattern] of this.patterns) {
      let score = 0;
      const locations: CodeLocation[] = [];

      for (const indicator of pattern.indicators) {
        const regex = typeof indicator.pattern === 'string'
          ? new RegExp(indicator.pattern, 'gi')
          : indicator.pattern;

        const matches = code.match(regex);
        if (matches) {
          score += indicator.weight * matches.length;
          locations.push(this.findLocation(code, matches[0]));
        }
      }

      if (score > 0.5) {
        matched.push({
          id: pattern.id,
          name: pattern.name,
          confidence: Math.min(score, 1),
          locations,
        });
      }
    }

    return matched.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate pattern relevance to code
   */
  private calculatePatternRelevance(
    code: string,
    pattern: ParsedPattern,
    language: string
  ): number {
    let relevance = 0;

    for (const indicator of pattern.indicators) {
      const regex = typeof indicator.pattern === 'string'
        ? new RegExp(indicator.pattern, 'gi')
        : indicator.pattern;

      if (regex.test(code)) {
        relevance += indicator.weight;
      }
    }

    return Math.min(relevance, 1);
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(result: ValidationResult): number {
    let score = 100;

    for (const violation of result.violations) {
      if (violation.severity === 'critical') {
        score -= 25;
      } else if (violation.severity === 'error') {
        score -= 15;
      }
    }

    for (const warning of result.warnings) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Analyze if ADR is required for changes
   */
  private analyzeForAdrRequirement(
    code: string,
    result: ValidationResult,
    context: Record<string, unknown>
  ): { required: boolean; suggestion?: AdrSuggestion } {
    // Check for architectural changes that require ADR
    const architecturalIndicators = [
      /new\s+(architecture|pattern|layer)/i,
      /(?:add|create|implement)\s+(?:new\s+)?(?:service|repository|controller)/i,
      /refactor.*architecture/i,
      /migrate.*to/i,
      /replace.*with/i,
    ];

    let requiresAdr = false;
    let reason = '';

    for (const indicator of architecturalIndicators) {
      if (indicator.test(code)) {
        requiresAdr = true;
        reason = `Code appears to introduce architectural changes`;
        break;
      }
    }

    // Check if new patterns are introduced
    if (result.matchedPatterns.length > 0 && !requiresAdr) {
      const highConfidencePatterns = result.matchedPatterns.filter((p) => p.confidence > 0.8);
      if (highConfidencePatterns.length > 2) {
        requiresAdr = true;
        reason = 'Multiple architectural patterns detected';
      }
    }

    if (!requiresAdr) {
      return { required: false };
    }

    return {
      required: true,
      suggestion: {
        title: 'Architectural Change',
        context: reason,
        reason,
        relatedPatterns: result.matchedPatterns.map((p) => p.name),
      },
    };
  }

  /**
   * Generate suggestions for improvement
   */
  private generateSuggestions(
    code: string,
    pattern: ParsedPattern,
    detectedPatterns: MatchedPattern[]
  ): PatternSuggestion[] {
    const suggestions: PatternSuggestion[] = [];

    // Check if pattern could be applied
    const isAlreadyApplied = detectedPatterns.some((p) => p.id === pattern.id);
    if (!isAlreadyApplied) {
      const relevance = this.calculatePatternRelevance(code, pattern, '');
      if (relevance > 0.3 && relevance < 0.7) {
        suggestions.push({
          id: `suggest-${pattern.id}`,
          pattern: pattern.name,
          message: `Consider fully implementing the ${pattern.name} pattern`,
          benefit: pattern.description,
        });
      }
    }

    return suggestions;
  }

  /**
   * Find related ADRs for a pattern
   */
  private findRelatedAdrs(pattern: ParsedPattern): string[] {
    // This would be enhanced to actually search Memory Bank for ADRs
    return [];
  }

  /**
   * Detect pattern changes between original and new code
   */
  private detectPatternChanges(
    original: MatchedPattern[],
    updated: MatchedPattern[]
  ): PatternChange[] {
    const changes: PatternChange[] = [];

    // Find added patterns
    for (const pattern of updated) {
      if (!original.some((p) => p.id === pattern.id)) {
        changes.push({
          pattern: pattern.name,
          type: 'added',
          confidence: pattern.confidence,
        });
      }
    }

    // Find removed patterns
    for (const pattern of original) {
      if (!updated.some((p) => p.id === pattern.id)) {
        changes.push({
          pattern: pattern.name,
          type: 'removed',
          confidence: pattern.confidence,
        });
      }
    }

    // Find modified patterns (confidence changed significantly)
    for (const pattern of updated) {
      const originalPattern = original.find((p) => p.id === pattern.id);
      if (originalPattern && Math.abs(originalPattern.confidence - pattern.confidence) > 0.3) {
        changes.push({
          pattern: pattern.name,
          type: 'modified',
          confidence: pattern.confidence,
          previousConfidence: originalPattern.confidence,
        });
      }
    }

    return changes;
  }

  /**
   * Assess architectural impact of changes
   */
  private assessArchitecturalImpact(
    patternChanges: PatternChange[],
    violations: PatternViolation[],
    result: ValidationResult
  ): ArchitecturalImpact {
    const significantChanges = patternChanges.filter(
      (c) => c.type === 'added' || c.type === 'removed'
    );

    const criticalViolations = violations.filter((v) => v.severity === 'critical');

    return {
      significant: significantChanges.length > 0 || criticalViolations.length > 0,
      patternsAffected: patternChanges.map((c) => c.pattern),
      riskLevel: criticalViolations.length > 0 ? 'high' : significantChanges.length > 1 ? 'medium' : 'low',
      description: this.generateImpactDescription(patternChanges, criticalViolations),
    };
  }

  /**
   * Generate impact description
   */
  private generateImpactDescription(
    changes: PatternChange[],
    violations: PatternViolation[]
  ): string {
    const parts: string[] = [];

    if (changes.length > 0) {
      parts.push(`${changes.length} pattern change(s) detected`);
    }
    if (violations.length > 0) {
      parts.push(`${violations.length} critical violation(s)`);
    }

    return parts.join('; ') || 'No significant architectural impact';
  }

  /**
   * Generate change summary
   */
  private generateChangeSummary(
    introduced: PatternViolation[],
    resolved: PatternViolation[],
    patternChanges: PatternChange[]
  ): string {
    const parts: string[] = [];

    if (introduced.length > 0) {
      parts.push(`+${introduced.length} new violation(s)`);
    }
    if (resolved.length > 0) {
      parts.push(`-${resolved.length} resolved violation(s)`);
    }
    if (patternChanges.length > 0) {
      parts.push(`${patternChanges.length} pattern change(s)`);
    }

    return parts.join(', ') || 'No significant changes';
  }

  /**
   * Helper methods
   */

  private detectLanguage(code: string): string {
    if (code.includes('import java.') || code.includes('public class')) return 'java';
    if (code.includes('import {') || code.includes('export ')) return 'typescript';
    if (code.includes('using System') || code.includes('namespace ')) return 'csharp';
    if (code.includes('def ') || code.includes('import ')) return 'python';
    return 'unknown';
  }

  private findLocation(code: string, match: string): CodeLocation {
    const index = code.indexOf(match);
    if (index === -1) return {};

    const lines = code.substring(0, index).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return {
      line,
      column,
      snippet: code.substring(Math.max(0, index - 50), index + match.length + 50),
    };
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
        return trimmed;
      }
    }
    return '';
  }

  private inferRuleSeverity(text: string): PatternRule['severity'] {
    const lower = text.toLowerCase();
    if (lower.includes('must') || lower.includes('critical') || lower.includes('required')) {
      return 'error';
    }
    if (lower.includes('should') || lower.includes('recommended')) {
      return 'warning';
    }
    return 'info';
  }

  private inferRuleCheck(text: string): RuleCheck {
    const lower = text.toLowerCase();
    if (lower.includes('avoid') || lower.includes('never') || lower.includes('not')) {
      return { type: 'absence', pattern: this.extractKeywordsFromRule(text) };
    }
    if (lower.includes('always') || lower.includes('must have') || lower.includes('require')) {
      return { type: 'presence', pattern: this.extractKeywordsFromRule(text) };
    }
    return { type: 'regex', pattern: '' };
  }

  private extractKeywordsFromRule(text: string): string {
    // Extract quoted strings or key terms
    const quoted = text.match(/'([^']+)'|"([^"]+)"|`([^`]+)`/);
    if (quoted) {
      return quoted[1] || quoted[2] || quoted[3];
    }
    return '';
  }

  private inferAntiPatternIndicators(text: string): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 4 && /^[A-Z]/.test(w));
    return words.slice(0, 3);
  }

  private inferCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('solid') || lower.includes('single') || lower.includes('open')) {
      return 'solid';
    }
    if (lower.includes('layer') || lower.includes('mvc') || lower.includes('clean')) {
      return 'architectural';
    }
    if (lower.includes('factory') || lower.includes('builder') || lower.includes('singleton')) {
      return 'creational';
    }
    if (lower.includes('adapter') || lower.includes('decorator') || lower.includes('facade')) {
      return 'structural';
    }
    if (lower.includes('observer') || lower.includes('strategy') || lower.includes('command')) {
      return 'behavioral';
    }
    return 'general';
  }

  private calculateIntentRelevance(intent: string, pattern: ParsedPattern): number {
    const intentLower = intent.toLowerCase();
    const nameLower = pattern.name.toLowerCase();
    const descLower = pattern.description.toLowerCase();

    let score = 0;
    const intentWords = intentLower.split(/\s+/);

    for (const word of intentWords) {
      if (word.length > 3) {
        if (nameLower.includes(word)) score += 0.3;
        if (descLower.includes(word)) score += 0.1;
      }
    }

    return Math.min(score, 1);
  }

  private getPatternBenefits(pattern: ParsedPattern): string[] {
    return [
      `Follows ${pattern.category} design principles`,
      pattern.description,
    ];
  }

  private getPatternExample(pattern: ParsedPattern, language: string): string | undefined {
    // This would be enhanced to return language-specific examples
    return undefined;
  }
}

/**
 * Validation options
 */
export interface ValidationOptions {
  language?: string;
  filePath?: string;
  context?: Record<string, unknown>;
  strictMode?: boolean;
}

/**
 * Rule check result
 */
interface RuleCheckResult {
  violated: boolean;
  message: string;
  suggestion: string;
  location?: CodeLocation;
}

/**
 * Change validation result
 */
export interface ChangeValidationResult {
  originalResult: ValidationResult;
  newResult: ValidationResult;
  changeApproved: boolean;
  introducedViolations: PatternViolation[];
  resolvedViolations: PatternViolation[];
  introducedWarnings: PatternWarning[];
  patternChanges: PatternChange[];
  architecturalImpact: ArchitecturalImpact;
  requiresAdr: boolean;
  summary: string;
}

/**
 * Pattern change between versions
 */
export interface PatternChange {
  pattern: string;
  type: 'added' | 'removed' | 'modified';
  confidence: number;
  previousConfidence?: number;
}

/**
 * Architectural impact assessment
 */
export interface ArchitecturalImpact {
  significant: boolean;
  patternsAffected: string[];
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Pattern recommendation
 */
export interface PatternRecommendation {
  pattern: string;
  description: string;
  relevance: number;
  benefits: string[];
  example?: string;
  rules: string[];
}

// Export singleton accessor
let patternValidator: PatternValidator | null = null;

export function getPatternValidator(): PatternValidator {
  if (!patternValidator) {
    patternValidator = new PatternValidator();
  }
  return patternValidator;
}
