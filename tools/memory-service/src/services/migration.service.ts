import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, withTransaction } from '../database/client.js';
import { getContextService } from './context.service.js';
import { getEmbeddingService } from './embedding.service.js';
import { createChildLogger } from '../utils/logger.js';
import { ContextEntryTypeSchema } from '../models/index.js';

const logger = createChildLogger('migration-service');

interface LegacyMemoryBankFile {
  path: string;
  content: string;
  type: string;
  metadata: Record<string, unknown>;
}

interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  errors: { file: string; error: string }[];
}

interface MigrationOptions {
  projectId: string;
  organizationId: string;
  userId?: string;
  dryRun?: boolean;
  generateEmbeddings?: boolean;
}

/**
 * Service to migrate legacy .memory-bank file system to PostgreSQL database
 */
export class MigrationService {
  private contextService = getContextService();
  private embeddingService = getEmbeddingService();

  /**
   * Migrate a legacy .memory-bank directory to the database
   */
  async migrateFromDirectory(
    memoryBankPath: string,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    logger.info({ path: memoryBankPath, projectId: options.projectId }, 'Starting migration');

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Scan for markdown files
      const files = await this.scanDirectory(memoryBankPath);
      result.total = files.length;

      logger.info({ fileCount: files.length }, 'Found files to migrate');

      // Process files in batches
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (file) => {
            try {
              await this.migrateFile(file, options);
              result.migrated++;
              logger.debug({ file: file.path }, 'File migrated');
            } catch (error) {
              result.failed++;
              result.errors.push({
                file: file.path,
                error: error instanceof Error ? error.message : String(error),
              });
              logger.warn({ file: file.path, error }, 'Failed to migrate file');
            }
          })
        );

        logger.info({
          progress: Math.min(i + batchSize, files.length),
          total: files.length,
        }, 'Migration progress');
      }

      logger.info(result, 'Migration completed');
      return result;
    } catch (error) {
      logger.error({ error }, 'Migration failed');
      throw error;
    }
  }

  /**
   * Scan directory recursively for markdown files
   */
  private async scanDirectory(dirPath: string): Promise<LegacyMemoryBankFile[]> {
    const files: LegacyMemoryBankFile[] = [];

    const scan = async (currentPath: string): Promise<void> => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = await fs.readFile(fullPath, 'utf-8');
          const relativePath = path.relative(dirPath, fullPath);
          const type = this.inferTypeFromPath(relativePath);
          const metadata = this.extractMetadataFromContent(content);

          files.push({
            path: relativePath,
            content,
            type,
            metadata,
          });
        }
      }
    };

    await scan(dirPath);
    return files;
  }

  /**
   * Infer context entry type from file path
   */
  private inferTypeFromPath(filePath: string): string {
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.includes('decision') || lowerPath.includes('adr')) {
      return 'adr';
    }
    if (lowerPath.includes('pattern')) {
      return 'pattern';
    }
    if (lowerPath.includes('troubleshooting')) {
      return 'troubleshooting';
    }
    if (lowerPath.includes('knowledge')) {
      return 'knowledge';
    }
    if (lowerPath.includes('module') || lowerPath.includes('context')) {
      return 'module';
    }
    if (lowerPath.includes('team')) {
      return 'team';
    }

    return 'context';
  }

  /**
   * Extract metadata from markdown frontmatter
   */
  private extractMetadataFromContent(content: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch?.[1]) {
      const frontmatter = frontmatterMatch[1];

      // Simple YAML parsing for common fields
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match?.[1] && match[2]) {
          const key = match[1];
          let value: unknown = match[2].trim();

          // Handle arrays
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value
              .slice(1, -1)
              .split(',')
              .map((v) => v.trim().replace(/['"]/g, ''));
          }
          // Handle quoted strings
          else if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          // Handle booleans
          else if (value === 'true') {
            value = true;
          } else if (value === 'false') {
            value = false;
          }
          // Handle numbers
          else if (!isNaN(Number(value))) {
            value = Number(value);
          }

          metadata[key] = value;
        }
      }
    }

    return metadata;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string): string {
    // Remove frontmatter
    const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

    // Look for first H1
    const h1Match = withoutFrontmatter.match(/^#\s+(.+)$/m);
    if (h1Match?.[1]) {
      return h1Match[1].trim();
    }

    // Look for first H2
    const h2Match = withoutFrontmatter.match(/^##\s+(.+)$/m);
    if (h2Match?.[1]) {
      return h2Match[1].trim();
    }

    // Use first line as title
    const firstLine = withoutFrontmatter.trim().split('\n')[0];
    return firstLine?.substring(0, 100) ?? 'Untitled';
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string, metadata: Record<string, unknown>): string[] {
    const tags: string[] = [];

    // Get tags from metadata
    if (Array.isArray(metadata['tags'])) {
      tags.push(...(metadata['tags'] as string[]));
    }

    // Extract hashtags from content
    const hashtagMatches = content.match(/#[\w-]+/g);
    if (hashtagMatches) {
      for (const tag of hashtagMatches) {
        const cleanTag = tag.substring(1).toLowerCase();
        if (!tags.includes(cleanTag) && cleanTag.length > 1) {
          tags.push(cleanTag);
        }
      }
    }

    return tags.slice(0, 20); // Limit to 20 tags
  }

  /**
   * Migrate a single file to the database
   */
  private async migrateFile(
    file: LegacyMemoryBankFile,
    options: MigrationOptions
  ): Promise<void> {
    const title = this.extractTitle(file.content);
    const tags = this.extractTags(file.content, file.metadata);

    // Validate type
    const typeResult = ContextEntryTypeSchema.safeParse(file.type);
    const type = typeResult.success ? typeResult.data : 'context';

    if (options.dryRun) {
      logger.info({
        path: file.path,
        title,
        type,
        tags,
      }, 'Would migrate file (dry run)');
      return;
    }

    await this.contextService.create({
      projectId: options.projectId,
      moduleId: null,
      type,
      title,
      content: file.content,
      contentFormat: 'markdown',
      status: 'active',
      tags,
      metadata: {
        ...file.metadata,
        legacyPath: file.path,
        migratedAt: new Date().toISOString(),
      },
      createdBy: options.userId ?? null,
      updatedBy: options.userId ?? null,
      supersededBy: null,
    });
  }

  /**
   * Export context entries back to markdown files
   */
  async exportToDirectory(
    projectId: string,
    outputPath: string
  ): Promise<{ exported: number }> {
    logger.info({ projectId, outputPath }, 'Starting export');

    const { entries } = await this.contextService.getByProject(projectId, {
      limit: 10000,
    });

    let exported = 0;

    for (const entry of entries) {
      const dirPath = this.getExportPath(entry.type, outputPath);
      await fs.mkdir(dirPath, { recursive: true });

      const fileName = this.sanitizeFileName(entry.title) + '.md';
      const filePath = path.join(dirPath, fileName);

      // Build frontmatter
      const frontmatter = [
        '---',
        `title: "${entry.title}"`,
        `type: ${entry.type}`,
        `status: ${entry.status}`,
        `tags: [${entry.tags.map((t) => `"${t}"`).join(', ')}]`,
        `created: ${entry.createdAt.toISOString()}`,
        `updated: ${entry.updatedAt.toISOString()}`,
        '---',
        '',
      ].join('\n');

      const content = frontmatter + entry.content;

      await fs.writeFile(filePath, content, 'utf-8');
      exported++;
    }

    logger.info({ exported }, 'Export completed');
    return { exported };
  }

  private getExportPath(type: string, basePath: string): string {
    const typePathMap: Record<string, string> = {
      adr: 'decisions',
      pattern: 'knowledge',
      knowledge: 'knowledge',
      troubleshooting: 'knowledge',
      context: 'contexts',
      module: 'modules',
      team: 'team',
    };

    return path.join(basePath, typePathMap[type] ?? 'other');
  }

  private sanitizeFileName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}

// Singleton instance
let migrationService: MigrationService | null = null;

export function getMigrationService(): MigrationService {
  if (!migrationService) {
    migrationService = new MigrationService();
  }
  return migrationService;
}
