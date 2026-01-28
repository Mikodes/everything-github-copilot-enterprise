/**
 * Claude Code Skills Parser
 *
 * Parses Claude Code skill definitions and converts them to EGCE configs.
 * Skills in Claude Code define specific capabilities like file operations,
 * code analysis, testing, etc.
 */

import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import yaml from 'js-yaml';

// Types
export interface ClaudeSkillParsed {
  name: string;
  slug: string;
  description: string;
  type: SkillType;
  config: SkillConfig;
  parameters: SkillParameter[];
  examples: SkillExample[];
  dependencies: string[];
  metadata: SkillMetadata;
  rawContent: string;
}

export type SkillType =
  | 'file-operation'
  | 'code-analysis'
  | 'testing'
  | 'documentation'
  | 'git-operation'
  | 'build-tool'
  | 'api-integration'
  | 'custom';

export interface SkillConfig {
  enabled: boolean;
  autoTrigger: boolean;
  priority: number;
  scope: SkillScope;
  settings: Record<string, unknown>;
}

export interface SkillScope {
  filePatterns: string[];
  languages: string[];
  directories: string[];
  excludePatterns: string[];
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  description: string;
}

export interface SkillExample {
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput: string;
}

export interface SkillMetadata {
  hasParameters: boolean;
  hasExamples: boolean;
  hasDependencies: boolean;
  isYamlConfig: boolean;
  isJsonConfig: boolean;
  isMarkdownConfig: boolean;
}

export interface EGCEConfig {
  name: string;
  slug: string;
  description: string;
  type: string;
  version: string;
  enabled: boolean;
  settings: ConfigSettings;
  scope: ConfigScope;
  rules: ConfigRule[];
  integrations: ConfigIntegration[];
}

export interface ConfigSettings {
  autoActivate: boolean;
  priority: number;
  parameters: Record<string, unknown>;
  customSettings: Record<string, unknown>;
}

export interface ConfigScope {
  include: ScopePattern[];
  exclude: ScopePattern[];
}

export interface ScopePattern {
  type: 'glob' | 'regex' | 'language' | 'directory';
  pattern: string;
}

export interface ConfigRule {
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
}

export interface ConfigIntegration {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface SkillConversionResult {
  configs: EGCEConfig[];
  warnings: ConversionWarning[];
  summary: ConversionSummary;
}

export interface ConversionWarning {
  skill: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConversionSummary {
  totalParsed: number;
  totalConverted: number;
  byType: Record<string, number>;
  withDependencies: number;
}

/**
 * Claude Code Skills Parser
 *
 * Parses skill configuration files from Claude Code and converts them
 * to EGCE config format.
 */
export class SkillsParser {
  private warnings: ConversionWarning[] = [];

  /**
   * Parse a single skill file
   */
  async parseSkillFile(filePath: string): Promise<ClaudeSkillParsed> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);

    return this.parseSkillContent(content, fileName, ext);
  }

  /**
   * Parse skill content directly
   */
  parseSkillContent(content: string, name: string, fileType: string = '.md'): ClaudeSkillParsed {
    let parsed: Partial<ClaudeSkillParsed> = {};

    // Parse based on file type
    if (fileType === '.yaml' || fileType === '.yml') {
      parsed = this.parseYamlSkill(content, name);
    } else if (fileType === '.json') {
      parsed = this.parseJsonSkill(content, name);
    } else {
      parsed = this.parseMarkdownSkill(content, name);
    }

    // Ensure all required fields
    const skill: ClaudeSkillParsed = {
      name: parsed.name || this.formatName(name),
      slug: parsed.slug || this.slugify(name),
      description: parsed.description || 'Skill migrated from Claude Code',
      type: parsed.type || this.inferSkillType(content, name),
      config: parsed.config || this.createDefaultConfig(),
      parameters: parsed.parameters || [],
      examples: parsed.examples || [],
      dependencies: parsed.dependencies || [],
      metadata: {
        hasParameters: (parsed.parameters?.length || 0) > 0,
        hasExamples: (parsed.examples?.length || 0) > 0,
        hasDependencies: (parsed.dependencies?.length || 0) > 0,
        isYamlConfig: fileType === '.yaml' || fileType === '.yml',
        isJsonConfig: fileType === '.json',
        isMarkdownConfig: fileType === '.md',
      },
      rawContent: content,
    };

    return skill;
  }

  /**
   * Parse all skills from a directory
   */
  async parseSkillsDirectory(dirPath: string): Promise<ClaudeSkillParsed[]> {
    const skills: ClaudeSkillParsed[] = [];

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
      return !lower.includes('readme') && !lower.startsWith('_') && !lower.includes('test');
    });

    for (const file of uniqueFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const skill = await this.parseSkillFile(filePath);
        skills.push(skill);
      } catch (error) {
        this.warnings.push({
          skill: file,
          message: `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    return skills;
  }

  /**
   * Convert parsed skills to EGCE format
   */
  convert(parsedSkills: ClaudeSkillParsed[]): SkillConversionResult {
    this.warnings = [];
    const configs: EGCEConfig[] = [];
    const byType: Record<string, number> = {};

    for (const parsed of parsedSkills) {
      try {
        const converted = this.convertSkill(parsed);
        configs.push(converted);

        // Track by type
        byType[parsed.type] = (byType[parsed.type] || 0) + 1;
      } catch (error) {
        this.warnings.push({
          skill: parsed.name,
          message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    const summary: ConversionSummary = {
      totalParsed: parsedSkills.length,
      totalConverted: configs.length,
      byType,
      withDependencies: parsedSkills.filter(s => s.dependencies.length > 0).length,
    };

    return {
      configs,
      warnings: this.warnings,
      summary,
    };
  }

  /**
   * Parse and convert in one step
   */
  async parseAndConvert(dirPath: string): Promise<SkillConversionResult> {
    const parsed = await this.parseSkillsDirectory(dirPath);
    return this.convert(parsed);
  }

  // Private parsing methods

  private parseYamlSkill(content: string, name: string): Partial<ClaudeSkillParsed> {
    try {
      const data = yaml.load(content) as Record<string, unknown>;
      return this.parseStructuredSkill(data, name);
    } catch {
      return { name: this.formatName(name) };
    }
  }

  private parseJsonSkill(content: string, name: string): Partial<ClaudeSkillParsed> {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      return this.parseStructuredSkill(data, name);
    } catch {
      return { name: this.formatName(name) };
    }
  }

  private parseStructuredSkill(data: Record<string, unknown>, name: string): Partial<ClaudeSkillParsed> {
    const skill: Partial<ClaudeSkillParsed> = {
      name: (data.name as string) || this.formatName(name),
      slug: (data.slug as string) || this.slugify(name),
      description: (data.description as string) || '',
    };

    // Extract type
    if (data.type) {
      skill.type = this.normalizeSkillType(data.type as string);
    }

    // Extract config
    if (data.config || data.settings) {
      const configData = (data.config || data.settings) as Record<string, unknown>;
      skill.config = {
        enabled: configData.enabled !== false,
        autoTrigger: Boolean(configData.autoTrigger || configData.auto),
        priority: (configData.priority as number) || 5,
        scope: this.parseScope(configData.scope as Record<string, unknown>),
        settings: configData,
      };
    }

    // Extract parameters
    if (Array.isArray(data.parameters) || Array.isArray(data.params)) {
      const params = (data.parameters || data.params) as Array<Record<string, unknown>>;
      skill.parameters = params.map(p => ({
        name: (p.name as string) || 'param',
        type: this.normalizeParamType((p.type as string) || 'string'),
        required: Boolean(p.required),
        default: p.default,
        description: (p.description as string) || '',
      }));
    }

    // Extract dependencies
    if (Array.isArray(data.dependencies) || Array.isArray(data.requires)) {
      skill.dependencies = (data.dependencies || data.requires) as string[];
    }

    // Extract examples
    if (Array.isArray(data.examples)) {
      skill.examples = (data.examples as Array<Record<string, unknown>>).map(e => ({
        name: (e.name as string) || 'Example',
        description: (e.description as string) || '',
        input: (e.input as Record<string, unknown>) || {},
        expectedOutput: (e.output as string) || (e.expectedOutput as string) || '',
      }));
    }

    return skill;
  }

  private parseMarkdownSkill(content: string, name: string): Partial<ClaudeSkillParsed> {
    const skill: Partial<ClaudeSkillParsed> = {
      name: this.formatName(name),
      slug: this.slugify(name),
    };

    // Try to extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        const frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;
        Object.assign(skill, this.parseStructuredSkill(frontmatter, name));
      } catch {
        // Ignore frontmatter parsing errors
      }
    }

    // Extract description from first paragraph
    const lines = content.replace(/^---[\s\S]*?---\n/, '').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('```')) {
        skill.description = trimmed;
        break;
      }
    }

    // Extract parameters from "Parameters" section
    skill.parameters = this.extractParametersFromMarkdown(content);

    // Extract dependencies from content
    skill.dependencies = this.extractDependenciesFromMarkdown(content);

    return skill;
  }

  private extractParametersFromMarkdown(content: string): SkillParameter[] {
    const params: SkillParameter[] = [];

    // Find parameters section
    const paramSectionMatch = content.match(/#{1,3}\s*Parameters?\s*\n([\s\S]*?)(?=\n#{1,3}|\n$)/i);
    if (paramSectionMatch) {
      const paramContent = paramSectionMatch[1];

      // Extract from bullet points
      const bulletRegex = /[-*]\s*`?(\w+)`?\s*(?:\((\w+)\))?\s*[-:]?\s*(.+)/g;
      let match;

      while ((match = bulletRegex.exec(paramContent)) !== null) {
        params.push({
          name: match[1],
          type: this.normalizeParamType(match[2] || 'string'),
          required: match[3]?.toLowerCase().includes('required') || false,
          description: match[3]?.replace(/\(required\)/i, '').trim() || '',
        });
      }
    }

    return params;
  }

  private extractDependenciesFromMarkdown(content: string): string[] {
    const deps: string[] = [];

    // Find dependencies/requires section
    const depSectionMatch = content.match(/#{1,3}\s*(?:Dependencies|Requires|Prerequisites)\s*\n([\s\S]*?)(?=\n#{1,3}|\n$)/i);
    if (depSectionMatch) {
      const depContent = depSectionMatch[1];

      // Extract from bullet points
      const bulletRegex = /[-*]\s*(.+)/g;
      let match;

      while ((match = bulletRegex.exec(depContent)) !== null) {
        deps.push(match[1].trim());
      }
    }

    return deps;
  }

  private parseScope(scopeData: Record<string, unknown> | undefined): SkillScope {
    if (!scopeData) {
      return {
        filePatterns: ['**/*'],
        languages: [],
        directories: [],
        excludePatterns: ['node_modules/**', '**/dist/**', '**/.git/**'],
      };
    }

    return {
      filePatterns: (scopeData.files as string[]) || (scopeData.filePatterns as string[]) || ['**/*'],
      languages: (scopeData.languages as string[]) || [],
      directories: (scopeData.directories as string[]) || (scopeData.dirs as string[]) || [],
      excludePatterns: (scopeData.exclude as string[]) || (scopeData.excludePatterns as string[]) || [],
    };
  }

  private inferSkillType(content: string, name: string): SkillType {
    const combined = (content + ' ' + name).toLowerCase();

    if (combined.includes('file') || combined.includes('read') || combined.includes('write')) {
      return 'file-operation';
    }
    if (combined.includes('analyz') || combined.includes('lint') || combined.includes('check')) {
      return 'code-analysis';
    }
    if (combined.includes('test') || combined.includes('spec') || combined.includes('jest') || combined.includes('vitest')) {
      return 'testing';
    }
    if (combined.includes('doc') || combined.includes('readme') || combined.includes('comment')) {
      return 'documentation';
    }
    if (combined.includes('git') || combined.includes('commit') || combined.includes('branch')) {
      return 'git-operation';
    }
    if (combined.includes('build') || combined.includes('compile') || combined.includes('bundle')) {
      return 'build-tool';
    }
    if (combined.includes('api') || combined.includes('http') || combined.includes('fetch')) {
      return 'api-integration';
    }

    return 'custom';
  }

  private normalizeSkillType(type: string): SkillType {
    const typeMap: Record<string, SkillType> = {
      'file': 'file-operation',
      'file-operation': 'file-operation',
      'files': 'file-operation',
      'analysis': 'code-analysis',
      'code-analysis': 'code-analysis',
      'lint': 'code-analysis',
      'test': 'testing',
      'testing': 'testing',
      'doc': 'documentation',
      'documentation': 'documentation',
      'docs': 'documentation',
      'git': 'git-operation',
      'git-operation': 'git-operation',
      'build': 'build-tool',
      'build-tool': 'build-tool',
      'api': 'api-integration',
      'api-integration': 'api-integration',
    };

    return typeMap[type.toLowerCase()] || 'custom';
  }

  private normalizeParamType(type: string): 'string' | 'number' | 'boolean' | 'array' | 'object' {
    const typeMap: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'> = {
      'string': 'string',
      'str': 'string',
      'text': 'string',
      'number': 'number',
      'num': 'number',
      'int': 'number',
      'integer': 'number',
      'float': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'array': 'array',
      'list': 'array',
      'object': 'object',
      'obj': 'object',
      'map': 'object',
    };

    return typeMap[type.toLowerCase()] || 'string';
  }

  private createDefaultConfig(): SkillConfig {
    return {
      enabled: true,
      autoTrigger: false,
      priority: 5,
      scope: {
        filePatterns: ['**/*'],
        languages: [],
        directories: [],
        excludePatterns: ['node_modules/**', '**/dist/**'],
      },
      settings: {},
    };
  }

  // Conversion methods

  private convertSkill(parsed: ClaudeSkillParsed): EGCEConfig {
    const includePatterns: ScopePattern[] = [];
    const excludePatterns: ScopePattern[] = [];

    // Convert file patterns
    for (const pattern of parsed.config.scope.filePatterns) {
      includePatterns.push({ type: 'glob', pattern });
    }

    // Convert languages
    for (const lang of parsed.config.scope.languages) {
      includePatterns.push({ type: 'language', pattern: lang });
    }

    // Convert directories
    for (const dir of parsed.config.scope.directories) {
      includePatterns.push({ type: 'directory', pattern: dir });
    }

    // Convert exclude patterns
    for (const pattern of parsed.config.scope.excludePatterns) {
      excludePatterns.push({ type: 'glob', pattern });
    }

    // Generate rules from examples
    const rules: ConfigRule[] = parsed.examples.map((example, index) => ({
      name: example.name || `Rule ${index + 1}`,
      condition: example.description || 'Always apply',
      action: example.expectedOutput || 'Execute skill',
      enabled: true,
    }));

    // Generate integrations from dependencies
    const integrations: ConfigIntegration[] = parsed.dependencies.map(dep => ({
      name: dep,
      type: this.inferIntegrationType(dep),
      config: {},
    }));

    // Convert parameters to settings
    const parameters: Record<string, unknown> = {};
    for (const param of parsed.parameters) {
      parameters[param.name] = param.default !== undefined ? param.default : this.getDefaultForType(param.type);
    }

    return {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      type: parsed.type,
      version: '1.0.0',
      enabled: parsed.config.enabled,
      settings: {
        autoActivate: parsed.config.autoTrigger,
        priority: parsed.config.priority,
        parameters,
        customSettings: parsed.config.settings,
      },
      scope: {
        include: includePatterns,
        exclude: excludePatterns,
      },
      rules,
      integrations,
    };
  }

  private inferIntegrationType(dependency: string): string {
    const depLower = dependency.toLowerCase();

    if (depLower.includes('eslint') || depLower.includes('prettier')) {
      return 'linter';
    }
    if (depLower.includes('jest') || depLower.includes('vitest') || depLower.includes('mocha')) {
      return 'test-framework';
    }
    if (depLower.includes('webpack') || depLower.includes('vite') || depLower.includes('rollup')) {
      return 'bundler';
    }
    if (depLower.includes('git')) {
      return 'vcs';
    }
    if (depLower.includes('npm') || depLower.includes('yarn') || depLower.includes('pnpm')) {
      return 'package-manager';
    }

    return 'external';
  }

  private getDefaultForType(type: string): unknown {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      default: return null;
    }
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
export const skillsParser = new SkillsParser();
