import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getMemoryBankApiClient } from '../services/MemoryBankApiClient';

/**
 * Code template definition
 */
export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  category: TemplateCategory;
  tags: string[];
  template: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
}

/**
 * Template category
 */
export type TemplateCategory =
  | 'service'
  | 'controller'
  | 'repository'
  | 'model'
  | 'dto'
  | 'test'
  | 'config'
  | 'api'
  | 'component'
  | 'utility'
  | 'general';

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array' | 'enum';
  default?: string;
  required: boolean;
  validation?: VariableValidation;
  enumValues?: string[];
}

/**
 * Variable validation rules
 */
export interface VariableValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  relatedPatterns: string[];
  stack?: string;
}

/**
 * Template rendering result
 */
export interface RenderResult {
  success: boolean;
  content: string;
  warnings: string[];
  errors: string[];
  usedVariables: Record<string, string>;
}

/**
 * Template search options
 */
export interface TemplateSearchOptions {
  category?: TemplateCategory;
  language?: string;
  tags?: string[];
  stack?: string;
  query?: string;
  limit?: number;
}

/**
 * Template Provider Service
 * Provides templates from Memory Bank for code generation
 *
 * Implements AC-014.3: Uses Memory Bank templates for code generation
 */
export class TemplateProvider {
  private static instance: TemplateProvider | null = null;
  private templates: Map<string, CodeTemplate> = new Map();
  private workspaceRoot: string | undefined;
  private templatesLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  static getInstance(): TemplateProvider {
    if (!TemplateProvider.instance) {
      TemplateProvider.instance = new TemplateProvider();
    }
    return TemplateProvider.instance;
  }

  /**
   * Initialize the provider by loading templates
   */
  async initialize(): Promise<void> {
    if (this.templatesLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.loadTemplates();
    await this.loadingPromise;
    this.templatesLoaded = true;
    this.loadingPromise = null;
  }

  /**
   * Get all available templates
   */
  async getAllTemplates(): Promise<CodeTemplate[]> {
    await this.initialize();
    return Array.from(this.templates.values());
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<CodeTemplate | null> {
    await this.initialize();
    return this.templates.get(id) || null;
  }

  /**
   * Search templates based on criteria
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<CodeTemplate[]> {
    await this.initialize();

    let results = Array.from(this.templates.values());

    // Filter by category
    if (options.category) {
      results = results.filter((t) => t.category === options.category);
    }

    // Filter by language
    if (options.language) {
      results = results.filter((t) => t.language === options.language);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((t) =>
        options.tags!.some((tag) => t.tags.includes(tag))
      );
    }

    // Filter by stack
    if (options.stack) {
      results = results.filter((t) => t.metadata.stack === options.stack);
    }

    // Filter by query (fuzzy search)
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(queryLower) ||
          t.description.toLowerCase().includes(queryLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(queryLower))
      );
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    // Sort by relevance (usage count) and alphabetically
    results.sort((a, b) => {
      if (a.metadata.usageCount !== b.metadata.usageCount) {
        return b.metadata.usageCount - a.metadata.usageCount;
      }
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  /**
   * Get templates for a specific intent/task
   */
  async getTemplatesForIntent(intent: string): Promise<CodeTemplate[]> {
    await this.initialize();

    const intentLower = intent.toLowerCase();
    const scored: Array<{ template: CodeTemplate; score: number }> = [];

    for (const template of this.templates.values()) {
      let score = 0;

      // Check name match
      if (template.name.toLowerCase().includes(intentLower)) {
        score += 3;
      }

      // Check description match
      if (template.description.toLowerCase().includes(intentLower)) {
        score += 2;
      }

      // Check tag match
      for (const tag of template.tags) {
        if (intentLower.includes(tag.toLowerCase())) {
          score += 1;
        }
      }

      // Check category match
      if (intentLower.includes(template.category)) {
        score += 2;
      }

      // Intent-specific scoring
      if (intentLower.includes('create') || intentLower.includes('new')) {
        score += 1;
      }
      if (intentLower.includes('service') && template.category === 'service') {
        score += 3;
      }
      if (intentLower.includes('api') && template.category === 'api') {
        score += 3;
      }
      if (intentLower.includes('test') && template.category === 'test') {
        score += 3;
      }

      if (score > 0) {
        scored.push({ template, score });
      }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 5).map((s) => s.template);
  }

  /**
   * Render a template with variables
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, string | boolean | number | string[]>
  ): Promise<RenderResult> {
    const template = await this.getTemplate(templateId);

    if (!template) {
      return {
        success: false,
        content: '',
        warnings: [],
        errors: [`Template not found: ${templateId}`],
        usedVariables: {},
      };
    }

    return this.render(template, variables);
  }

  /**
   * Render template content with variables
   */
  render(
    template: CodeTemplate,
    variables: Record<string, string | boolean | number | string[]>
  ): RenderResult {
    const result: RenderResult = {
      success: true,
      content: template.template,
      warnings: [],
      errors: [],
      usedVariables: {},
    };

    // Validate required variables
    for (const varDef of template.variables) {
      if (varDef.required && !(varDef.name in variables)) {
        if (varDef.default !== undefined) {
          variables[varDef.name] = varDef.default;
          result.warnings.push(
            `Using default value for '${varDef.name}': ${varDef.default}`
          );
        } else {
          result.errors.push(`Missing required variable: ${varDef.name}`);
          result.success = false;
        }
      }
    }

    if (!result.success) {
      return result;
    }

    // Validate variable types and values
    for (const [name, value] of Object.entries(variables)) {
      const varDef = template.variables.find((v) => v.name === name);
      if (!varDef) {
        result.warnings.push(`Unknown variable: ${name}`);
        continue;
      }

      const validationResult = this.validateVariable(value, varDef);
      if (!validationResult.valid) {
        result.errors.push(`Invalid value for '${name}': ${validationResult.message}`);
        result.success = false;
      }
    }

    if (!result.success) {
      return result;
    }

    // Perform variable substitution
    let content = template.template;

    for (const [name, value] of Object.entries(variables)) {
      const stringValue = this.valueToString(value);
      result.usedVariables[name] = stringValue;

      // Replace ${name} patterns
      const pattern = new RegExp(`\\$\\{${name}\\}`, 'g');
      content = content.replace(pattern, stringValue);

      // Replace {{name}} patterns (alternative syntax)
      const altPattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
      content = content.replace(altPattern, stringValue);
    }

    // Check for unresolved variables
    const unresolvedMatches = content.match(/\$\{(\w+)\}|\{\{(\w+)\}\}/g);
    if (unresolvedMatches) {
      const unique = [...new Set(unresolvedMatches)];
      for (const match of unique) {
        const varName = match.replace(/[\$\{\}]/g, '');
        result.warnings.push(`Unresolved variable: ${varName}`);
      }
    }

    // Apply transformations
    content = this.applyTransformations(content, variables);

    result.content = content;

    // Increment usage count
    template.metadata.usageCount++;

    return result;
  }

  /**
   * Get template suggestions based on context
   */
  async getSuggestionsForContext(
    fileUri: vscode.Uri,
    position: vscode.Position
  ): Promise<TemplateSuggestion[]> {
    await this.initialize();

    const document = await vscode.workspace.openTextDocument(fileUri);
    const language = document.languageId;
    const lineText = document.lineAt(position.line).text;
    const textBefore = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );

    const suggestions: TemplateSuggestion[] = [];

    // Detect context from code
    const context = this.detectCodeContext(textBefore, lineText, language);

    // Get relevant templates
    const templates = await this.searchTemplates({
      language: this.mapLanguageId(language),
      category: context.suggestedCategory,
      limit: 5,
    });

    for (const template of templates) {
      suggestions.push({
        template,
        relevance: this.calculateContextRelevance(template, context),
        reason: context.reason,
        prefillVariables: context.detectedVariables,
      });
    }

    // Sort by relevance
    suggestions.sort((a, b) => b.relevance - a.relevance);

    return suggestions.slice(0, 3);
  }

  /**
   * Create a new template
   */
  async createTemplate(
    template: Omit<CodeTemplate, 'id' | 'metadata'>
  ): Promise<CodeTemplate> {
    const id = this.generateTemplateId(template.name);
    const now = new Date();

    const newTemplate: CodeTemplate = {
      ...template,
      id,
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: [],
      },
    };

    this.templates.set(id, newTemplate);

    // Save to Memory Bank if workspace exists
    if (this.workspaceRoot) {
      await this.saveTemplate(newTemplate);
    }

    return newTemplate;
  }

  /**
   * Load templates from Memory Bank
   */
  private async loadTemplates(): Promise<void> {
    // Load built-in templates first
    this.loadBuiltInTemplates();

    if (!this.workspaceRoot) return;

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const templatesPath = path.join(this.workspaceRoot, memoryBankPath, 'templates');

    try {
      const files = await fs.readdir(templatesPath);

      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.template') || file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(templatesPath, file), 'utf-8');
            const template = this.parseTemplateFile(file, content);
            if (template) {
              this.templates.set(template.id, template);
            }
          } catch (error) {
            console.warn(`Failed to load template: ${file}`, error);
          }
        }
      }
    } catch {
      // Templates directory doesn't exist
    }

    // Load stack-specific templates
    await this.loadStackTemplates();

    console.log(`TemplateProvider loaded ${this.templates.size} templates`);
  }

  /**
   * Load stack-specific templates
   */
  private async loadStackTemplates(): Promise<void> {
    if (!this.workspaceRoot) return;

    const defaultStack = vscode.workspace
      .getConfiguration('egce')
      .get<string>('defaultStack', 'generic');

    const stackTemplatesPath = path.join(
      this.workspaceRoot,
      'stacks',
      defaultStack,
      'templates'
    );

    try {
      const files = await fs.readdir(stackTemplatesPath);

      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.template') || file.endsWith('.json')) {
          try {
            const content = await fs.readFile(
              path.join(stackTemplatesPath, file),
              'utf-8'
            );
            const template = this.parseTemplateFile(file, content);
            if (template) {
              template.metadata.stack = defaultStack;
              this.templates.set(template.id, template);
            }
          } catch (error) {
            console.warn(`Failed to load stack template: ${file}`, error);
          }
        }
      }
    } catch {
      // Stack templates directory doesn't exist
    }
  }

  /**
   * Load built-in templates
   */
  private loadBuiltInTemplates(): void {
    const now = new Date();

    // TypeScript/JavaScript Templates
    this.templates.set('ts-service', {
      id: 'ts-service',
      name: 'TypeScript Service Class',
      description: 'A service class with dependency injection support',
      language: 'typescript',
      category: 'service',
      tags: ['service', 'class', 'di', 'typescript'],
      template: `import { Injectable } from '@nestjs/common';
\${imports}

/**
 * \${serviceName} - \${description}
 */
@Injectable()
export class \${serviceName}Service {
  constructor(
    \${dependencies}
  ) {}

  /**
   * \${methodDescription}
   */
  async \${methodName}(\${parameters}): Promise<\${returnType}> {
    // Implementation
    \${implementation}
  }
}
`,
      variables: [
        { name: 'serviceName', description: 'Name of the service (PascalCase)', type: 'string', required: true },
        { name: 'description', description: 'Service description', type: 'string', required: true },
        { name: 'imports', description: 'Additional imports', type: 'string', required: false, default: '' },
        { name: 'dependencies', description: 'Constructor dependencies', type: 'string', required: false, default: '' },
        { name: 'methodName', description: 'Main method name', type: 'string', required: true },
        { name: 'methodDescription', description: 'Method description', type: 'string', required: false, default: 'Performs the main operation' },
        { name: 'parameters', description: 'Method parameters', type: 'string', required: false, default: '' },
        { name: 'returnType', description: 'Return type', type: 'string', required: true },
        { name: 'implementation', description: 'Method implementation', type: 'string', required: false, default: 'throw new Error("Not implemented");' },
      ],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: ['dependency-injection', 'single-responsibility'],
      },
    });

    this.templates.set('ts-controller', {
      id: 'ts-controller',
      name: 'TypeScript REST Controller',
      description: 'A REST API controller with common endpoints',
      language: 'typescript',
      category: 'controller',
      tags: ['controller', 'rest', 'api', 'typescript'],
      template: `import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { \${serviceName}Service } from './\${serviceFileName}.service';
import { Create\${entityName}Dto, Update\${entityName}Dto } from './dto';

/**
 * \${controllerDescription}
 */
@Controller('\${basePath}')
export class \${controllerName}Controller {
  constructor(private readonly \${serviceVariable}: \${serviceName}Service) {}

  @Get()
  async findAll() {
    return this.\${serviceVariable}.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.\${serviceVariable}.findOne(id);
  }

  @Post()
  async create(@Body() dto: Create\${entityName}Dto) {
    return this.\${serviceVariable}.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Update\${entityName}Dto) {
    return this.\${serviceVariable}.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.\${serviceVariable}.remove(id);
  }
}
`,
      variables: [
        { name: 'controllerName', description: 'Controller name (PascalCase)', type: 'string', required: true },
        { name: 'controllerDescription', description: 'Controller description', type: 'string', required: false, default: 'REST API controller' },
        { name: 'basePath', description: 'API base path', type: 'string', required: true },
        { name: 'serviceName', description: 'Service class name', type: 'string', required: true },
        { name: 'serviceFileName', description: 'Service file name', type: 'string', required: true },
        { name: 'serviceVariable', description: 'Service variable name', type: 'string', required: true },
        { name: 'entityName', description: 'Entity name for DTOs', type: 'string', required: true },
      ],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: ['layered-architecture', 'rest-api'],
      },
    });

    this.templates.set('ts-test', {
      id: 'ts-test',
      name: 'TypeScript Unit Test',
      description: 'Unit test file with Jest',
      language: 'typescript',
      category: 'test',
      tags: ['test', 'unit', 'jest', 'typescript'],
      template: `import { Test, TestingModule } from '@nestjs/testing';
import { \${className} } from './\${fileName}';

describe('\${className}', () => {
  let \${instanceName}: \${className};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [\${className}],
    }).compile();

    \${instanceName} = module.get<\${className}>(\${className});
  });

  it('should be defined', () => {
    expect(\${instanceName}).toBeDefined();
  });

  describe('\${methodName}', () => {
    it('should \${testDescription}', async () => {
      // Arrange
      \${arrangeCode}

      // Act
      const result = await \${instanceName}.\${methodName}(\${testParams});

      // Assert
      expect(result).\${assertion};
    });
  });
});
`,
      variables: [
        { name: 'className', description: 'Class name to test', type: 'string', required: true },
        { name: 'fileName', description: 'File name without extension', type: 'string', required: true },
        { name: 'instanceName', description: 'Instance variable name', type: 'string', required: true },
        { name: 'methodName', description: 'Method to test', type: 'string', required: true },
        { name: 'testDescription', description: 'Test description', type: 'string', required: true },
        { name: 'arrangeCode', description: 'Setup code', type: 'string', required: false, default: 'const input = {};' },
        { name: 'testParams', description: 'Test parameters', type: 'string', required: false, default: '' },
        { name: 'assertion', description: 'Expected assertion', type: 'string', required: false, default: 'toBeDefined()' },
      ],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: ['testing', 'arrange-act-assert'],
      },
    });

    // Java Templates
    this.templates.set('java-service', {
      id: 'java-service',
      name: 'Java Spring Service',
      description: 'A Spring service with dependency injection',
      language: 'java',
      category: 'service',
      tags: ['service', 'spring', 'java'],
      template: `package \${packageName};

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
\${imports}

/**
 * \${description}
 */
@Service
public class \${serviceName}Service {

    private final \${repositoryType} \${repositoryName};

    @Autowired
    public \${serviceName}Service(\${repositoryType} \${repositoryName}) {
        this.\${repositoryName} = \${repositoryName};
    }

    /**
     * \${methodDescription}
     */
    public \${returnType} \${methodName}(\${parameters}) {
        // Implementation
        \${implementation}
    }
}
`,
      variables: [
        { name: 'packageName', description: 'Package name', type: 'string', required: true },
        { name: 'serviceName', description: 'Service name (PascalCase)', type: 'string', required: true },
        { name: 'description', description: 'Service description', type: 'string', required: true },
        { name: 'imports', description: 'Additional imports', type: 'string', required: false, default: '' },
        { name: 'repositoryType', description: 'Repository type', type: 'string', required: false, default: 'Object' },
        { name: 'repositoryName', description: 'Repository variable name', type: 'string', required: false, default: 'repository' },
        { name: 'methodName', description: 'Main method name', type: 'string', required: true },
        { name: 'methodDescription', description: 'Method description', type: 'string', required: false, default: 'Performs the main operation' },
        { name: 'parameters', description: 'Method parameters', type: 'string', required: false, default: '' },
        { name: 'returnType', description: 'Return type', type: 'string', required: true },
        { name: 'implementation', description: 'Method implementation', type: 'string', required: false, default: 'throw new UnsupportedOperationException("Not implemented");' },
      ],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: ['dependency-injection', 'layered-architecture'],
        stack: 'java-spring',
      },
    });

    this.templates.set('java-repository', {
      id: 'java-repository',
      name: 'Java Spring Repository',
      description: 'A Spring Data JPA repository interface',
      language: 'java',
      category: 'repository',
      tags: ['repository', 'spring', 'jpa', 'java'],
      template: `package \${packageName};

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
\${imports}

/**
 * Repository for \${entityName} entities.
 */
@Repository
public interface \${entityName}Repository extends JpaRepository<\${entityName}, \${idType}> {

    \${customMethods}
}
`,
      variables: [
        { name: 'packageName', description: 'Package name', type: 'string', required: true },
        { name: 'entityName', description: 'Entity class name', type: 'string', required: true },
        { name: 'idType', description: 'ID type (Long, UUID, etc.)', type: 'string', required: true },
        { name: 'imports', description: 'Additional imports', type: 'string', required: false, default: '' },
        { name: 'customMethods', description: 'Custom query methods', type: 'string', required: false, default: '' },
      ],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: ['repository-pattern', 'data-access'],
        stack: 'java-spring',
      },
    });

    // C# .NET Templates
    this.templates.set('csharp-service', {
      id: 'csharp-service',
      name: 'C# .NET Service',
      description: 'A .NET service with dependency injection',
      language: 'csharp',
      category: 'service',
      tags: ['service', 'dotnet', 'csharp'],
      template: `using System;
using System.Threading.Tasks;
\${usings}

namespace \${namespace}
{
    /// <summary>
    /// \${description}
    /// </summary>
    public class \${serviceName}Service : I\${serviceName}Service
    {
        private readonly I\${repositoryType} _\${repositoryName};

        public \${serviceName}Service(I\${repositoryType} \${repositoryName})
        {
            _\${repositoryName} = \${repositoryName};
        }

        /// <summary>
        /// \${methodDescription}
        /// </summary>
        public async Task<\${returnType}> \${methodName}Async(\${parameters})
        {
            // Implementation
            \${implementation}
        }
    }
}
`,
      variables: [
        { name: 'namespace', description: 'Namespace', type: 'string', required: true },
        { name: 'serviceName', description: 'Service name (PascalCase)', type: 'string', required: true },
        { name: 'description', description: 'Service description', type: 'string', required: true },
        { name: 'usings', description: 'Additional using statements', type: 'string', required: false, default: '' },
        { name: 'repositoryType', description: 'Repository type', type: 'string', required: false, default: 'Repository' },
        { name: 'repositoryName', description: 'Repository variable name', type: 'string', required: false, default: 'repository' },
        { name: 'methodName', description: 'Main method name', type: 'string', required: true },
        { name: 'methodDescription', description: 'Method description', type: 'string', required: false, default: 'Performs the main operation' },
        { name: 'parameters', description: 'Method parameters', type: 'string', required: false, default: '' },
        { name: 'returnType', description: 'Return type', type: 'string', required: true },
        { name: 'implementation', description: 'Method implementation', type: 'string', required: false, default: 'throw new NotImplementedException();' },
      ],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        relatedPatterns: ['dependency-injection', 'layered-architecture'],
        stack: 'dotnet',
      },
    });
  }

  /**
   * Parse a template file
   */
  private parseTemplateFile(filename: string, content: string): CodeTemplate | null {
    const id = filename.replace(/\.(md|template|json)$/, '');

    // Handle JSON format
    if (filename.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        return {
          ...parsed,
          id: parsed.id || id,
          metadata: {
            version: parsed.metadata?.version || '1.0.0',
            createdAt: new Date(parsed.metadata?.createdAt || Date.now()),
            updatedAt: new Date(parsed.metadata?.updatedAt || Date.now()),
            usageCount: parsed.metadata?.usageCount || 0,
            relatedPatterns: parsed.metadata?.relatedPatterns || [],
          },
        };
      } catch {
        return null;
      }
    }

    // Handle Markdown format
    const name = this.extractTitle(content) || id;
    const description = this.extractDescription(content);

    // Extract code block
    const codeBlockMatch = content.match(/```(\w+)\n([\s\S]*?)```/);
    if (!codeBlockMatch) return null;

    const language = codeBlockMatch[1];
    const templateContent = codeBlockMatch[2];

    // Extract variables section
    const variables = this.extractVariables(content);

    // Extract metadata
    const category = this.inferCategory(name, templateContent);
    const tags = this.extractTags(content);

    return {
      id,
      name,
      description,
      language,
      category,
      tags,
      template: templateContent,
      variables,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        relatedPatterns: [],
      },
    };
  }

  /**
   * Save a template to Memory Bank
   */
  private async saveTemplate(template: CodeTemplate): Promise<void> {
    if (!this.workspaceRoot) return;

    const memoryBankPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    const templatesPath = path.join(this.workspaceRoot, memoryBankPath, 'templates');

    // Ensure templates directory exists
    try {
      await fs.mkdir(templatesPath, { recursive: true });
    } catch {
      // Directory already exists
    }

    // Save as JSON for better structure preservation
    const filePath = path.join(templatesPath, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));
  }

  /**
   * Validate a variable value
   */
  private validateVariable(
    value: string | boolean | number | string[],
    varDef: TemplateVariable
  ): { valid: boolean; message?: string } {
    // Type check
    if (varDef.type === 'string' && typeof value !== 'string') {
      return { valid: false, message: `Expected string, got ${typeof value}` };
    }
    if (varDef.type === 'boolean' && typeof value !== 'boolean') {
      return { valid: false, message: `Expected boolean, got ${typeof value}` };
    }
    if (varDef.type === 'number' && typeof value !== 'number') {
      return { valid: false, message: `Expected number, got ${typeof value}` };
    }
    if (varDef.type === 'array' && !Array.isArray(value)) {
      return { valid: false, message: `Expected array, got ${typeof value}` };
    }
    if (varDef.type === 'enum' && varDef.enumValues && !varDef.enumValues.includes(String(value))) {
      return { valid: false, message: `Value must be one of: ${varDef.enumValues.join(', ')}` };
    }

    // Validation rules
    if (varDef.validation && typeof value === 'string') {
      const { validation } = varDef;
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        return { valid: false, message: `Value does not match pattern: ${validation.pattern}` };
      }
      if (validation.minLength && value.length < validation.minLength) {
        return { valid: false, message: `Value must be at least ${validation.minLength} characters` };
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return { valid: false, message: `Value must be at most ${validation.maxLength} characters` };
      }
    }

    if (varDef.validation && typeof value === 'number') {
      const { validation } = varDef;
      if (validation.min !== undefined && value < validation.min) {
        return { valid: false, message: `Value must be at least ${validation.min}` };
      }
      if (validation.max !== undefined && value > validation.max) {
        return { valid: false, message: `Value must be at most ${validation.max}` };
      }
    }

    return { valid: true };
  }

  /**
   * Convert value to string for substitution
   */
  private valueToString(value: string | boolean | number | string[]): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  }

  /**
   * Apply transformations to rendered content
   */
  private applyTransformations(
    content: string,
    variables: Record<string, string | boolean | number | string[]>
  ): string {
    // Apply camelCase transformation: ${name:camelCase}
    content = content.replace(
      /\$\{(\w+):camelCase\}/g,
      (_, name) => this.toCamelCase(String(variables[name] || name))
    );

    // Apply PascalCase transformation: ${name:PascalCase}
    content = content.replace(
      /\$\{(\w+):PascalCase\}/g,
      (_, name) => this.toPascalCase(String(variables[name] || name))
    );

    // Apply snake_case transformation: ${name:snake_case}
    content = content.replace(
      /\$\{(\w+):snake_case\}/g,
      (_, name) => this.toSnakeCase(String(variables[name] || name))
    );

    // Apply UPPER_CASE transformation: ${name:UPPER_CASE}
    content = content.replace(
      /\$\{(\w+):UPPER_CASE\}/g,
      (_, name) => this.toUpperSnakeCase(String(variables[name] || name))
    );

    // Apply lowercase transformation: ${name:lowercase}
    content = content.replace(
      /\$\{(\w+):lowercase\}/g,
      (_, name) => String(variables[name] || '').toLowerCase()
    );

    // Apply uppercase transformation: ${name:uppercase}
    content = content.replace(
      /\$\{(\w+):uppercase\}/g,
      (_, name) => String(variables[name] || '').toUpperCase()
    );

    return content;
  }

  /**
   * Detect code context for suggestions
   */
  private detectCodeContext(
    textBefore: string,
    currentLine: string,
    language: string
  ): {
    suggestedCategory?: TemplateCategory;
    reason: string;
    detectedVariables: Record<string, string>;
  } {
    const context: {
      suggestedCategory?: TemplateCategory;
      reason: string;
      detectedVariables: Record<string, string>;
    } = {
      reason: 'General code context',
      detectedVariables: {},
    };

    const textLower = textBefore.toLowerCase();
    const lineLower = currentLine.toLowerCase();

    // Detect from imports and decorators
    if (textLower.includes('@controller') || textLower.includes('controller')) {
      context.suggestedCategory = 'controller';
      context.reason = 'Controller context detected';
    } else if (textLower.includes('@service') || textLower.includes('service')) {
      context.suggestedCategory = 'service';
      context.reason = 'Service context detected';
    } else if (textLower.includes('@repository') || textLower.includes('repository')) {
      context.suggestedCategory = 'repository';
      context.reason = 'Repository context detected';
    } else if (textLower.includes('describe(') || textLower.includes('@test')) {
      context.suggestedCategory = 'test';
      context.reason = 'Test context detected';
    }

    // Try to extract class/package name
    const classMatch = textBefore.match(/class\s+(\w+)/);
    if (classMatch) {
      context.detectedVariables.className = classMatch[1];
    }

    const packageMatch = textBefore.match(/package\s+([\w.]+)/);
    if (packageMatch) {
      context.detectedVariables.packageName = packageMatch[1];
    }

    const namespaceMatch = textBefore.match(/namespace\s+([\w.]+)/);
    if (namespaceMatch) {
      context.detectedVariables.namespace = namespaceMatch[1];
    }

    return context;
  }

  /**
   * Calculate context relevance for a template
   */
  private calculateContextRelevance(
    template: CodeTemplate,
    context: {
      suggestedCategory?: TemplateCategory;
      reason: string;
      detectedVariables: Record<string, string>;
    }
  ): number {
    let relevance = 0.5;

    if (context.suggestedCategory === template.category) {
      relevance += 0.3;
    }

    // Check if detected variables match template variables
    for (const varName of Object.keys(context.detectedVariables)) {
      if (template.variables.some((v) => v.name === varName)) {
        relevance += 0.1;
      }
    }

    return Math.min(relevance, 1);
  }

  /**
   * Helper methods
   */

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('```')) {
        return trimmed;
      }
    }
    return '';
  }

  private extractVariables(content: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const varsSection = content.match(/##\s*Variables[\s\S]*?(?=\n##|$)/i);

    if (varsSection) {
      const items = varsSection[0].match(/[-*]\s+`?(\w+)`?[:\s]+(.+)/g);
      if (items) {
        for (const item of items) {
          const match = item.match(/[-*]\s+`?(\w+)`?[:\s]+(.+)/);
          if (match) {
            variables.push({
              name: match[1],
              description: match[2].trim(),
              type: 'string',
              required: match[2].toLowerCase().includes('required'),
            });
          }
        }
      }
    }

    // Also extract from template placeholders
    const templateMatch = content.match(/```\w+\n([\s\S]*?)```/);
    if (templateMatch) {
      const templateContent = templateMatch[1];
      const placeholders = templateContent.match(/\$\{(\w+)\}/g) || [];
      for (const placeholder of placeholders) {
        const name = placeholder.replace(/\$\{|\}/g, '');
        if (!variables.some((v) => v.name === name)) {
          variables.push({
            name,
            description: `Variable: ${name}`,
            type: 'string',
            required: true,
          });
        }
      }
    }

    return variables;
  }

  private extractTags(content: string): string[] {
    const tagsMatch = content.match(/tags?[:\s]+(.+)/i);
    if (tagsMatch) {
      return tagsMatch[1]
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t);
    }
    return [];
  }

  private inferCategory(name: string, content: string): TemplateCategory {
    const lower = (name + ' ' + content).toLowerCase();
    if (lower.includes('service')) return 'service';
    if (lower.includes('controller')) return 'controller';
    if (lower.includes('repository')) return 'repository';
    if (lower.includes('model') || lower.includes('entity')) return 'model';
    if (lower.includes('dto')) return 'dto';
    if (lower.includes('test')) return 'test';
    if (lower.includes('config')) return 'config';
    if (lower.includes('api')) return 'api';
    if (lower.includes('component')) return 'component';
    if (lower.includes('util')) return 'utility';
    return 'general';
  }

  private generateTemplateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapLanguageId(languageId: string): string {
    const mapping: Record<string, string> = {
      javascript: 'typescript',
      javascriptreact: 'typescript',
      typescriptreact: 'typescript',
      typescript: 'typescript',
      java: 'java',
      csharp: 'csharp',
      python: 'python',
      go: 'go',
      rust: 'rust',
    };
    return mapping[languageId] || languageId;
  }

  // Case conversion helpers
  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^[A-Z]/, (c) => c.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^[a-z]/, (c) => c.toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[-\s]+/g, '_');
  }

  private toUpperSnakeCase(str: string): string {
    return this.toSnakeCase(str).toUpperCase();
  }

  /**
   * Reload templates
   */
  async reload(): Promise<void> {
    this.templates.clear();
    this.templatesLoaded = false;
    await this.initialize();
  }
}

/**
 * Template suggestion with context
 */
export interface TemplateSuggestion {
  template: CodeTemplate;
  relevance: number;
  reason: string;
  prefillVariables: Record<string, string>;
}

// Export singleton accessor
let templateProvider: TemplateProvider | null = null;

export function getTemplateProvider(): TemplateProvider {
  if (!templateProvider) {
    templateProvider = new TemplateProvider();
  }
  return templateProvider;
}
