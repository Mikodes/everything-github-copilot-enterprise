/**
 * CLAUDE.md Parser
 *
 * Parses Claude Code's CLAUDE.md format and converts it to EGCE Memory Bank format.
 * CLAUDE.md is the main configuration file for Claude Code projects.
 */

import fs from 'fs-extra';
import path from 'path';

// Types
export interface ClaudeMdSection {
  title: string;
  content: string;
  level: number;
  children: ClaudeMdSection[];
}

export interface ClaudeMdParsed {
  projectName: string | null;
  description: string | null;
  sections: ClaudeMdSection[];
  codeBlocks: CodeBlock[];
  metadata: ClaudeMdMetadata;
}

export interface CodeBlock {
  language: string;
  content: string;
  context: string;
}

export interface ClaudeMdMetadata {
  hasRules: boolean;
  hasInstructions: boolean;
  hasContext: boolean;
  hasTechStack: boolean;
  hasArchitecture: boolean;
  hasConventions: boolean;
  hasCommands: boolean;
}

export interface MemoryBankConversion {
  projectContext: ProjectContextData;
  teamContext: TeamContextData | null;
  knowledge: KnowledgeEntryData[];
  decisions: DecisionRecordData[];
  instructions: InstructionData[];
}

export interface ProjectContextData {
  name: string;
  description: string;
  version: string;
  lastUpdated: string;
  status: string;
  technicalStack: TechnicalStack;
  architecture: ArchitectureInfo;
  conventions: ConventionSet;
}

export interface TeamContextData {
  name: string;
  description: string;
  members: string[];
  roles: string[];
  conventions: string[];
}

export interface KnowledgeEntryData {
  id: string;
  title: string;
  type: 'pattern' | 'antipattern' | 'troubleshooting' | 'best-practice' | 'rule';
  content: string;
  tags: string[];
}

export interface DecisionRecordData {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string;
}

export interface InstructionData {
  name: string;
  description: string;
  content: string;
  applyWhen: string[];
}

export interface TechnicalStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  infrastructure: string[];
  tools: string[];
}

export interface ArchitectureInfo {
  style: string;
  patterns: string[];
  layers: string[];
  description: string;
}

export interface ConventionSet {
  naming: string[];
  codeStyle: string[];
  testing: string[];
  git: string[];
  other: string[];
}

/**
 * Claude MD Parser
 *
 * Parses CLAUDE.md files and extracts structured information for conversion
 * to EGCE Memory Bank format.
 */
export class ClaudeMdParser {
  private content: string = '';
  private sections: ClaudeMdSection[] = [];

  /**
   * Parse a CLAUDE.md file
   */
  async parse(filePath: string): Promise<ClaudeMdParsed> {
    this.content = await fs.readFile(filePath, 'utf-8');
    this.sections = this.parseSections(this.content);

    const projectName = this.extractProjectName();
    const description = this.extractDescription();
    const codeBlocks = this.extractCodeBlocks();
    const metadata = this.analyzeMetadata();

    return {
      projectName,
      description,
      sections: this.sections,
      codeBlocks,
      metadata,
    };
  }

  /**
   * Parse content directly (without file)
   */
  parseContent(content: string): ClaudeMdParsed {
    this.content = content;
    this.sections = this.parseSections(content);

    const projectName = this.extractProjectName();
    const description = this.extractDescription();
    const codeBlocks = this.extractCodeBlocks();
    const metadata = this.analyzeMetadata();

    return {
      projectName,
      description,
      sections: this.sections,
      codeBlocks,
      metadata,
    };
  }

  /**
   * Convert parsed CLAUDE.md to Memory Bank format
   */
  convert(parsed: ClaudeMdParsed): MemoryBankConversion {
    const projectContext = this.buildProjectContext(parsed);
    const teamContext = this.buildTeamContext(parsed);
    const knowledge = this.extractKnowledge(parsed);
    const decisions = this.extractDecisions(parsed);
    const instructions = this.extractInstructions(parsed);

    return {
      projectContext,
      teamContext,
      knowledge,
      decisions,
      instructions,
    };
  }

  /**
   * Parse and convert in one step
   */
  async parseAndConvert(filePath: string): Promise<MemoryBankConversion> {
    const parsed = await this.parse(filePath);
    return this.convert(parsed);
  }

  // Private parsing methods

  private parseSections(content: string): ClaudeMdSection[] {
    const lines = content.split('\n');
    const sections: ClaudeMdSection[] = [];
    let currentSection: ClaudeMdSection | null = null;
    let sectionStack: ClaudeMdSection[] = [];
    let contentBuffer: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section content
        if (currentSection) {
          currentSection.content = contentBuffer.join('\n').trim();
        }

        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();

        const newSection: ClaudeMdSection = {
          title,
          level,
          content: '',
          children: [],
        };

        // Find parent section
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }

        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].children.push(newSection);
        } else {
          sections.push(newSection);
        }

        sectionStack.push(newSection);
        currentSection = newSection;
        contentBuffer = [];
      } else {
        contentBuffer.push(line);
      }
    }

    // Save last section content
    if (currentSection) {
      currentSection.content = contentBuffer.join('\n').trim();
    }

    return sections;
  }

  private extractProjectName(): string | null {
    // Try to find project name from first H1 heading
    const h1Section = this.sections.find(s => s.level === 1);
    if (h1Section) {
      // Clean up title (remove emojis, "Claude Code", etc.)
      return h1Section.title
        .replace(/[^\w\s-]/g, '')
        .replace(/claude\s*code/i, '')
        .trim() || null;
    }

    // Try to find from content
    const projectMatch = this.content.match(/project[:\s]+([^\n]+)/i);
    if (projectMatch) {
      return projectMatch[1].trim();
    }

    return null;
  }

  private extractDescription(): string | null {
    // Look for description in first paragraph after H1
    const h1Section = this.sections.find(s => s.level === 1);
    if (h1Section && h1Section.content) {
      const firstParagraph = h1Section.content.split('\n\n')[0];
      if (firstParagraph && !firstParagraph.startsWith('-') && !firstParagraph.startsWith('#')) {
        return firstParagraph.trim();
      }
    }

    // Look for explicit description section
    const descSection = this.findSection(['description', 'about', 'overview']);
    if (descSection) {
      return descSection.content.split('\n\n')[0].trim();
    }

    return null;
  }

  private extractCodeBlocks(): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(this.content)) !== null) {
      const startIndex = match.index;
      const contextStart = Math.max(0, startIndex - 200);
      const context = this.content.slice(contextStart, startIndex).trim();

      codeBlocks.push({
        language: match[1] || 'text',
        content: match[2].trim(),
        context,
      });
    }

    return codeBlocks;
  }

  private analyzeMetadata(): ClaudeMdMetadata {
    const contentLower = this.content.toLowerCase();
    const sectionTitles = this.getAllSectionTitles().map(t => t.toLowerCase());

    return {
      hasRules: sectionTitles.some(t => t.includes('rule')) ||
        contentLower.includes('rules:') ||
        contentLower.includes('## rules'),
      hasInstructions: sectionTitles.some(t => t.includes('instruction')) ||
        contentLower.includes('instructions:'),
      hasContext: sectionTitles.some(t => t.includes('context')) ||
        contentLower.includes('context:'),
      hasTechStack: sectionTitles.some(t =>
        t.includes('stack') || t.includes('tech') || t.includes('dependencies')
      ),
      hasArchitecture: sectionTitles.some(t =>
        t.includes('architect') || t.includes('structure') || t.includes('pattern')
      ),
      hasConventions: sectionTitles.some(t =>
        t.includes('convention') || t.includes('style') || t.includes('standard')
      ),
      hasCommands: sectionTitles.some(t =>
        t.includes('command') || t.includes('script') || t.includes('task')
      ),
    };
  }

  private getAllSectionTitles(): string[] {
    const titles: string[] = [];

    const collectTitles = (sections: ClaudeMdSection[]) => {
      for (const section of sections) {
        titles.push(section.title);
        collectTitles(section.children);
      }
    };

    collectTitles(this.sections);
    return titles;
  }

  private findSection(keywords: string[]): ClaudeMdSection | null {
    const searchSections = (sections: ClaudeMdSection[]): ClaudeMdSection | null => {
      for (const section of sections) {
        const titleLower = section.title.toLowerCase();
        if (keywords.some(k => titleLower.includes(k))) {
          return section;
        }
        const found = searchSections(section.children);
        if (found) return found;
      }
      return null;
    };

    return searchSections(this.sections);
  }

  private findAllSections(keywords: string[]): ClaudeMdSection[] {
    const results: ClaudeMdSection[] = [];

    const searchSections = (sections: ClaudeMdSection[]) => {
      for (const section of sections) {
        const titleLower = section.title.toLowerCase();
        if (keywords.some(k => titleLower.includes(k))) {
          results.push(section);
        }
        searchSections(section.children);
      }
    };

    searchSections(this.sections);
    return results;
  }

  // Conversion methods

  private buildProjectContext(parsed: ClaudeMdParsed): ProjectContextData {
    const techStack = this.extractTechStack(parsed);
    const architecture = this.extractArchitecture(parsed);
    const conventions = this.extractConventions(parsed);

    return {
      name: parsed.projectName || 'Migrated Project',
      description: parsed.description || 'Project migrated from Claude Code configuration',
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'active',
      technicalStack: techStack,
      architecture,
      conventions,
    };
  }

  private extractTechStack(parsed: ClaudeMdParsed): TechnicalStack {
    const stack: TechnicalStack = {
      languages: [],
      frameworks: [],
      databases: [],
      infrastructure: [],
      tools: [],
    };

    // Find tech stack section
    const techSection = this.findSection(['stack', 'tech', 'dependencies', 'tools']);
    if (techSection) {
      const content = techSection.content + '\n' + techSection.children.map(c => c.content).join('\n');

      // Extract from bullet points
      const bullets = this.extractBulletPoints(content);

      // Categorize technologies
      for (const item of bullets) {
        const itemLower = item.toLowerCase();

        // Languages
        if (this.matchesAny(itemLower, ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c#', 'csharp', 'ruby', 'php', 'kotlin', 'swift'])) {
          stack.languages.push(item);
        }
        // Frameworks
        else if (this.matchesAny(itemLower, ['react', 'vue', 'angular', 'next', 'nuxt', 'express', 'nest', 'spring', 'django', 'flask', 'rails', 'laravel', '.net', 'blazor'])) {
          stack.frameworks.push(item);
        }
        // Databases
        else if (this.matchesAny(itemLower, ['postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'dynamodb', 'cassandra', 'neo4j', 'elasticsearch'])) {
          stack.databases.push(item);
        }
        // Infrastructure
        else if (this.matchesAny(itemLower, ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'vercel', 'netlify', 'heroku'])) {
          stack.infrastructure.push(item);
        }
        // Tools
        else {
          stack.tools.push(item);
        }
      }
    }

    // Also extract from code blocks
    for (const block of parsed.codeBlocks) {
      if (block.language && !stack.languages.includes(block.language)) {
        const lang = this.normalizeLanguage(block.language);
        if (lang && !stack.languages.includes(lang)) {
          stack.languages.push(lang);
        }
      }
    }

    return stack;
  }

  private extractArchitecture(parsed: ClaudeMdParsed): ArchitectureInfo {
    const archSection = this.findSection(['architect', 'structure', 'design']);

    const architecture: ArchitectureInfo = {
      style: 'Unknown',
      patterns: [],
      layers: [],
      description: '',
    };

    if (archSection) {
      const content = archSection.content;
      architecture.description = content.split('\n\n')[0] || '';

      // Detect architecture style
      const contentLower = content.toLowerCase();
      if (contentLower.includes('microservice')) {
        architecture.style = 'Microservices';
      } else if (contentLower.includes('monolith')) {
        architecture.style = 'Monolith';
      } else if (contentLower.includes('serverless')) {
        architecture.style = 'Serverless';
      } else if (contentLower.includes('hexagonal') || contentLower.includes('clean architecture')) {
        architecture.style = 'Clean/Hexagonal';
      } else if (contentLower.includes('mvc')) {
        architecture.style = 'MVC';
      } else if (contentLower.includes('event-driven') || contentLower.includes('event driven')) {
        architecture.style = 'Event-Driven';
      }

      // Extract patterns
      const patternKeywords = ['pattern', 'repository', 'factory', 'singleton', 'observer', 'strategy', 'cqrs', 'saga', 'ddd'];
      for (const keyword of patternKeywords) {
        if (contentLower.includes(keyword)) {
          architecture.patterns.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
        }
      }

      // Extract layers
      const layerMatches = content.match(/(?:layer|tier)[s]?[:\s]+([^\n]+)/gi);
      if (layerMatches) {
        for (const match of layerMatches) {
          const layers = this.extractBulletPoints(match);
          architecture.layers.push(...layers);
        }
      }
    }

    return architecture;
  }

  private extractConventions(parsed: ClaudeMdParsed): ConventionSet {
    const conventions: ConventionSet = {
      naming: [],
      codeStyle: [],
      testing: [],
      git: [],
      other: [],
    };

    // Find convention sections
    const conventionSections = this.findAllSections(['convention', 'style', 'standard', 'rule', 'guideline']);

    for (const section of conventionSections) {
      const titleLower = section.title.toLowerCase();
      const bullets = this.extractBulletPoints(section.content);

      if (titleLower.includes('naming') || titleLower.includes('name')) {
        conventions.naming.push(...bullets);
      } else if (titleLower.includes('style') || titleLower.includes('code')) {
        conventions.codeStyle.push(...bullets);
      } else if (titleLower.includes('test')) {
        conventions.testing.push(...bullets);
      } else if (titleLower.includes('git') || titleLower.includes('commit') || titleLower.includes('branch')) {
        conventions.git.push(...bullets);
      } else {
        conventions.other.push(...bullets);
      }
    }

    return conventions;
  }

  private buildTeamContext(parsed: ClaudeMdParsed): TeamContextData | null {
    const teamSection = this.findSection(['team', 'contributor', 'maintainer']);

    if (!teamSection) return null;

    const members = this.extractBulletPoints(teamSection.content)
      .filter(item => item.includes('@') || item.match(/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/));

    return {
      name: 'Development Team',
      description: teamSection.content.split('\n')[0] || 'Project team',
      members,
      roles: [],
      conventions: [],
    };
  }

  private extractKnowledge(parsed: ClaudeMdParsed): KnowledgeEntryData[] {
    const knowledge: KnowledgeEntryData[] = [];
    let kbIndex = 1;

    // Extract rules as knowledge
    const ruleSections = this.findAllSections(['rule', 'guideline', 'best practice', 'important']);

    for (const section of ruleSections) {
      const rules = this.extractBulletPoints(section.content);

      for (const rule of rules) {
        if (rule.length > 20) { // Only meaningful rules
          knowledge.push({
            id: `KB-${String(kbIndex++).padStart(4, '0')}`,
            title: this.generateTitle(rule),
            type: 'rule',
            content: rule,
            tags: this.extractTags(rule),
          });
        }
      }
    }

    // Extract patterns
    const patternSections = this.findAllSections(['pattern', 'example', 'practice']);

    for (const section of patternSections) {
      if (section.content.length > 50) {
        knowledge.push({
          id: `KB-${String(kbIndex++).padStart(4, '0')}`,
          title: section.title,
          type: 'pattern',
          content: section.content,
          tags: this.extractTags(section.content),
        });
      }
    }

    // Extract anti-patterns
    const antipatternSections = this.findAllSections(['avoid', 'don\'t', 'never', 'antipattern', 'anti-pattern']);

    for (const section of antipatternSections) {
      const items = this.extractBulletPoints(section.content);

      for (const item of items) {
        if (item.length > 20) {
          knowledge.push({
            id: `KB-${String(kbIndex++).padStart(4, '0')}`,
            title: this.generateTitle(item),
            type: 'antipattern',
            content: item,
            tags: this.extractTags(item),
          });
        }
      }
    }

    return knowledge;
  }

  private extractDecisions(parsed: ClaudeMdParsed): DecisionRecordData[] {
    const decisions: DecisionRecordData[] = [];
    let adrIndex = 1;

    // Find decision sections
    const decisionSections = this.findAllSections(['decision', 'choice', 'rationale', 'why']);

    for (const section of decisionSections) {
      if (section.content.length > 50) {
        decisions.push({
          id: `ADR-${String(adrIndex++).padStart(4, '0')}`,
          title: section.title,
          status: 'accepted',
          context: this.extractContext(section.content),
          decision: section.content,
          consequences: this.extractConsequences(section.content),
        });
      }
    }

    return decisions;
  }

  private extractInstructions(parsed: ClaudeMdParsed): InstructionData[] {
    const instructions: InstructionData[] = [];

    // Find instruction sections
    const instructionSections = this.findAllSections(['instruction', 'how to', 'workflow', 'process', 'procedure']);

    for (const section of instructionSections) {
      if (section.content.length > 50) {
        instructions.push({
          name: this.slugify(section.title),
          description: section.title,
          content: section.content,
          applyWhen: this.extractApplyConditions(section),
        });
      }
    }

    // Also extract from explicit "When..." patterns
    const whenMatches = this.content.match(/when\s+([^,.\n]+)[,.]?\s*([^\n]+)/gi);
    if (whenMatches) {
      for (const match of whenMatches) {
        const parts = match.match(/when\s+([^,.\n]+)[,.]?\s*([^\n]+)/i);
        if (parts && parts[2] && parts[2].length > 20) {
          instructions.push({
            name: `when-${this.slugify(parts[1].slice(0, 30))}`,
            description: `When ${parts[1]}`,
            content: parts[2],
            applyWhen: [parts[1].trim()],
          });
        }
      }
    }

    return instructions;
  }

  // Helper methods

  private extractBulletPoints(content: string): string[] {
    const bullets: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^[\s]*[-*+]\s+(.+)$/);
      if (match) {
        bullets.push(match[1].trim());
      }
    }

    return bullets;
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k.toLowerCase()));
  }

  private normalizeLanguage(lang: string): string | null {
    const langMap: Record<string, string> = {
      'ts': 'TypeScript',
      'typescript': 'TypeScript',
      'js': 'JavaScript',
      'javascript': 'JavaScript',
      'py': 'Python',
      'python': 'Python',
      'rb': 'Ruby',
      'ruby': 'Ruby',
      'java': 'Java',
      'go': 'Go',
      'rust': 'Rust',
      'cs': 'C#',
      'csharp': 'C#',
      'cpp': 'C++',
      'c': 'C',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
    };

    return langMap[lang.toLowerCase()] || null;
  }

  private generateTitle(content: string): string {
    // Generate a title from content
    const firstSentence = content.split(/[.!?]/)[0];
    if (firstSentence.length <= 60) {
      return firstSentence.trim();
    }
    return firstSentence.slice(0, 57).trim() + '...';
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const contentLower = content.toLowerCase();

    // Common tag keywords
    const tagKeywords = [
      'typescript', 'javascript', 'react', 'node', 'api', 'database', 'testing',
      'security', 'performance', 'error', 'logging', 'authentication', 'validation',
      'naming', 'style', 'convention', 'pattern', 'architecture', 'git', 'commit'
    ];

    for (const keyword of tagKeywords) {
      if (contentLower.includes(keyword)) {
        tags.push(keyword);
      }
    }

    return tags.slice(0, 5); // Limit to 5 tags
  }

  private extractContext(content: string): string {
    // Try to find context markers
    const contextMatch = content.match(/(?:context|background|problem)[:\s]+([^\n]+(?:\n[^\n#]+)*)/i);
    if (contextMatch) {
      return contextMatch[1].trim();
    }
    return content.split('\n\n')[0] || content.slice(0, 200);
  }

  private extractConsequences(content: string): string {
    // Try to find consequences markers
    const consequencesMatch = content.match(/(?:consequence|result|impact|outcome)[s]?[:\s]+([^\n]+(?:\n[^\n#]+)*)/i);
    if (consequencesMatch) {
      return consequencesMatch[1].trim();
    }
    return 'See decision content for details.';
  }

  private extractApplyConditions(section: ClaudeMdSection): string[] {
    const conditions: string[] = [];
    const contentLower = section.content.toLowerCase();

    // Look for "when" patterns
    const whenMatches = section.content.match(/when\s+([^,.\n]+)/gi);
    if (whenMatches) {
      for (const match of whenMatches) {
        conditions.push(match.replace(/^when\s+/i, '').trim());
      }
    }

    // Infer from title
    if (section.title.toLowerCase().includes('review')) {
      conditions.push('reviewing code');
    }
    if (section.title.toLowerCase().includes('test')) {
      conditions.push('writing tests');
    }
    if (section.title.toLowerCase().includes('commit')) {
      conditions.push('committing code');
    }

    return conditions.length > 0 ? conditions : ['general development'];
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50);
  }
}

// Export singleton instance
export const claudeMdParser = new ClaudeMdParser();
