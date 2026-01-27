/**
 * Schema Validator Library
 *
 * Validates Memory Bank content against JSON schemas to ensure
 * consistency and correctness.
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// Types
export interface ValidationResult {
  valid: boolean;
  errors: SchemaError[];
  warnings: SchemaWarning[];
}

export interface SchemaError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
  schemaPath: string;
}

export interface SchemaWarning {
  path: string;
  message: string;
}

export interface SchemaInfo {
  name: string;
  title: string;
  description: string;
  path: string;
}

/**
 * Schema Validator
 *
 * Provides JSON Schema validation for Memory Bank content.
 */
export class SchemaValidator {
  private ajv: Ajv;
  private schemasPath: string;
  private validators: Map<string, ValidateFunction>;
  private schemasLoaded: boolean = false;

  constructor(schemasPath?: string) {
    this.schemasPath = schemasPath || path.join(__dirname, '../../core/memory-bank/schemas');
    this.validators = new Map();

    // Initialize Ajv with strict mode and formats
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
      strictSchema: true,
      strictNumbers: true,
      strictTypes: true,
      strictTuples: true,
      strictRequired: true,
      allowUnionTypes: true,
    });

    // Add standard formats (date, email, uri, etc.)
    addFormats(this.ajv);
  }

  /**
   * Load all schemas from the schemas directory
   */
  async loadSchemas(): Promise<void> {
    if (this.schemasLoaded) return;

    const schemaFiles = await fs.readdir(this.schemasPath);

    for (const file of schemaFiles) {
      if (!file.endsWith('.schema.json')) continue;

      const schemaPath = path.join(this.schemasPath, file);
      const schema = await fs.readJson(schemaPath);

      // Add schema to Ajv
      this.ajv.addSchema(schema, schema.$id || file);

      // Create and cache validator
      const validate = this.ajv.compile(schema);
      const schemaName = file.replace('.schema.json', '');
      this.validators.set(schemaName, validate);
    }

    this.schemasLoaded = true;
  }

  /**
   * Get list of available schemas
   */
  async getAvailableSchemas(): Promise<SchemaInfo[]> {
    await this.loadSchemas();

    const schemas: SchemaInfo[] = [];
    const schemaFiles = await fs.readdir(this.schemasPath);

    for (const file of schemaFiles) {
      if (!file.endsWith('.schema.json')) continue;

      const schemaPath = path.join(this.schemasPath, file);
      const schema = await fs.readJson(schemaPath);

      schemas.push({
        name: file.replace('.schema.json', ''),
        title: schema.title || file,
        description: schema.description || '',
        path: schemaPath,
      });
    }

    return schemas;
  }

  /**
   * Validate data against a specific schema
   */
  async validate(schemaName: string, data: unknown): Promise<ValidationResult> {
    await this.loadSchemas();

    const validator = this.validators.get(schemaName);
    if (!validator) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `Schema not found: ${schemaName}`,
          keyword: 'schema',
          params: { schemaName },
          schemaPath: '',
        }],
        warnings: [],
      };
    }

    const valid = validator(data);

    if (valid) {
      return { valid: true, errors: [], warnings: [] };
    }

    return {
      valid: false,
      errors: this.formatErrors(validator.errors || []),
      warnings: [],
    };
  }

  /**
   * Validate a file against its corresponding schema
   */
  async validateFile(filePath: string, schemaName?: string): Promise<ValidationResult> {
    // Determine schema from file path if not provided
    if (!schemaName) {
      schemaName = this.inferSchemaFromPath(filePath);
    }

    if (!schemaName) {
      return {
        valid: false,
        errors: [{
          path: filePath,
          message: 'Could not determine schema for file',
          keyword: 'schema',
          params: { filePath },
          schemaPath: '',
        }],
        warnings: [],
      };
    }

    // Read and parse file
    let data: unknown;
    const content = await fs.readFile(filePath, 'utf-8');

    if (filePath.endsWith('.json')) {
      data = JSON.parse(content);
    } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      data = yaml.load(content);
    } else if (filePath.endsWith('.md')) {
      // Extract frontmatter from markdown
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        data = yaml.load(frontmatterMatch[1]);
      } else {
        return {
          valid: true,
          errors: [],
          warnings: [{
            path: filePath,
            message: 'No frontmatter found in markdown file',
          }],
        };
      }
    } else {
      return {
        valid: false,
        errors: [{
          path: filePath,
          message: 'Unsupported file format',
          keyword: 'format',
          params: { filePath },
          schemaPath: '',
        }],
        warnings: [],
      };
    }

    return this.validate(schemaName, data);
  }

  /**
   * Validate entire Memory Bank directory
   */
  async validateMemoryBank(mbPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Validate project context
    const projectContext = path.join(mbPath, 'project/context.md');
    if (await fs.pathExists(projectContext)) {
      const projectResult = await this.validateFile(projectContext, 'project-context');
      if (!projectResult.valid) {
        result.valid = false;
        result.errors.push(...projectResult.errors);
      }
      result.warnings.push(...projectResult.warnings);
    }

    // Validate team context
    const teamContext = path.join(mbPath, 'team/context.md');
    if (await fs.pathExists(teamContext)) {
      const teamResult = await this.validateFile(teamContext, 'team-context');
      if (!teamResult.valid) {
        result.valid = false;
        result.errors.push(...teamResult.errors);
      }
      result.warnings.push(...teamResult.warnings);
    }

    // Validate modules
    const modulesDir = path.join(mbPath, 'modules');
    if (await fs.pathExists(modulesDir)) {
      const modules = await fs.readdir(modulesDir);
      for (const module of modules) {
        if (module.startsWith('.')) continue;
        const moduleContext = path.join(modulesDir, module, 'context.md');
        if (await fs.pathExists(moduleContext)) {
          const moduleResult = await this.validateFile(moduleContext, 'module-context');
          if (!moduleResult.valid) {
            result.valid = false;
            result.errors.push(...moduleResult.errors.map(e => ({
              ...e,
              path: `modules/${module}/${e.path}`,
            })));
          }
          result.warnings.push(...moduleResult.warnings);
        }
      }
    }

    // Validate decisions
    const decisionsDir = path.join(mbPath, 'decisions');
    if (await fs.pathExists(decisionsDir)) {
      const decisions = await fs.readdir(decisionsDir);
      for (const decision of decisions) {
        if (!decision.endsWith('.md') || decision.startsWith('.')) continue;
        const decisionPath = path.join(decisionsDir, decision);
        const decisionResult = await this.validateFile(decisionPath, 'decision-record');
        if (!decisionResult.valid) {
          result.valid = false;
          result.errors.push(...decisionResult.errors.map(e => ({
            ...e,
            path: `decisions/${decision}/${e.path}`,
          })));
        }
        result.warnings.push(...decisionResult.warnings);
      }
    }

    return result;
  }

  /**
   * Get schema by name
   */
  async getSchema(schemaName: string): Promise<Record<string, unknown> | null> {
    const schemaPath = path.join(this.schemasPath, `${schemaName}.schema.json`);
    if (await fs.pathExists(schemaPath)) {
      return fs.readJson(schemaPath);
    }
    return null;
  }

  /**
   * Generate example data from schema
   */
  async generateExample(schemaName: string): Promise<Record<string, unknown> | null> {
    const schema = await this.getSchema(schemaName);
    if (!schema) return null;

    return this.generateFromSchema(schema);
  }

  // Private helper methods

  private formatErrors(errors: ErrorObject[]): SchemaError[] {
    return errors.map(error => ({
      path: error.instancePath || '/',
      message: error.message || 'Validation error',
      keyword: error.keyword,
      params: error.params as Record<string, unknown>,
      schemaPath: error.schemaPath,
    }));
  }

  private inferSchemaFromPath(filePath: string): string | null {
    const filename = path.basename(filePath);
    const dir = path.dirname(filePath);

    // Infer from directory structure
    if (dir.includes('project')) return 'project-context';
    if (dir.includes('team')) return 'team-context';
    if (dir.includes('modules')) return 'module-context';
    if (dir.includes('decisions')) return 'decision-record';
    if (dir.includes('knowledge')) return 'knowledge-entry';

    // Infer from filename
    if (filename.includes('context')) return 'project-context';
    if (filename.startsWith('ADR-')) return 'decision-record';
    if (filename.startsWith('KB-')) return 'knowledge-entry';

    return null;
  }

  private generateFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const required = (schema.required as string[]) || [];

    if (!properties) return result;

    for (const [key, prop] of Object.entries(properties)) {
      // Only generate required fields by default
      if (!required.includes(key)) continue;

      result[key] = this.generateValue(prop);
    }

    return result;
  }

  private generateValue(prop: Record<string, unknown>): unknown {
    const type = prop.type as string;
    const enumValues = prop.enum as unknown[];

    if (enumValues && enumValues.length > 0) {
      return enumValues[0];
    }

    switch (type) {
      case 'string':
        if (prop.format === 'date') return new Date().toISOString().split('T')[0];
        if (prop.format === 'date-time') return new Date().toISOString();
        if (prop.format === 'email') return 'example@example.com';
        if (prop.format === 'uri') return 'https://example.com';
        if (prop.pattern) return '{{' + (prop.description || 'value') + '}}';
        return '{{' + (prop.description || 'value') + '}}';
      case 'number':
      case 'integer':
        return prop.default || 0;
      case 'boolean':
        return prop.default || false;
      case 'array':
        return [];
      case 'object':
        return this.generateFromSchema(prop);
      default:
        return null;
    }
  }
}

// Add ajv-formats import simulation (will be installed as dependency)
function addFormats(ajv: Ajv): void {
  // Standard formats are added by ajv-formats package
  // This is a placeholder that will be replaced by actual import
  ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
  ajv.addFormat('date-time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  ajv.addFormat('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  ajv.addFormat('uri', /^https?:\/\//);
}

// Export singleton instance
export const schemaValidator = new SchemaValidator();
