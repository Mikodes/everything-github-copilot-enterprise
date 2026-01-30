import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  getMemoryBankApiClient,
  SearchResult,
  ContextEntry,
} from '../services/MemoryBankApiClient';

/**
 * Project context for Agent Mode (AC-014.1)
 */
export interface ProjectContext {
  projectName: string;
  description: string;
  techStack: TechStackInfo;
  patterns: ArchitecturePattern[];
  standards: TeamStandards;
  relevantAdrs: AdrSummary[];
  modules: ModuleInfo[];
  templates: CodeTemplate[];
}

/**
 * Technology stack information
 */
export interface TechStackInfo {
  primaryLanguage: string;
  framework: string;
  buildTool: string;
  testingFramework: string;
  additionalTechnologies: string[];
}

/**
 * Architecture pattern definition
 */
export interface ArchitecturePattern {
  id: string;
  name: string;
  description: string;
  category: string;
  usage: string;
  examples: string[];
  antiPatterns: string[];
}

/**
 * Team standards for code generation (AC-014.4)
 */
export interface TeamStandards {
  codeStyle: StyleRule[];
  namingConventions: NamingConvention[];
  architectureRules: ArchitectureRule[];
  securityRules: SecurityRule[];
  testingRules: TestingRule[];
}

export interface StyleRule {
  id: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  examples: { good: string; bad: string }[];
}

export interface NamingConvention {
  type: string;
  pattern: string;
  examples: string[];
}

export interface ArchitectureRule {
  id: string;
  rule: string;
  rationale: string;
  relatedAdrs: string[];
}

export interface SecurityRule {
  id: string;
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  owasp: string[];
}

export interface TestingRule {
  id: string;
  rule: string;
  coverageTarget: number;
  requiredTypes: string[];
}

/**
 * ADR summary for context
 */
export interface AdrSummary {
  id: string;
  title: string;
  status: string;
  decision: string;
  context: string;
  consequences: string[];
}

/**
 * Module information
 */
export interface ModuleInfo {
  name: string;
  path: string;
  description: string;
  owner: string;
  dependencies: string[];
}

/**
 * Code template for generation (AC-014.3)
 */
export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  template: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  default?: string;
  required: boolean;
}

/**
 * Agent Mode Context Tool - Provides project context to Copilot Agent Mode
 * Implements US-014: Integration with Copilot Agent Mode
 *
 * Features:
 * - AC-014.1: Agent Mode receives project context automatically
 * - AC-014.2: Respects documented architecture patterns
 * - AC-014.3: Uses Memory Bank templates for code generation
 * - AC-014.4: Validates changes against team standards before applying
 */
export class AgentModeProvider implements vscode.LanguageModelTool<ProjectContextInput> {
  private static instance: AgentModeProvider | null = null;
  private workspaceRoot: string | undefined;
  private cachedContext: ProjectContext | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheDuration = 60000; // 1 minute cache

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  static getInstance(): AgentModeProvider {
    if (!AgentModeProvider.instance) {
      AgentModeProvider.instance = new AgentModeProvider();
    }
    return AgentModeProvider.instance;
  }

  /**
   * Register the Agent Mode tool with VS Code
   */
  register(context: vscode.ExtensionContext): void {
    // Register as Language Model Tool for Agent Mode
    context.subscriptions.push(
      vscode.lm.registerTool('egce_project_context', this)
    );

    // Register additional Agent Mode tools
    context.subscriptions.push(
      vscode.lm.registerTool('egce_validate_code', new CodeValidationTool(this)),
      vscode.lm.registerTool('egce_get_template', new TemplateTool(this)),
      vscode.lm.registerTool('egce_search_patterns', new PatternSearchTool(this)),
      vscode.lm.registerTool('egce_generate_adr', new AdrGeneratorTool(this))
    );

    console.log('Agent Mode Provider registered with tools: egce_project_context, egce_validate_code, egce_get_template, egce_search_patterns, egce_generate_adr');
  }

  /**
   * Prepare tool invocation - called before the tool is invoked
   */
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ProjectContextInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { input } = options;

    // Determine confirmation message based on requested context
    let message = 'Load Memory Bank project context for Agent Mode';
    if (input.includePatterns) {
      message += ', including architecture patterns';
    }
    if (input.includeTemplates) {
      message += ' and code templates';
    }

    return {
      invocationMessage: message,
    };
  }

  /**
   * Invoke the tool - main entry point for Agent Mode context
   */
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ProjectContextInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { input } = options;

    try {
      const context = await this.getProjectContext(input, token);

      // Format context for the model
      const formattedContext = this.formatContextForModel(context, input);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(formattedContext),
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error loading project context: ${errorMessage}`),
      ]);
    }
  }

  /**
   * Get complete project context (AC-014.1)
   */
  async getProjectContext(
    input: ProjectContextInput,
    token: vscode.CancellationToken
  ): Promise<ProjectContext> {
    // Check cache validity
    if (
      this.cachedContext &&
      Date.now() - this.cacheTimestamp < this.cacheDuration
    ) {
      return this.filterContext(this.cachedContext, input);
    }

    const context: ProjectContext = {
      projectName: '',
      description: '',
      techStack: await this.loadTechStack(),
      patterns: [],
      standards: await this.loadTeamStandards(),
      relevantAdrs: [],
      modules: [],
      templates: [],
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
      const projectContent = await fs.readFile(
        path.join(basePath, 'project', 'context.md'),
        'utf-8'
      );
      context.projectName = this.extractProjectName(projectContent);
      context.description = this.extractDescription(projectContent);
    } catch {
      context.projectName = this.workspaceRoot.split(path.sep).pop() || 'Unknown';
    }

    if (token.isCancellationRequested) return context;

    // Load patterns (AC-014.2)
    if (input.includePatterns !== false) {
      context.patterns = await this.loadArchitecturePatterns(basePath);
    }

    if (token.isCancellationRequested) return context;

    // Load ADRs
    context.relevantAdrs = await this.loadAdrs(basePath);

    if (token.isCancellationRequested) return context;

    // Load modules
    context.modules = await this.loadModules(basePath);

    if (token.isCancellationRequested) return context;

    // Load templates (AC-014.3)
    if (input.includeTemplates) {
      context.templates = await this.loadTemplates(basePath);
    }

    // Cache the context
    this.cachedContext = context;
    this.cacheTimestamp = Date.now();

    return context;
  }

  /**
   * Load technology stack information
   */
  private async loadTechStack(): Promise<TechStackInfo> {
    const defaultStack: TechStackInfo = {
      primaryLanguage: 'unknown',
      framework: 'unknown',
      buildTool: 'unknown',
      testingFramework: 'unknown',
      additionalTechnologies: [],
    };

    if (!this.workspaceRoot) return defaultStack;

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');

    try {
      const techStackPath = path.join(
        this.workspaceRoot,
        memoryBankPath,
        'project',
        'tech-stack.md'
      );
      const content = await fs.readFile(techStackPath, 'utf-8');
      return this.parseTechStack(content);
    } catch {
      // Try to detect from workspace
      return this.detectTechStack();
    }
  }

  /**
   * Parse tech stack from markdown content
   */
  private parseTechStack(content: string): TechStackInfo {
    const stack: TechStackInfo = {
      primaryLanguage: 'unknown',
      framework: 'unknown',
      buildTool: 'unknown',
      testingFramework: 'unknown',
      additionalTechnologies: [],
    };

    const languageMatch = content.match(/(?:language|lenguaje)[:\s]+([^\n]+)/i);
    if (languageMatch) stack.primaryLanguage = languageMatch[1].trim();

    const frameworkMatch = content.match(/framework[:\s]+([^\n]+)/i);
    if (frameworkMatch) stack.framework = frameworkMatch[1].trim();

    const buildMatch = content.match(/(?:build|compilación)[:\s]+([^\n]+)/i);
    if (buildMatch) stack.buildTool = buildMatch[1].trim();

    const testMatch = content.match(/(?:testing|test|pruebas)[:\s]+([^\n]+)/i);
    if (testMatch) stack.testingFramework = testMatch[1].trim();

    return stack;
  }

  /**
   * Detect tech stack from workspace files
   */
  private async detectTechStack(): Promise<TechStackInfo> {
    const stack: TechStackInfo = {
      primaryLanguage: 'unknown',
      framework: 'unknown',
      buildTool: 'unknown',
      testingFramework: 'unknown',
      additionalTechnologies: [],
    };

    if (!this.workspaceRoot) return stack;

    // Check for common project files
    const checks = [
      { file: 'pom.xml', lang: 'Java', build: 'Maven', framework: 'Spring' },
      { file: 'build.gradle', lang: 'Java', build: 'Gradle', framework: 'Spring' },
      { file: 'package.json', lang: 'TypeScript/JavaScript', build: 'npm', framework: 'Node.js' },
      { file: '*.csproj', lang: 'C#', build: 'dotnet', framework: '.NET' },
      { file: 'Cargo.toml', lang: 'Rust', build: 'Cargo', framework: 'Rust' },
      { file: 'go.mod', lang: 'Go', build: 'Go', framework: 'Go' },
      { file: 'requirements.txt', lang: 'Python', build: 'pip', framework: 'Python' },
    ];

    for (const check of checks) {
      try {
        const pattern = new vscode.RelativePattern(this.workspaceRoot, check.file);
        const files = await vscode.workspace.findFiles(pattern, null, 1);
        if (files.length > 0) {
          stack.primaryLanguage = check.lang;
          stack.buildTool = check.build;
          stack.framework = check.framework;
          break;
        }
      } catch {
        // Continue checking
      }
    }

    return stack;
  }

  /**
   * Load team standards (AC-014.4)
   */
  private async loadTeamStandards(): Promise<TeamStandards> {
    const standards: TeamStandards = {
      codeStyle: [],
      namingConventions: [],
      architectureRules: [],
      securityRules: [],
      testingRules: [],
    };

    if (!this.workspaceRoot) return standards;

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const basePath = path.join(this.workspaceRoot, memoryBankPath);

    // Load from knowledge/patterns.md
    try {
      const patternsContent = await fs.readFile(
        path.join(basePath, 'knowledge', 'patterns.md'),
        'utf-8'
      );
      this.extractStandardsFromPatterns(patternsContent, standards);
    } catch {
      // No patterns file
    }

    // Load from knowledge/standards.md if exists
    try {
      const standardsContent = await fs.readFile(
        path.join(basePath, 'knowledge', 'standards.md'),
        'utf-8'
      );
      this.parseStandardsFile(standardsContent, standards);
    } catch {
      // No standards file
    }

    // Load security rules
    try {
      const securityContent = await fs.readFile(
        path.join(basePath, 'knowledge', 'security.md'),
        'utf-8'
      );
      this.parseSecurityRules(securityContent, standards);
    } catch {
      // Add default security rules
      standards.securityRules = this.getDefaultSecurityRules();
    }

    return standards;
  }

  /**
   * Extract standards from patterns file
   */
  private extractStandardsFromPatterns(content: string, standards: TeamStandards): void {
    // Extract code style rules
    const codeStyleSection = content.match(/##\s*Code\s*Style[\s\S]*?(?=\n##|$)/i);
    if (codeStyleSection) {
      const rules = codeStyleSection[0].match(/[-*]\s+(.+)/g);
      if (rules) {
        standards.codeStyle = rules.map((rule, index) => ({
          id: `style-${index + 1}`,
          rule: rule.replace(/^[-*]\s+/, ''),
          severity: 'warning' as const,
          examples: [],
        }));
      }
    }

    // Extract naming conventions
    const namingSection = content.match(/##\s*Naming[\s\S]*?(?=\n##|$)/i);
    if (namingSection) {
      const conventions = namingSection[0].match(/[-*]\s+(.+)/g);
      if (conventions) {
        standards.namingConventions = conventions.map((conv) => {
          const text = conv.replace(/^[-*]\s+/, '');
          return {
            type: 'general',
            pattern: text,
            examples: [],
          };
        });
      }
    }
  }

  /**
   * Parse dedicated standards file
   */
  private parseStandardsFile(content: string, standards: TeamStandards): void {
    const sections = content.split(/\n##\s+/);

    for (const section of sections) {
      const lines = section.split('\n');
      const header = lines[0]?.toLowerCase() || '';

      if (header.includes('style') || header.includes('estilo')) {
        const rules = lines.slice(1).filter(l => l.trim().startsWith('-'));
        standards.codeStyle.push(
          ...rules.map((rule, index) => ({
            id: `parsed-style-${index + 1}`,
            rule: rule.replace(/^[-*]\s+/, '').trim(),
            severity: 'warning' as const,
            examples: [],
          }))
        );
      }

      if (header.includes('architecture') || header.includes('arquitectura')) {
        const rules = lines.slice(1).filter(l => l.trim().startsWith('-'));
        standards.architectureRules.push(
          ...rules.map((rule, index) => ({
            id: `arch-${index + 1}`,
            rule: rule.replace(/^[-*]\s+/, '').trim(),
            rationale: '',
            relatedAdrs: [],
          }))
        );
      }

      if (header.includes('testing') || header.includes('pruebas')) {
        const rules = lines.slice(1).filter(l => l.trim().startsWith('-'));
        standards.testingRules.push(
          ...rules.map((rule, index) => ({
            id: `test-${index + 1}`,
            rule: rule.replace(/^[-*]\s+/, '').trim(),
            coverageTarget: 80,
            requiredTypes: ['unit'],
          }))
        );
      }
    }
  }

  /**
   * Parse security rules from file
   */
  private parseSecurityRules(content: string, standards: TeamStandards): void {
    const rules = content.match(/[-*]\s+(.+)/g);
    if (rules) {
      standards.securityRules = rules.map((rule, index) => ({
        id: `security-${index + 1}`,
        rule: rule.replace(/^[-*]\s+/, ''),
        severity: 'high' as const,
        owasp: [],
      }));
    }
  }

  /**
   * Get default security rules
   */
  private getDefaultSecurityRules(): SecurityRule[] {
    return [
      {
        id: 'sec-001',
        rule: 'Validate all user inputs before processing',
        severity: 'critical',
        owasp: ['A03:2021-Injection'],
      },
      {
        id: 'sec-002',
        rule: 'Use parameterized queries for database operations',
        severity: 'critical',
        owasp: ['A03:2021-Injection'],
      },
      {
        id: 'sec-003',
        rule: 'Implement proper authentication and session management',
        severity: 'critical',
        owasp: ['A07:2021-Identification and Authentication Failures'],
      },
      {
        id: 'sec-004',
        rule: 'Encode output to prevent XSS attacks',
        severity: 'high',
        owasp: ['A03:2021-Injection'],
      },
      {
        id: 'sec-005',
        rule: 'Use HTTPS for all communications',
        severity: 'high',
        owasp: ['A02:2021-Cryptographic Failures'],
      },
    ];
  }

  /**
   * Load architecture patterns (AC-014.2)
   */
  private async loadArchitecturePatterns(basePath: string): Promise<ArchitecturePattern[]> {
    const patterns: ArchitecturePattern[] = [];

    try {
      const patternsPath = path.join(basePath, 'knowledge', 'patterns.md');
      const content = await fs.readFile(patternsPath, 'utf-8');

      // Parse patterns from markdown
      const patternSections = content.split(/\n##\s+/).filter(s => s.trim());

      for (let i = 0; i < patternSections.length; i++) {
        const section = patternSections[i];
        const lines = section.split('\n');
        const name = lines[0]?.trim() || `Pattern ${i + 1}`;

        if (!name || name.toLowerCase().includes('table of contents')) continue;

        const description = lines.slice(1, 3).join(' ').trim();
        const usage = this.extractSection(section, 'Usage') ||
                     this.extractSection(section, 'Uso') || '';
        const examples = this.extractListItems(section, 'Example') ||
                        this.extractListItems(section, 'Ejemplo') || [];
        const antiPatterns = this.extractListItems(section, 'Anti-pattern') ||
                            this.extractListItems(section, 'Antipatrón') || [];

        patterns.push({
          id: `pattern-${i + 1}`,
          name,
          description,
          category: this.inferPatternCategory(name),
          usage,
          examples,
          antiPatterns,
        });
      }
    } catch {
      // No patterns file
    }

    // Also search in dedicated patterns directory
    try {
      const patternsDir = path.join(basePath, 'patterns');
      const files = await fs.readdir(patternsDir);

      for (const file of files) {
        if (file.endsWith('.md')) {
          try {
            const content = await fs.readFile(path.join(patternsDir, file), 'utf-8');
            const name = this.extractTitle(content) || file.replace('.md', '');
            const description = this.extractDescription(content);

            patterns.push({
              id: file.replace('.md', ''),
              name,
              description,
              category: this.inferPatternCategory(name),
              usage: this.extractSection(content, 'Usage') || '',
              examples: this.extractListItems(content, 'Example') || [],
              antiPatterns: this.extractListItems(content, 'Anti-pattern') || [],
            });
          } catch {
            // Skip invalid file
          }
        }
      }
    } catch {
      // Patterns directory doesn't exist
    }

    return patterns;
  }

  /**
   * Load ADRs from Memory Bank
   */
  private async loadAdrs(basePath: string): Promise<AdrSummary[]> {
    const adrs: AdrSummary[] = [];

    try {
      const decisionsPath = path.join(basePath, 'decisions');
      const files = await fs.readdir(decisionsPath);

      for (const file of files) {
        if (file.endsWith('.md')) {
          try {
            const content = await fs.readFile(path.join(decisionsPath, file), 'utf-8');
            const title = this.extractTitle(content) || file.replace('.md', '');
            const status = this.extractAdrStatus(content);
            const decision = this.extractSection(content, 'Decision') ||
                            this.extractSection(content, 'Decisión') || '';
            const context = this.extractSection(content, 'Context') ||
                           this.extractSection(content, 'Contexto') || '';
            const consequences = this.extractListItems(content, 'Consequences') ||
                                this.extractListItems(content, 'Consecuencias') || [];

            adrs.push({
              id: file.replace('.md', ''),
              title,
              status,
              decision,
              context,
              consequences,
            });
          } catch {
            // Skip invalid ADR
          }
        }
      }
    } catch {
      // Decisions directory doesn't exist
    }

    return adrs;
  }

  /**
   * Load modules information
   */
  private async loadModules(basePath: string): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];

    try {
      const modulesPath = path.join(basePath, 'modules');
      const dirs = await fs.readdir(modulesPath);

      for (const dir of dirs) {
        try {
          const stat = await fs.stat(path.join(modulesPath, dir));
          if (stat.isDirectory()) {
            const contextPath = path.join(modulesPath, dir, 'context.md');
            let description = '';
            let owner = '';
            let dependencies: string[] = [];

            try {
              const content = await fs.readFile(contextPath, 'utf-8');
              description = this.extractDescription(content);
              const ownerMatch = content.match(/owner[:\s]+(.+)/i);
              if (ownerMatch) owner = ownerMatch[1].trim();
              dependencies = this.extractListItems(content, 'Dependencies') || [];
            } catch {
              // No context file
            }

            modules.push({
              name: dir,
              path: path.join(modulesPath, dir),
              description,
              owner,
              dependencies,
            });
          }
        } catch {
          // Skip invalid directory
        }
      }
    } catch {
      // Modules directory doesn't exist
    }

    return modules;
  }

  /**
   * Load code templates (AC-014.3)
   */
  private async loadTemplates(basePath: string): Promise<CodeTemplate[]> {
    const templates: CodeTemplate[] = [];

    try {
      const templatesPath = path.join(basePath, 'templates');
      const files = await fs.readdir(templatesPath);

      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.template')) {
          try {
            const content = await fs.readFile(path.join(templatesPath, file), 'utf-8');
            const template = this.parseTemplate(file, content);
            if (template) {
              templates.push(template);
            }
          } catch {
            // Skip invalid template
          }
        }
      }
    } catch {
      // Templates directory doesn't exist - add default templates
      templates.push(...this.getDefaultTemplates());
    }

    return templates;
  }

  /**
   * Parse a template file
   */
  private parseTemplate(filename: string, content: string): CodeTemplate | null {
    const name = this.extractTitle(content) || filename.replace(/\.(md|template)$/, '');
    const description = this.extractDescription(content);

    // Extract template code block
    const codeBlockMatch = content.match(/```(\w+)\n([\s\S]*?)```/);
    if (!codeBlockMatch) return null;

    const language = codeBlockMatch[1];
    const templateContent = codeBlockMatch[2];

    // Extract variables from template (${varName})
    const variableMatches = templateContent.match(/\$\{(\w+)\}/g) || [];
    const variables: TemplateVariable[] = [...new Set(variableMatches)].map((v) => {
      const varName = v.replace(/\$\{|\}/g, '');
      return {
        name: varName,
        description: `Variable: ${varName}`,
        type: 'string' as const,
        required: true,
      };
    });

    return {
      id: filename.replace(/\.(md|template)$/, ''),
      name,
      description,
      language,
      category: this.inferTemplateCategory(name),
      template: templateContent,
      variables,
    };
  }

  /**
   * Get default templates for common patterns
   */
  private getDefaultTemplates(): CodeTemplate[] {
    return [
      {
        id: 'service-class',
        name: 'Service Class',
        description: 'Template for creating a service class',
        language: 'typescript',
        category: 'service',
        template: `/**
 * \${serviceName} - \${description}
 */
export class \${serviceName}Service {
  constructor(
    private readonly \${dependencyName}: \${dependencyType}
  ) {}

  async \${methodName}(\${parameters}): Promise<\${returnType}> {
    // Implementation
  }
}`,
        variables: [
          { name: 'serviceName', description: 'Name of the service', type: 'string', required: true },
          { name: 'description', description: 'Service description', type: 'string', required: true },
          { name: 'dependencyName', description: 'Dependency name', type: 'string', required: false },
          { name: 'dependencyType', description: 'Dependency type', type: 'string', required: false },
          { name: 'methodName', description: 'Main method name', type: 'string', required: true },
          { name: 'parameters', description: 'Method parameters', type: 'string', required: false },
          { name: 'returnType', description: 'Return type', type: 'string', required: true },
        ],
      },
      {
        id: 'api-endpoint',
        name: 'API Endpoint',
        description: 'Template for creating a REST API endpoint',
        language: 'typescript',
        category: 'api',
        template: `/**
 * \${endpointDescription}
 * @route \${httpMethod} \${route}
 */
export async function \${handlerName}(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Validate input
    const { \${inputFields} } = req.\${inputSource};

    // Process request
    const result = await \${serviceCall};

    // Return response
    res.status(\${statusCode}).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}`,
        variables: [
          { name: 'endpointDescription', description: 'Endpoint description', type: 'string', required: true },
          { name: 'httpMethod', description: 'HTTP method (GET, POST, etc.)', type: 'string', required: true },
          { name: 'route', description: 'API route', type: 'string', required: true },
          { name: 'handlerName', description: 'Handler function name', type: 'string', required: true },
          { name: 'inputFields', description: 'Input field names', type: 'string', required: false },
          { name: 'inputSource', description: 'Input source (body, params, query)', type: 'string', required: true },
          { name: 'serviceCall', description: 'Service method call', type: 'string', required: true },
          { name: 'statusCode', description: 'Success status code', type: 'number', required: true },
        ],
      },
    ];
  }

  /**
   * Format context for the language model
   */
  private formatContextForModel(context: ProjectContext, input: ProjectContextInput): string {
    let output = `# Project Context: ${context.projectName}\n\n`;
    output += `${context.description}\n\n`;

    // Tech Stack
    output += `## Technology Stack\n`;
    output += `- **Language**: ${context.techStack.primaryLanguage}\n`;
    output += `- **Framework**: ${context.techStack.framework}\n`;
    output += `- **Build Tool**: ${context.techStack.buildTool}\n`;
    output += `- **Testing**: ${context.techStack.testingFramework}\n\n`;

    // Team Standards (AC-014.4)
    if (input.includeStandards !== false) {
      output += `## Team Standards\n\n`;

      if (context.standards.codeStyle.length > 0) {
        output += `### Code Style\n`;
        for (const rule of context.standards.codeStyle.slice(0, 5)) {
          output += `- ${rule.rule}\n`;
        }
        output += '\n';
      }

      if (context.standards.namingConventions.length > 0) {
        output += `### Naming Conventions\n`;
        for (const conv of context.standards.namingConventions.slice(0, 5)) {
          output += `- ${conv.pattern}\n`;
        }
        output += '\n';
      }

      if (context.standards.securityRules.length > 0) {
        output += `### Security Rules\n`;
        for (const rule of context.standards.securityRules.slice(0, 5)) {
          output += `- [${rule.severity.toUpperCase()}] ${rule.rule}\n`;
        }
        output += '\n';
      }
    }

    // Architecture Patterns (AC-014.2)
    if (input.includePatterns !== false && context.patterns.length > 0) {
      output += `## Architecture Patterns\n\n`;
      for (const pattern of context.patterns.slice(0, 10)) {
        output += `### ${pattern.name}\n`;
        output += `${pattern.description}\n`;
        if (pattern.usage) {
          output += `**Usage**: ${pattern.usage}\n`;
        }
        if (pattern.antiPatterns.length > 0) {
          output += `**Avoid**: ${pattern.antiPatterns.join(', ')}\n`;
        }
        output += '\n';
      }
    }

    // Relevant ADRs
    if (context.relevantAdrs.length > 0) {
      output += `## Architecture Decisions\n\n`;
      for (const adr of context.relevantAdrs.slice(0, 10)) {
        output += `### ${adr.id}: ${adr.title} (${adr.status})\n`;
        output += `**Decision**: ${adr.decision.substring(0, 200)}${adr.decision.length > 200 ? '...' : ''}\n\n`;
      }
    }

    // Modules
    if (context.modules.length > 0) {
      output += `## Project Modules\n\n`;
      for (const module of context.modules.slice(0, 10)) {
        output += `- **${module.name}**: ${module.description || 'No description'}\n`;
        if (module.owner) {
          output += `  - Owner: ${module.owner}\n`;
        }
      }
      output += '\n';
    }

    // Templates (AC-014.3)
    if (input.includeTemplates && context.templates.length > 0) {
      output += `## Available Code Templates\n\n`;
      for (const template of context.templates) {
        output += `- **${template.name}** (${template.language}): ${template.description}\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Filter context based on input parameters
   */
  private filterContext(context: ProjectContext, input: ProjectContextInput): ProjectContext {
    const filtered = { ...context };

    if (input.includePatterns === false) {
      filtered.patterns = [];
    }

    if (!input.includeTemplates) {
      filtered.templates = [];
    }

    if (input.includeStandards === false) {
      filtered.standards = {
        codeStyle: [],
        namingConventions: [],
        architectureRules: [],
        securityRules: [],
        testingRules: [],
      };
    }

    return filtered;
  }

  // Helper methods

  private extractProjectName(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Unknown Project';
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
        return line;
      }
    }
    return '';
  }

  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=\\n##|$)`, 'i');
    const match = content.match(regex);
    if (match) {
      return match[0].replace(/^##\s*.+\n+/, '').trim();
    }
    return '';
  }

  private extractListItems(content: string, sectionName: string): string[] {
    const section = this.extractSection(content, sectionName);
    if (!section) return [];

    const items = section.match(/[-*]\s+(.+)/g);
    if (!items) return [];

    return items.map((item) => item.replace(/^[-*]\s+/, '').trim());
  }

  private extractAdrStatus(content: string): string {
    const statusMatch = content.match(/##\s*Status\s*\n+(\w+)/i);
    return statusMatch ? statusMatch[1].toLowerCase() : 'proposed';
  }

  private inferPatternCategory(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('service') || nameLower.includes('repository')) return 'structural';
    if (nameLower.includes('factory') || nameLower.includes('builder')) return 'creational';
    if (nameLower.includes('observer') || nameLower.includes('strategy')) return 'behavioral';
    if (nameLower.includes('api') || nameLower.includes('rest')) return 'integration';
    return 'general';
  }

  private inferTemplateCategory(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('service')) return 'service';
    if (nameLower.includes('controller') || nameLower.includes('api')) return 'api';
    if (nameLower.includes('test')) return 'testing';
    if (nameLower.includes('model') || nameLower.includes('entity')) return 'model';
    return 'general';
  }

  /**
   * Invalidate the cached context
   */
  invalidateCache(): void {
    this.cachedContext = null;
    this.cacheTimestamp = 0;
  }
}

/**
 * Input parameters for project context tool
 */
interface ProjectContextInput {
  includePatterns?: boolean;
  includeTemplates?: boolean;
  includeStandards?: boolean;
  currentFile?: string;
}

/**
 * Code Validation Tool - Validates code against team standards (AC-014.4)
 */
class CodeValidationTool implements vscode.LanguageModelTool<CodeValidationInput> {
  constructor(private provider: AgentModeProvider) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CodeValidationInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Validating code against team standards...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CodeValidationInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { input } = options;
    const context = await this.provider.getProjectContext({ includeStandards: true }, token);

    const validationResults = this.validateCode(input.code, context.standards, input.language);

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(validationResults, null, 2)),
    ]);
  }

  private validateCode(
    code: string,
    standards: TeamStandards,
    language?: string
  ): ValidationResult {
    const violations: ValidationViolation[] = [];
    const suggestions: string[] = [];

    // Check naming conventions
    for (const convention of standards.namingConventions) {
      // Simple pattern matching for common naming issues
      if (convention.pattern.toLowerCase().includes('camelcase')) {
        const snakeCaseMatches = code.match(/[a-z]+_[a-z]+/g);
        if (snakeCaseMatches) {
          violations.push({
            rule: convention.pattern,
            severity: 'warning',
            message: `Found snake_case naming: ${snakeCaseMatches.slice(0, 3).join(', ')}`,
            suggestion: 'Use camelCase for variable and function names',
          });
        }
      }
    }

    // Check security rules
    for (const rule of standards.securityRules) {
      if (rule.rule.toLowerCase().includes('sql') && code.toLowerCase().includes('query')) {
        const rawQueries = code.match(/['"`].*SELECT.*['"`]\s*\+/i);
        if (rawQueries) {
          violations.push({
            rule: rule.rule,
            severity: rule.severity,
            message: 'Potential SQL injection vulnerability detected',
            suggestion: 'Use parameterized queries instead of string concatenation',
          });
        }
      }

      if (rule.rule.toLowerCase().includes('input') && !code.includes('validate')) {
        suggestions.push('Consider adding input validation for user-provided data');
      }
    }

    // Check code style rules
    for (const styleRule of standards.codeStyle) {
      if (styleRule.rule.toLowerCase().includes('comment') && !code.includes('//') && !code.includes('/*')) {
        suggestions.push('Consider adding comments to explain complex logic');
      }
    }

    return {
      valid: violations.filter((v) => v.severity === 'critical' || v.severity === 'error').length === 0,
      violations,
      suggestions,
      summary: `Found ${violations.length} violation(s) and ${suggestions.length} suggestion(s)`,
    };
  }
}

interface CodeValidationInput {
  code: string;
  language?: string;
}

interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  suggestions: string[];
  summary: string;
}

interface ValidationViolation {
  rule: string;
  severity: string;
  message: string;
  suggestion: string;
}

/**
 * Template Tool - Provides code templates for generation (AC-014.3)
 */
class TemplateTool implements vscode.LanguageModelTool<TemplateInput> {
  constructor(private provider: AgentModeProvider) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<TemplateInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { input } = options;
    return {
      invocationMessage: `Loading template: ${input.templateId || input.category || 'all templates'}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<TemplateInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { input } = options;
    const context = await this.provider.getProjectContext({ includeTemplates: true }, token);

    let templates = context.templates;

    // Filter by templateId or category
    if (input.templateId) {
      templates = templates.filter((t) => t.id === input.templateId);
    } else if (input.category) {
      templates = templates.filter((t) => t.category === input.category);
    }

    if (templates.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('No templates found matching the criteria.'),
      ]);
    }

    // Format templates for output
    let output = '# Available Code Templates\n\n';
    for (const template of templates) {
      output += `## ${template.name}\n`;
      output += `**ID**: ${template.id}\n`;
      output += `**Language**: ${template.language}\n`;
      output += `**Category**: ${template.category}\n`;
      output += `**Description**: ${template.description}\n\n`;
      output += '```' + template.language + '\n';
      output += template.template;
      output += '\n```\n\n';

      if (template.variables.length > 0) {
        output += '**Variables**:\n';
        for (const v of template.variables) {
          output += `- \`${v.name}\` (${v.type}${v.required ? ', required' : ''}): ${v.description}\n`;
        }
        output += '\n';
      }
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(output),
    ]);
  }
}

interface TemplateInput {
  templateId?: string;
  category?: string;
}

/**
 * Pattern Search Tool - Searches architecture patterns (AC-014.2)
 */
class PatternSearchTool implements vscode.LanguageModelTool<PatternSearchInput> {
  constructor(private provider: AgentModeProvider) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<PatternSearchInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Searching architecture patterns: ${options.input.query}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<PatternSearchInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { input } = options;
    const context = await this.provider.getProjectContext({ includePatterns: true }, token);

    // Search patterns
    const queryLower = input.query.toLowerCase();
    const matchingPatterns = context.patterns.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower) ||
        p.category.toLowerCase().includes(queryLower)
    );

    // Also search Memory Bank API
    const apiClient = getMemoryBankApiClient();
    const searchResponse = await apiClient.search(input.query, {
      types: ['pattern'],
      limit: 5,
    });

    let output = `# Pattern Search Results for: "${input.query}"\n\n`;

    if (matchingPatterns.length > 0) {
      output += `## Local Patterns (${matchingPatterns.length} found)\n\n`;
      for (const pattern of matchingPatterns) {
        output += `### ${pattern.name}\n`;
        output += `**Category**: ${pattern.category}\n`;
        output += `${pattern.description}\n`;
        if (pattern.usage) {
          output += `\n**Usage**:\n${pattern.usage}\n`;
        }
        if (pattern.examples.length > 0) {
          output += `\n**Examples**:\n${pattern.examples.map((e) => `- ${e}`).join('\n')}\n`;
        }
        if (pattern.antiPatterns.length > 0) {
          output += `\n**Anti-patterns to avoid**:\n${pattern.antiPatterns.map((a) => `- ${a}`).join('\n')}\n`;
        }
        output += '\n---\n\n';
      }
    }

    if (searchResponse.results.length > 0) {
      output += `## Memory Bank Results (${searchResponse.results.length} found)\n\n`;
      for (const result of searchResponse.results) {
        output += `### ${result.entry.title}\n`;
        output += `**Relevance**: ${Math.round(result.similarity * 100)}%\n`;
        output += `${result.entry.content.substring(0, 500)}...\n\n`;
      }
    }

    if (matchingPatterns.length === 0 && searchResponse.results.length === 0) {
      output += 'No patterns found matching your query.\n';
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(output),
    ]);
  }
}

interface PatternSearchInput {
  query: string;
}

/**
 * ADR Generator Tool - Generates ADR drafts (AC-014.5)
 */
class AdrGeneratorTool implements vscode.LanguageModelTool<AdrGeneratorInput> {
  constructor(private provider: AgentModeProvider) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AdrGeneratorInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Generating ADR draft: ${options.input.title}`,
      confirmationMessages: {
        title: 'Generate Architecture Decision Record?',
        message: `Create a new ADR for: ${options.input.title}`,
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AdrGeneratorInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { input } = options;
    const context = await this.provider.getProjectContext({}, token);

    // Generate ADR number
    const adrNumber = context.relevantAdrs.length + 1;
    const adrId = `ADR-${String(adrNumber).padStart(4, '0')}`;
    const date = new Date().toISOString().split('T')[0];

    // Generate ADR content
    const adrContent = `# ${adrId}: ${input.title}

## Status

Proposed

## Date

${date}

## Context

${input.context || 'Describe the context and problem statement here.'}

## Decision

${input.decision || 'Describe the decision that was made here.'}

## Consequences

### Positive

${input.positiveConsequences?.map((c) => `- ${c}`).join('\n') || '- [Add positive consequences]'}

### Negative

${input.negativeConsequences?.map((c) => `- ${c}`).join('\n') || '- [Add negative consequences]'}

### Neutral

- [Add neutral consequences]

## Alternatives Considered

${input.alternatives?.map((a, i) => `### Alternative ${i + 1}: ${a.name}\n\n${a.description}\n\n**Pros**: ${a.pros?.join(', ') || 'N/A'}\n**Cons**: ${a.cons?.join(', ') || 'N/A'}`).join('\n\n') || '### Alternative 1\n\nDescribe the alternative here.'}

## Related ADRs

${context.relevantAdrs
  .filter((adr) => adr.status === 'accepted')
  .slice(0, 3)
  .map((adr) => `- ${adr.id}: ${adr.title}`)
  .join('\n') || '- None'}

## References

- [Add relevant links and references]

---

*This ADR was auto-generated by EGCE Agent Mode on ${date}*
`;

    // Return the generated ADR
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`# Generated ADR Draft\n\n\`\`\`markdown\n${adrContent}\n\`\`\`\n\n**Next Steps**:\n1. Review and refine the generated content\n2. Save to \`.memory-bank/decisions/${adrId.toLowerCase()}.md\`\n3. Update status when decision is finalized`),
    ]);
  }
}

interface AdrGeneratorInput {
  title: string;
  context?: string;
  decision?: string;
  positiveConsequences?: string[];
  negativeConsequences?: string[];
  alternatives?: Array<{
    name: string;
    description: string;
    pros?: string[];
    cons?: string[];
  }>;
}

// Export singleton accessor
let agentModeProvider: AgentModeProvider | null = null;

export function getAgentModeProvider(): AgentModeProvider {
  if (!agentModeProvider) {
    agentModeProvider = new AgentModeProvider();
  }
  return agentModeProvider;
}
