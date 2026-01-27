/**
 * Memory Bank Library
 *
 * Core functionality for managing the Memory Bank - the team's shared
 * knowledge repository for GitHub Copilot context.
 */

import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import { SchemaValidator } from './schema-validator.js';

// Types
export interface MemoryBankConfig {
  rootPath: string;
  schemasPath: string;
  templatesPath: string;
}

export interface ProjectContext {
  name: string;
  description: string;
  version: string;
  lastUpdated: string;
  status?: string;
  technicalStack?: Record<string, unknown>;
  architecture?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ModuleContext {
  name: string;
  description: string;
  lastUpdated: string;
  status?: string;
  ownership?: Record<string, unknown>;
  responsibilities?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DecisionRecord {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: string;
  context: string;
  decision: string;
  [key: string]: unknown;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
  author: { name: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface MemoryBankStructure {
  project?: ProjectContext;
  team?: Record<string, unknown>;
  modules: Map<string, ModuleContext>;
  decisions: DecisionRecord[];
  knowledge: KnowledgeEntry[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  schemaPath?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

/**
 * Memory Bank Manager
 *
 * Provides APIs for initializing, reading, writing, and validating
 * the Memory Bank structure.
 */
export class MemoryBank {
  private config: MemoryBankConfig;
  private validator: SchemaValidator;

  constructor(config?: Partial<MemoryBankConfig>) {
    this.config = {
      rootPath: config?.rootPath || '.memory-bank',
      schemasPath: config?.schemasPath || path.join(__dirname, '../../core/memory-bank/schemas'),
      templatesPath: config?.templatesPath || path.join(__dirname, '../../core/memory-bank/templates'),
    };
    this.validator = new SchemaValidator(this.config.schemasPath);
  }

  /**
   * Initialize a new Memory Bank structure
   */
  async init(options?: { force?: boolean; template?: string }): Promise<void> {
    const mbPath = this.config.rootPath;

    // Check if already exists
    if (await fs.pathExists(mbPath) && !options?.force) {
      throw new Error(`Memory Bank already exists at ${mbPath}. Use --force to overwrite.`);
    }

    // Create directory structure
    const directories = [
      'project',
      'team',
      'modules',
      'decisions',
      'knowledge',
      'knowledge/patterns',
      'knowledge/antipatterns',
      'knowledge/troubleshooting',
      'knowledge/best-practices',
    ];

    for (const dir of directories) {
      await fs.ensureDir(path.join(mbPath, dir));
    }

    // Create initial files from templates
    await this.createFromTemplate('project-context.template.md', 'project/context.md');
    await this.createFromTemplate('team-context.template.md', 'team/context.md');

    // Create .gitkeep files for empty directories
    const emptyDirs = ['modules', 'decisions', 'knowledge/patterns', 'knowledge/antipatterns'];
    for (const dir of emptyDirs) {
      await fs.writeFile(path.join(mbPath, dir, '.gitkeep'), '');
    }

    // Create README
    await this.createReadme();
  }

  /**
   * Check if Memory Bank is initialized
   */
  async isInitialized(): Promise<boolean> {
    return fs.pathExists(this.config.rootPath);
  }

  /**
   * Load the entire Memory Bank structure
   */
  async load(): Promise<MemoryBankStructure> {
    if (!await this.isInitialized()) {
      throw new Error('Memory Bank not initialized. Run `egce memory init` first.');
    }

    const structure: MemoryBankStructure = {
      modules: new Map(),
      decisions: [],
      knowledge: [],
    };

    // Load project context
    const projectPath = path.join(this.config.rootPath, 'project/context.md');
    if (await fs.pathExists(projectPath)) {
      structure.project = await this.parseMarkdownWithFrontmatter(projectPath);
    }

    // Load team context
    const teamPath = path.join(this.config.rootPath, 'team/context.md');
    if (await fs.pathExists(teamPath)) {
      structure.team = await this.parseMarkdownWithFrontmatter(teamPath);
    }

    // Load modules
    const modulesDir = path.join(this.config.rootPath, 'modules');
    const moduleNames = await fs.readdir(modulesDir);
    for (const moduleName of moduleNames) {
      if (moduleName.startsWith('.')) continue;
      const modulePath = path.join(modulesDir, moduleName, 'context.md');
      if (await fs.pathExists(modulePath)) {
        structure.modules.set(moduleName, await this.parseMarkdownWithFrontmatter(modulePath));
      }
    }

    // Load decisions
    const decisionsDir = path.join(this.config.rootPath, 'decisions');
    const decisionFiles = await glob.glob('ADR-*.md', { cwd: decisionsDir });
    for (const file of decisionFiles) {
      const decisionPath = path.join(decisionsDir, file);
      structure.decisions.push(await this.parseMarkdownWithFrontmatter(decisionPath));
    }

    // Load knowledge entries
    const knowledgeDir = path.join(this.config.rootPath, 'knowledge');
    const knowledgeFiles = await glob.glob('**/*.md', { cwd: knowledgeDir });
    for (const file of knowledgeFiles) {
      const knowledgePath = path.join(knowledgeDir, file);
      structure.knowledge.push(await this.parseMarkdownWithFrontmatter(knowledgePath));
    }

    return structure;
  }

  /**
   * Validate the Memory Bank structure
   */
  async validate(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!await this.isInitialized()) {
      result.valid = false;
      result.errors.push({
        path: this.config.rootPath,
        message: 'Memory Bank not initialized',
      });
      return result;
    }

    // Validate project context
    const projectPath = path.join(this.config.rootPath, 'project/context.md');
    if (!await fs.pathExists(projectPath)) {
      result.warnings.push({
        path: projectPath,
        message: 'Project context not found',
      });
    }

    // Validate required directories
    const requiredDirs = ['project', 'modules', 'decisions', 'knowledge'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.config.rootPath, dir);
      if (!await fs.pathExists(dirPath)) {
        result.errors.push({
          path: dirPath,
          message: `Required directory missing: ${dir}`,
        });
        result.valid = false;
      }
    }

    // Validate decision record naming
    const decisionsDir = path.join(this.config.rootPath, 'decisions');
    if (await fs.pathExists(decisionsDir)) {
      const files = await fs.readdir(decisionsDir);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        if (!file.match(/^ADR-\d{4}-.+\.md$/)) {
          result.warnings.push({
            path: path.join(decisionsDir, file),
            message: `Decision file does not follow naming convention: ADR-XXXX-title.md`,
          });
        }
      }
    }

    return result;
  }

  /**
   * Add a new module context
   */
  async addModule(name: string, context?: Partial<ModuleContext>): Promise<string> {
    const modulePath = path.join(this.config.rootPath, 'modules', name);
    await fs.ensureDir(modulePath);

    const contextPath = path.join(modulePath, 'context.md');
    await this.createFromTemplate('module-context.template.md', `modules/${name}/context.md`, {
      module_name: name,
      date: new Date().toISOString().split('T')[0],
      ...context,
    });

    return contextPath;
  }

  /**
   * Add a new decision record (ADR)
   */
  async addDecision(title: string, options?: { status?: string }): Promise<string> {
    const decisionsDir = path.join(this.config.rootPath, 'decisions');
    await fs.ensureDir(decisionsDir);

    // Get next ADR number
    const existingAdrs = await glob.glob('ADR-*.md', { cwd: decisionsDir });
    const numbers = existingAdrs.map(f => parseInt(f.match(/ADR-(\d{4})/)?.[1] || '0'));
    const nextNumber = Math.max(0, ...numbers) + 1;
    const adrId = `ADR-${nextNumber.toString().padStart(4, '0')}`;

    // Create filename
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${adrId}-${slug}.md`;
    const adrPath = path.join(decisionsDir, filename);

    await this.createFromTemplate('adr.template.md', `decisions/${filename}`, {
      ADR_ID: adrId,
      title,
      status: options?.status || 'proposed',
      date: new Date().toISOString().split('T')[0],
    });

    return adrPath;
  }

  /**
   * Add a knowledge entry
   */
  async addKnowledge(
    type: 'pattern' | 'antipattern' | 'troubleshooting' | 'best-practice',
    title: string,
    content?: Partial<KnowledgeEntry>
  ): Promise<string> {
    const typeDir = type === 'best-practice' ? 'best-practices' : type + 's';
    const knowledgeDir = path.join(this.config.rootPath, 'knowledge', typeDir);
    await fs.ensureDir(knowledgeDir);

    // Get next KB number
    const existingKbs = await glob.glob('KB-*.md', { cwd: path.join(this.config.rootPath, 'knowledge') });
    const numbers = existingKbs.map(f => parseInt(f.match(/KB-(\d{4})/)?.[1] || '0'));
    const nextNumber = Math.max(0, ...numbers) + 1;
    const kbId = `KB-${nextNumber.toString().padStart(4, '0')}`;

    // Create filename
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${kbId}-${slug}.md`;
    const kbPath = path.join(knowledgeDir, filename);

    const templateName = type === 'troubleshooting' ? 'troubleshooting.template.md' : 'knowledge-entry.template.md';
    await this.createFromTemplate(templateName, `knowledge/${typeDir}/${filename}`, {
      KB_ID: kbId,
      title,
      type,
      created_date: new Date().toISOString().split('T')[0],
      ...content,
    });

    return kbPath;
  }

  /**
   * Search the Memory Bank
   */
  async search(query: string): Promise<Array<{ path: string; type: string; title: string; relevance: number }>> {
    const results: Array<{ path: string; type: string; title: string; relevance: number }> = [];
    const queryLower = query.toLowerCase();

    const structure = await this.load();

    // Search decisions
    for (const decision of structure.decisions) {
      const relevance = this.calculateRelevance(queryLower, [decision.title, decision.context, decision.decision]);
      if (relevance > 0) {
        results.push({
          path: `decisions/${decision.id}`,
          type: 'decision',
          title: decision.title,
          relevance,
        });
      }
    }

    // Search knowledge
    for (const kb of structure.knowledge) {
      const relevance = this.calculateRelevance(queryLower, [kb.title, kb.content]);
      if (relevance > 0) {
        results.push({
          path: `knowledge/${kb.id}`,
          type: kb.type,
          title: kb.title,
          relevance,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * Export Memory Bank to JSON format (for web dashboard)
   */
  async export(): Promise<Record<string, unknown>> {
    const structure = await this.load();

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      project: structure.project,
      team: structure.team,
      modules: Object.fromEntries(structure.modules),
      decisions: structure.decisions,
      knowledge: structure.knowledge,
    };
  }

  // Private helper methods

  private async createFromTemplate(
    templateName: string,
    outputPath: string,
    variables?: Record<string, unknown>
  ): Promise<void> {
    const templatePath = path.join(this.config.templatesPath, templateName);
    const outputFullPath = path.join(this.config.rootPath, outputPath);

    let content = await fs.readFile(templatePath, 'utf-8');

    // Replace template variables
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, String(value));
      }
    }

    await fs.ensureDir(path.dirname(outputFullPath));
    await fs.writeFile(outputFullPath, content);
  }

  private async parseMarkdownWithFrontmatter(filePath: string): Promise<Record<string, unknown>> {
    const content = await fs.readFile(filePath, 'utf-8');

    // Simple frontmatter parsing
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      // Parse YAML frontmatter
      const yaml = await import('js-yaml');
      return yaml.load(frontmatterMatch[1]) as Record<string, unknown>;
    }

    return { content };
  }

  private calculateRelevance(query: string, fields: (string | undefined)[]): number {
    let relevance = 0;
    for (const field of fields) {
      if (!field) continue;
      const fieldLower = field.toLowerCase();
      if (fieldLower.includes(query)) {
        relevance += fieldLower === query ? 10 : 5;
      }
      // Check for partial word matches
      const words = query.split(/\s+/);
      for (const word of words) {
        if (fieldLower.includes(word)) {
          relevance += 1;
        }
      }
    }
    return relevance;
  }

  private async createReadme(): Promise<void> {
    const readme = `# Memory Bank

This directory contains the team's shared knowledge for GitHub Copilot context.

## Structure

- \`project/\` - Project-level context
- \`team/\` - Team structure and conventions
- \`modules/\` - Module-specific contexts
- \`decisions/\` - Architecture Decision Records (ADRs)
- \`knowledge/\` - Patterns, anti-patterns, and troubleshooting guides

## Usage

This Memory Bank is automatically read by GitHub Copilot agents to provide
context-aware assistance. Keep it updated!

## Commands

\`\`\`bash
egce memory validate    # Validate structure
egce memory add-module  # Add new module
egce memory add-decision # Add new ADR
\`\`\`
`;

    await fs.writeFile(path.join(this.config.rootPath, 'README.md'), readme);
  }
}

// Export singleton instance
export const memoryBank = new MemoryBank();
