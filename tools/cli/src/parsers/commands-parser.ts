/**
 * Claude Code Commands Parser
 *
 * Parses Claude Code command definitions and converts them to EGCE prompt format.
 * Commands in Claude Code are slash commands that trigger specific AI behaviors.
 */

import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import yaml from 'js-yaml';

// Types
export interface ClaudeCommandParsed {
  name: string;
  slug: string;
  description: string;
  trigger: string;
  arguments: CommandArgument[];
  behavior: CommandBehavior;
  examples: CommandExample[];
  relatedCommands: string[];
  metadata: CommandMetadata;
  rawContent: string;
}

export interface CommandArgument {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'selection';
  required: boolean;
  description: string;
  default?: unknown;
  choices?: string[];
}

export interface CommandBehavior {
  template: string;
  systemPrompt: string | null;
  responseFormat: 'text' | 'markdown' | 'code' | 'json';
  requiresContext: boolean;
  contextTypes: ContextType[];
}

export type ContextType = 'file' | 'selection' | 'project' | 'git' | 'terminal';

export interface CommandExample {
  input: string;
  description: string;
  expectedBehavior: string;
}

export interface CommandMetadata {
  hasArguments: boolean;
  hasExamples: boolean;
  hasSystemPrompt: boolean;
  requiresContext: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface EGCEPrompt {
  name: string;
  slug: string;
  title: string;
  description: string;
  category: PromptCategory;
  trigger: PromptTrigger;
  template: PromptTemplate;
  arguments: PromptArgument[];
  examples: PromptExample[];
  context: PromptContext;
  output: PromptOutput;
  version: string;
  lastUpdated: string;
}

export type PromptCategory =
  | 'code-generation'
  | 'code-review'
  | 'refactoring'
  | 'documentation'
  | 'testing'
  | 'debugging'
  | 'explanation'
  | 'analysis'
  | 'custom';

export interface PromptTrigger {
  slash: string;
  keywords: string[];
  autoTrigger: boolean;
}

export interface PromptTemplate {
  system: string;
  user: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  source: 'argument' | 'context' | 'computed';
  default?: string;
}

export interface PromptArgument {
  name: string;
  label: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  validation?: ArgumentValidation;
}

export interface ArgumentValidation {
  pattern?: string;
  min?: number;
  max?: number;
  choices?: string[];
}

export interface PromptExample {
  name: string;
  input: Record<string, unknown>;
  description: string;
  output: string;
}

export interface PromptContext {
  required: ContextRequirement[];
  optional: ContextRequirement[];
}

export interface ContextRequirement {
  type: string;
  description: string;
}

export interface PromptOutput {
  format: string;
  schema?: Record<string, unknown>;
  postProcess?: string[];
}

export interface CommandConversionResult {
  prompts: EGCEPrompt[];
  warnings: ConversionWarning[];
  summary: ConversionSummary;
}

export interface ConversionWarning {
  command: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConversionSummary {
  totalParsed: number;
  totalConverted: number;
  byCategory: Record<string, number>;
  withArguments: number;
  withExamples: number;
}

/**
 * Claude Code Commands Parser
 *
 * Parses command definition files from Claude Code and converts them
 * to EGCE prompt format.
 */
export class CommandsParser {
  private warnings: ConversionWarning[] = [];

  /**
   * Parse a single command file
   */
  async parseCommandFile(filePath: string): Promise<ClaudeCommandParsed> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);

    return this.parseCommandContent(content, fileName, ext);
  }

  /**
   * Parse command content directly
   */
  parseCommandContent(content: string, name: string, fileType: string = '.md'): ClaudeCommandParsed {
    let parsed: Partial<ClaudeCommandParsed> = {};

    // Parse based on file type
    if (fileType === '.yaml' || fileType === '.yml') {
      parsed = this.parseYamlCommand(content, name);
    } else if (fileType === '.json') {
      parsed = this.parseJsonCommand(content, name);
    } else {
      parsed = this.parseMarkdownCommand(content, name);
    }

    // Ensure all required fields
    const command: ClaudeCommandParsed = {
      name: parsed.name || this.formatName(name),
      slug: parsed.slug || this.slugify(name),
      description: parsed.description || 'Command migrated from Claude Code',
      trigger: parsed.trigger || `/${this.slugify(name)}`,
      arguments: parsed.arguments || [],
      behavior: parsed.behavior || this.createDefaultBehavior(),
      examples: parsed.examples || [],
      relatedCommands: parsed.relatedCommands || [],
      metadata: {
        hasArguments: (parsed.arguments?.length || 0) > 0,
        hasExamples: (parsed.examples?.length || 0) > 0,
        hasSystemPrompt: Boolean(parsed.behavior?.systemPrompt),
        requiresContext: Boolean(parsed.behavior?.requiresContext),
        complexity: 'simple',
      },
      rawContent: content,
    };

    // Update complexity
    command.metadata.complexity = this.estimateComplexity(command);

    return command;
  }

  /**
   * Parse all commands from a directory
   */
  async parseCommandsDirectory(dirPath: string): Promise<ClaudeCommandParsed[]> {
    const commands: ClaudeCommandParsed[] = [];

    // Find all configuration files
    const patterns = ['**/*.yaml', '**/*.yml', '**/*.json', '**/*.md'];
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob.glob(pattern, { cwd: dirPath });
      allFiles.push(...files);
    }

    // Deduplicate and filter
    const uniqueFiles = [...new Set(allFiles)].filter(f => {
      const lower = f.toLowerCase();
      return !lower.includes('readme') && !lower.startsWith('_');
    });

    for (const file of uniqueFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const command = await this.parseCommandFile(filePath);
        commands.push(command);
      } catch (error) {
        this.warnings.push({
          command: file,
          message: `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    return commands;
  }

  /**
   * Convert parsed commands to EGCE format
   */
  convert(parsedCommands: ClaudeCommandParsed[]): CommandConversionResult {
    this.warnings = [];
    const prompts: EGCEPrompt[] = [];
    const byCategory: Record<string, number> = {};

    for (const parsed of parsedCommands) {
      try {
        const converted = this.convertCommand(parsed);
        prompts.push(converted);

        // Track by category
        byCategory[converted.category] = (byCategory[converted.category] || 0) + 1;
      } catch (error) {
        this.warnings.push({
          command: parsed.name,
          message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    const summary: ConversionSummary = {
      totalParsed: parsedCommands.length,
      totalConverted: prompts.length,
      byCategory,
      withArguments: parsedCommands.filter(c => c.arguments.length > 0).length,
      withExamples: parsedCommands.filter(c => c.examples.length > 0).length,
    };

    return {
      prompts,
      warnings: this.warnings,
      summary,
    };
  }

  /**
   * Parse and convert in one step
   */
  async parseAndConvert(dirPath: string): Promise<CommandConversionResult> {
    const parsed = await this.parseCommandsDirectory(dirPath);
    return this.convert(parsed);
  }

  // Private parsing methods

  private parseYamlCommand(content: string, name: string): Partial<ClaudeCommandParsed> {
    try {
      const data = yaml.load(content) as Record<string, unknown>;
      return this.parseStructuredCommand(data, name);
    } catch {
      return { name: this.formatName(name) };
    }
  }

  private parseJsonCommand(content: string, name: string): Partial<ClaudeCommandParsed> {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      return this.parseStructuredCommand(data, name);
    } catch {
      return { name: this.formatName(name) };
    }
  }

  private parseStructuredCommand(data: Record<string, unknown>, name: string): Partial<ClaudeCommandParsed> {
    const command: Partial<ClaudeCommandParsed> = {
      name: (data.name as string) || this.formatName(name),
      slug: (data.slug as string) || this.slugify(name),
      description: (data.description as string) || '',
      trigger: (data.trigger as string) || (data.command as string) || `/${this.slugify(name)}`,
    };

    // Extract arguments
    if (Array.isArray(data.arguments) || Array.isArray(data.params) || Array.isArray(data.parameters)) {
      const args = (data.arguments || data.params || data.parameters) as Array<Record<string, unknown>>;
      command.arguments = args.map(a => this.parseArgument(a));
    }

    // Extract behavior
    if (data.behavior || data.template || data.prompt) {
      const behaviorData = (data.behavior || { template: data.template || data.prompt }) as Record<string, unknown>;
      command.behavior = {
        template: (behaviorData.template as string) || (behaviorData.prompt as string) || '',
        systemPrompt: (behaviorData.system as string) || (behaviorData.systemPrompt as string) || null,
        responseFormat: this.parseResponseFormat(behaviorData.format as string),
        requiresContext: Boolean(behaviorData.requiresContext || behaviorData.context),
        contextTypes: this.parseContextTypes(behaviorData.contextTypes as string[] | undefined),
      };
    }

    // Extract examples
    if (Array.isArray(data.examples)) {
      command.examples = (data.examples as Array<Record<string, unknown>>).map(e => ({
        input: (e.input as string) || (e.command as string) || '',
        description: (e.description as string) || '',
        expectedBehavior: (e.output as string) || (e.expected as string) || (e.behavior as string) || '',
      }));
    }

    // Extract related commands
    if (Array.isArray(data.related) || Array.isArray(data.relatedCommands)) {
      command.relatedCommands = (data.related || data.relatedCommands) as string[];
    }

    return command;
  }

  private parseMarkdownCommand(content: string, name: string): Partial<ClaudeCommandParsed> {
    const command: Partial<ClaudeCommandParsed> = {
      name: this.formatName(name),
      slug: this.slugify(name),
    };

    // Try to extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        const frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;
        Object.assign(command, this.parseStructuredCommand(frontmatter, name));
      } catch {
        // Ignore frontmatter parsing errors
      }
    }

    // Parse sections
    const sections = this.parseSections(content);

    // Extract description
    if (!command.description) {
      command.description = this.extractDescription(sections);
    }

    // Extract trigger
    if (!command.trigger) {
      command.trigger = this.extractTrigger(sections, name);
    }

    // Extract arguments from "Arguments" or "Parameters" section
    if (!command.arguments || command.arguments.length === 0) {
      command.arguments = this.extractArgumentsFromSections(sections);
    }

    // Extract behavior/template from content
    if (!command.behavior) {
      command.behavior = this.extractBehavior(sections, content);
    }

    // Extract examples
    if (!command.examples || command.examples.length === 0) {
      command.examples = this.extractExamplesFromSections(sections);
    }

    return command;
  }

  private parseSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.replace(/^---[\s\S]*?---\n/, '').split('\n');
    let currentSection = 'header';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);

      if (headerMatch) {
        if (currentContent.length > 0) {
          sections.set(currentSection.toLowerCase(), currentContent.join('\n').trim());
        }
        currentSection = headerMatch[2];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.set(currentSection.toLowerCase(), currentContent.join('\n').trim());
    }

    return sections;
  }

  private extractDescription(sections: Map<string, string>): string {
    for (const [key, value] of sections) {
      if (key.includes('description') || key.includes('about') || key === 'header') {
        const firstPara = value.split('\n\n')[0];
        if (firstPara && !firstPara.startsWith('-') && firstPara.length > 10) {
          return firstPara.trim();
        }
      }
    }
    return '';
  }

  private extractTrigger(sections: Map<string, string>, name: string): string {
    for (const [key, value] of sections) {
      if (key.includes('trigger') || key.includes('command') || key.includes('usage')) {
        const triggerMatch = value.match(/`?\/?(\w[\w-]*)`?/);
        if (triggerMatch) {
          return `/${triggerMatch[1]}`;
        }
      }
    }
    return `/${this.slugify(name)}`;
  }

  private extractArgumentsFromSections(sections: Map<string, string>): CommandArgument[] {
    const args: CommandArgument[] = [];

    for (const [key, value] of sections) {
      if (key.includes('argument') || key.includes('parameter') || key.includes('option')) {
        const bulletRegex = /[-*]\s*`?(\w+)`?\s*(?:\((\w+)\))?\s*[-:]?\s*(.+)/g;
        let match;

        while ((match = bulletRegex.exec(value)) !== null) {
          args.push({
            name: match[1],
            type: this.normalizeArgType(match[2] || 'string'),
            required: match[3]?.toLowerCase().includes('required') || false,
            description: match[3]?.replace(/\(required\)/i, '').trim() || '',
          });
        }
      }
    }

    return args;
  }

  private extractBehavior(sections: Map<string, string>, content: string): CommandBehavior {
    let template = '';
    let systemPrompt: string | null = null;
    let responseFormat: 'text' | 'markdown' | 'code' | 'json' = 'markdown';
    let requiresContext = false;
    const contextTypes: ContextType[] = [];

    // Look for template/prompt section
    for (const [key, value] of sections) {
      if (key.includes('template') || key.includes('prompt') || key.includes('behavior')) {
        // Extract code blocks as template
        const codeBlockMatch = value.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          template = codeBlockMatch[1].trim();
        } else {
          template = value.trim();
        }
      }

      if (key.includes('system') || key.includes('context')) {
        const codeBlockMatch = value.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          systemPrompt = codeBlockMatch[1].trim();
        }
      }
    }

    // Detect context requirements
    const contentLower = content.toLowerCase();
    if (contentLower.includes('file') || contentLower.includes('{{file')) {
      requiresContext = true;
      contextTypes.push('file');
    }
    if (contentLower.includes('selection') || contentLower.includes('{{selection')) {
      requiresContext = true;
      contextTypes.push('selection');
    }
    if (contentLower.includes('project') || contentLower.includes('{{project')) {
      requiresContext = true;
      contextTypes.push('project');
    }

    // Detect response format
    if (contentLower.includes('json') || contentLower.includes('structured')) {
      responseFormat = 'json';
    } else if (contentLower.includes('code only') || contentLower.includes('just code')) {
      responseFormat = 'code';
    }

    return {
      template,
      systemPrompt,
      responseFormat,
      requiresContext,
      contextTypes,
    };
  }

  private extractExamplesFromSections(sections: Map<string, string>): CommandExample[] {
    const examples: CommandExample[] = [];

    for (const [key, value] of sections) {
      if (key.includes('example') || key.includes('usage')) {
        // Parse example blocks
        const blocks = value.split(/\n\n(?=[-*]|\d\.)/);

        for (const block of blocks) {
          if (block.trim().length < 10) continue;

          const inputMatch = block.match(/(?:input|command)[:\s]*`?([^`\n]+)`?/i);
          const descMatch = block.match(/(?:description|purpose)[:\s]*([^\n]+)/i);
          const outputMatch = block.match(/(?:output|result|behavior)[:\s]*([\s\S]*)/i);

          if (inputMatch || block.includes('/')) {
            examples.push({
              input: inputMatch?.[1] || block.split('\n')[0].trim(),
              description: descMatch?.[1] || 'Example usage',
              expectedBehavior: outputMatch?.[1]?.trim() || 'See documentation',
            });
          }
        }
      }
    }

    return examples.slice(0, 5);
  }

  private parseArgument(data: Record<string, unknown>): CommandArgument {
    return {
      name: (data.name as string) || 'arg',
      type: this.normalizeArgType((data.type as string) || 'string'),
      required: Boolean(data.required),
      description: (data.description as string) || '',
      default: data.default,
      choices: data.choices as string[] | undefined,
    };
  }

  private normalizeArgType(type: string): 'string' | 'number' | 'boolean' | 'file' | 'selection' {
    const typeMap: Record<string, 'string' | 'number' | 'boolean' | 'file' | 'selection'> = {
      'string': 'string',
      'text': 'string',
      'number': 'number',
      'int': 'number',
      'integer': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'file': 'file',
      'path': 'file',
      'selection': 'selection',
      'selected': 'selection',
    };

    return typeMap[type.toLowerCase()] || 'string';
  }

  private parseResponseFormat(format: string | undefined): 'text' | 'markdown' | 'code' | 'json' {
    if (!format) return 'markdown';

    const formatMap: Record<string, 'text' | 'markdown' | 'code' | 'json'> = {
      'text': 'text',
      'plain': 'text',
      'markdown': 'markdown',
      'md': 'markdown',
      'code': 'code',
      'json': 'json',
    };

    return formatMap[format.toLowerCase()] || 'markdown';
  }

  private parseContextTypes(types: string[] | undefined): ContextType[] {
    if (!types) return [];

    const validTypes: ContextType[] = ['file', 'selection', 'project', 'git', 'terminal'];
    return types.filter(t => validTypes.includes(t as ContextType)) as ContextType[];
  }

  private createDefaultBehavior(): CommandBehavior {
    return {
      template: '',
      systemPrompt: null,
      responseFormat: 'markdown',
      requiresContext: false,
      contextTypes: [],
    };
  }

  private estimateComplexity(command: ClaudeCommandParsed): 'simple' | 'moderate' | 'complex' {
    let score = 0;

    score += command.arguments.length * 2;
    score += command.behavior.contextTypes.length * 1.5;
    score += command.behavior.systemPrompt ? 3 : 0;
    score += command.behavior.template.length > 500 ? 2 : 0;
    score += command.examples.length;

    if (score < 5) return 'simple';
    if (score < 12) return 'moderate';
    return 'complex';
  }

  // Conversion methods

  private convertCommand(parsed: ClaudeCommandParsed): EGCEPrompt {
    const category = this.inferCategory(parsed);

    // Build template variables
    const variables: TemplateVariable[] = [];

    for (const arg of parsed.arguments) {
      variables.push({
        name: arg.name,
        source: 'argument',
        default: arg.default as string | undefined,
      });
    }

    for (const ctx of parsed.behavior.contextTypes) {
      variables.push({
        name: ctx,
        source: 'context',
      });
    }

    // Build context requirements
    const requiredContext: ContextRequirement[] = [];
    const optionalContext: ContextRequirement[] = [];

    for (const ctx of parsed.behavior.contextTypes) {
      requiredContext.push({
        type: ctx,
        description: `${ctx} context required`,
      });
    }

    // Convert arguments
    const promptArgs: PromptArgument[] = parsed.arguments.map(arg => ({
      name: arg.name,
      label: this.formatName(arg.name),
      type: arg.type,
      required: arg.required,
      description: arg.description,
      default: arg.default,
      validation: arg.choices ? { choices: arg.choices } : undefined,
    }));

    // Convert examples
    const promptExamples: PromptExample[] = parsed.examples.map((ex, i) => ({
      name: `Example ${i + 1}`,
      input: { command: ex.input },
      description: ex.description,
      output: ex.expectedBehavior,
    }));

    return {
      name: parsed.name,
      slug: parsed.slug,
      title: parsed.name,
      description: parsed.description,
      category,
      trigger: {
        slash: parsed.trigger,
        keywords: this.extractKeywords(parsed),
        autoTrigger: false,
      },
      template: {
        system: parsed.behavior.systemPrompt || this.generateDefaultSystemPrompt(category),
        user: parsed.behavior.template || this.generateDefaultUserTemplate(parsed),
        variables,
      },
      arguments: promptArgs,
      examples: promptExamples,
      context: {
        required: requiredContext,
        optional: optionalContext,
      },
      output: {
        format: parsed.behavior.responseFormat,
      },
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
    };
  }

  private inferCategory(command: ClaudeCommandParsed): PromptCategory {
    const combined = (command.name + ' ' + command.description + ' ' + command.trigger).toLowerCase();

    if (combined.includes('generate') || combined.includes('create') || combined.includes('new')) {
      return 'code-generation';
    }
    if (combined.includes('review') || combined.includes('check') || combined.includes('audit')) {
      return 'code-review';
    }
    if (combined.includes('refactor') || combined.includes('improve') || combined.includes('clean')) {
      return 'refactoring';
    }
    if (combined.includes('doc') || combined.includes('comment') || combined.includes('readme')) {
      return 'documentation';
    }
    if (combined.includes('test') || combined.includes('spec') || combined.includes('assert')) {
      return 'testing';
    }
    if (combined.includes('debug') || combined.includes('fix') || combined.includes('error')) {
      return 'debugging';
    }
    if (combined.includes('explain') || combined.includes('describe') || combined.includes('what')) {
      return 'explanation';
    }
    if (combined.includes('analyz') || combined.includes('inspect') || combined.includes('scan')) {
      return 'analysis';
    }

    return 'custom';
  }

  private extractKeywords(command: ClaudeCommandParsed): string[] {
    const keywords: string[] = [];

    // From trigger
    const triggerWords = command.trigger.replace(/^\//, '').split(/[-_]/);
    keywords.push(...triggerWords);

    // From name
    const nameWords = command.name.toLowerCase().split(/\s+/);
    keywords.push(...nameWords);

    // Common action keywords
    const actionKeywords = ['create', 'generate', 'review', 'refactor', 'test', 'fix', 'explain', 'document'];
    const combined = (command.name + ' ' + command.description).toLowerCase();

    for (const keyword of actionKeywords) {
      if (combined.includes(keyword) && !keywords.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return [...new Set(keywords)].slice(0, 10);
  }

  private generateDefaultSystemPrompt(category: PromptCategory): string {
    const prompts: Record<PromptCategory, string> = {
      'code-generation': 'You are an expert code generator. Generate clean, well-documented, and efficient code following best practices.',
      'code-review': 'You are an expert code reviewer. Analyze code for bugs, security issues, performance problems, and suggest improvements.',
      'refactoring': 'You are an expert at code refactoring. Improve code structure while maintaining functionality.',
      'documentation': 'You are an expert technical writer. Generate clear, comprehensive documentation.',
      'testing': 'You are an expert at writing tests. Create comprehensive test cases with good coverage.',
      'debugging': 'You are an expert debugger. Identify and fix issues systematically.',
      'explanation': 'You are an expert at explaining code. Provide clear, educational explanations.',
      'analysis': 'You are an expert code analyst. Provide thorough analysis and insights.',
      'custom': 'You are a helpful AI assistant. Follow the user instructions carefully.',
    };

    return prompts[category];
  }

  private generateDefaultUserTemplate(command: ClaudeCommandParsed): string {
    const parts: string[] = [];

    parts.push(`Execute the ${command.name} command.`);

    if (command.arguments.length > 0) {
      parts.push('\nArguments:');
      for (const arg of command.arguments) {
        parts.push(`- ${arg.name}: {{${arg.name}}}`);
      }
    }

    if (command.behavior.contextTypes.length > 0) {
      parts.push('\nContext:');
      for (const ctx of command.behavior.contextTypes) {
        parts.push(`- ${ctx}: {{${ctx}}}`);
      }
    }

    return parts.join('\n');
  }

  private formatName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

// Export singleton instance
export const commandsParser = new CommandsParser();
