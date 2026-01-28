/**
 * Claude Code Agents Parser
 *
 * Parses Claude Code agent definitions and converts them to EGCE agent format.
 * Claude Code agents are markdown files with specific structure defining AI agent behaviors.
 */

import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';

// Types
export interface ClaudeAgentParsed {
  name: string;
  slug: string;
  description: string;
  role: string;
  capabilities: string[];
  instructions: string[];
  examples: AgentExample[];
  triggers: string[];
  tools: string[];
  constraints: string[];
  metadata: AgentMetadata;
  rawContent: string;
}

export interface AgentExample {
  scenario: string;
  input: string;
  output: string;
}

export interface AgentMetadata {
  hasExamples: boolean;
  hasTools: boolean;
  hasConstraints: boolean;
  hasTriggers: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

export interface EGCEAgent {
  name: string;
  slug: string;
  description: string;
  role: string;
  expertise: string[];
  responsibilities: string[];
  instructions: AgentInstruction[];
  examples: AgentExample[];
  tools: AgentTool[];
  constraints: string[];
  triggers: AgentTrigger[];
  version: string;
  lastUpdated: string;
}

export interface AgentInstruction {
  category: string;
  items: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  required: boolean;
}

export interface AgentTrigger {
  condition: string;
  action: string;
}

export interface AgentConversionResult {
  agents: EGCEAgent[];
  warnings: ConversionWarning[];
  summary: ConversionSummary;
}

export interface ConversionWarning {
  agent: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConversionSummary {
  totalParsed: number;
  totalConverted: number;
  withExamples: number;
  withTools: number;
  averageComplexity: string;
}

/**
 * Claude Code Agents Parser
 *
 * Parses agent markdown files from Claude Code format and converts them
 * to EGCE agent format.
 */
export class AgentsParser {
  private warnings: ConversionWarning[] = [];

  /**
   * Parse a single agent file
   */
  async parseAgentFile(filePath: string): Promise<ClaudeAgentParsed> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));

    return this.parseAgentContent(content, fileName);
  }

  /**
   * Parse agent content directly
   */
  parseAgentContent(content: string, name: string): ClaudeAgentParsed {
    const sections = this.parseSections(content);

    const agent: ClaudeAgentParsed = {
      name: this.extractAgentName(sections, name),
      slug: this.slugify(name),
      description: this.extractDescription(sections),
      role: this.extractRole(sections),
      capabilities: this.extractCapabilities(sections),
      instructions: this.extractInstructions(sections),
      examples: this.extractExamples(sections, content),
      triggers: this.extractTriggers(sections, content),
      tools: this.extractTools(sections, content),
      constraints: this.extractConstraints(sections, content),
      metadata: {
        hasExamples: false,
        hasTools: false,
        hasConstraints: false,
        hasTriggers: false,
        estimatedComplexity: 'simple',
      },
      rawContent: content,
    };

    // Update metadata
    agent.metadata.hasExamples = agent.examples.length > 0;
    agent.metadata.hasTools = agent.tools.length > 0;
    agent.metadata.hasConstraints = agent.constraints.length > 0;
    agent.metadata.hasTriggers = agent.triggers.length > 0;
    agent.metadata.estimatedComplexity = this.estimateComplexity(agent);

    return agent;
  }

  /**
   * Parse all agents from a directory
   */
  async parseAgentsDirectory(dirPath: string): Promise<ClaudeAgentParsed[]> {
    const agents: ClaudeAgentParsed[] = [];

    // Find all markdown files
    const files = await glob.glob('**/*.md', { cwd: dirPath });

    for (const file of files) {
      // Skip non-agent files
      if (file.toLowerCase().includes('readme') || file.startsWith('_')) {
        continue;
      }

      const filePath = path.join(dirPath, file);
      try {
        const agent = await this.parseAgentFile(filePath);
        agents.push(agent);
      } catch (error) {
        this.warnings.push({
          agent: file,
          message: `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    return agents;
  }

  /**
   * Convert parsed agents to EGCE format
   */
  convert(parsedAgents: ClaudeAgentParsed[]): AgentConversionResult {
    this.warnings = [];
    const agents: EGCEAgent[] = [];

    for (const parsed of parsedAgents) {
      try {
        const converted = this.convertAgent(parsed);
        agents.push(converted);
      } catch (error) {
        this.warnings.push({
          agent: parsed.name,
          message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    const summary = this.generateSummary(parsedAgents, agents);

    return {
      agents,
      warnings: this.warnings,
      summary,
    };
  }

  /**
   * Parse and convert in one step
   */
  async parseAndConvert(dirPath: string): Promise<AgentConversionResult> {
    const parsed = await this.parseAgentsDirectory(dirPath);
    return this.convert(parsed);
  }

  // Private parsing methods

  private parseSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = 'header';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentContent.length > 0) {
          sections.set(currentSection.toLowerCase(), currentContent.join('\n').trim());
        }

        currentSection = headerMatch[2];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentContent.length > 0) {
      sections.set(currentSection.toLowerCase(), currentContent.join('\n').trim());
    }

    return sections;
  }

  private extractAgentName(sections: Map<string, string>, fileName: string): string {
    // Try to find name from header section (first H1)
    for (const [key, value] of sections) {
      if (key === 'header' && value) {
        const firstLine = value.split('\n')[0];
        if (firstLine && !firstLine.startsWith('-')) {
          return firstLine.replace(/[*_`#]/g, '').trim();
        }
      }
    }

    // Generate from filename
    return fileName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/agent$/i, 'Agent')
      .trim();
  }

  private extractDescription(sections: Map<string, string>): string {
    // Look for description section
    for (const [key, value] of sections) {
      if (key.includes('description') || key.includes('about') || key.includes('overview')) {
        return value.split('\n\n')[0].trim();
      }
    }

    // Use first paragraph of header
    const header = sections.get('header');
    if (header) {
      const paragraphs = header.split('\n\n');
      for (const p of paragraphs) {
        if (p && !p.startsWith('-') && !p.startsWith('#') && p.length > 20) {
          return p.trim();
        }
      }
    }

    return 'AI agent migrated from Claude Code configuration';
  }

  private extractRole(sections: Map<string, string>): string {
    // Look for role section
    for (const [key, value] of sections) {
      if (key.includes('role') || key.includes('purpose') || key.includes('function')) {
        return value.split('\n')[0].trim();
      }
    }

    // Infer from description
    const desc = this.extractDescription(sections);
    if (desc.length > 0) {
      const firstSentence = desc.split(/[.!?]/)[0];
      if (firstSentence.length <= 100) {
        return firstSentence.trim();
      }
    }

    return 'General-purpose AI assistant';
  }

  private extractCapabilities(sections: Map<string, string>): string[] {
    const capabilities: string[] = [];

    // Look for capabilities/skills/abilities section
    for (const [key, value] of sections) {
      if (key.includes('capabilit') || key.includes('skill') || key.includes('abilit') || key.includes('can do')) {
        const bullets = this.extractBulletPoints(value);
        capabilities.push(...bullets);
      }
    }

    return capabilities;
  }

  private extractInstructions(sections: Map<string, string>): string[] {
    const instructions: string[] = [];

    // Look for instructions/rules/guidelines section
    for (const [key, value] of sections) {
      if (key.includes('instruction') || key.includes('rule') || key.includes('guideline') || key.includes('behavior')) {
        const bullets = this.extractBulletPoints(value);
        instructions.push(...bullets);
      }
    }

    // Also look for "should", "must", "always", "never" patterns
    for (const [, value] of sections) {
      const patterns = [
        /(?:should|must|always)\s+([^.\n]+)/gi,
        /(?:never|don't|do not)\s+([^.\n]+)/gi,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(value)) !== null) {
          const instruction = match[0].trim();
          if (instruction.length > 10 && !instructions.includes(instruction)) {
            instructions.push(instruction);
          }
        }
      }
    }

    return instructions.slice(0, 20); // Limit to 20 instructions
  }

  private extractExamples(sections: Map<string, string>, content: string): AgentExample[] {
    const examples: AgentExample[] = [];

    // Look for examples section
    for (const [key, value] of sections) {
      if (key.includes('example') || key.includes('sample') || key.includes('usage')) {
        // Try to parse structured examples
        const exampleBlocks = value.split(/\n---\n|\n\n(?=\*\*|#{1,3})/);

        for (const block of exampleBlocks) {
          if (block.trim().length < 20) continue;

          const example = this.parseExampleBlock(block);
          if (example) {
            examples.push(example);
          }
        }
      }
    }

    // Look for code blocks as examples
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    let exampleIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null && examples.length < 5) {
      const contextStart = Math.max(0, match.index - 150);
      const context = content.slice(contextStart, match.index).trim();

      // Only include if it looks like an example
      if (context.toLowerCase().includes('example') || context.toLowerCase().includes('usage')) {
        examples.push({
          scenario: `Example ${++exampleIndex}`,
          input: context.split('\n').pop() || 'User request',
          output: match[2].trim(),
        });
      }
    }

    return examples.slice(0, 5); // Limit to 5 examples
  }

  private parseExampleBlock(block: string): AgentExample | null {
    const lines = block.trim().split('\n');

    // Try to identify input/output patterns
    let scenario = '';
    let input = '';
    let output = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();

      if (lineLower.includes('scenario') || lineLower.includes('case')) {
        scenario = line.replace(/^[*_]*scenario[:\s]*/i, '').trim();
      } else if (lineLower.includes('input') || lineLower.includes('request') || lineLower.includes('user')) {
        input = line.replace(/^[*_]*(?:input|request|user)[:\s]*/i, '').trim();
        // Check if next line is the actual input
        if (!input && i + 1 < lines.length) {
          input = lines[i + 1].trim();
        }
      } else if (lineLower.includes('output') || lineLower.includes('response') || lineLower.includes('assistant')) {
        output = line.replace(/^[*_]*(?:output|response|assistant)[:\s]*/i, '').trim();
        // Collect remaining lines as output
        if (!output) {
          output = lines.slice(i + 1).join('\n').trim();
        }
      }
    }

    if (input || output) {
      return {
        scenario: scenario || 'Usage example',
        input: input || 'User request',
        output: output || block,
      };
    }

    return null;
  }

  private extractTriggers(sections: Map<string, string>, content: string): string[] {
    const triggers: string[] = [];

    // Look for triggers/activation section
    for (const [key, value] of sections) {
      if (key.includes('trigger') || key.includes('activ') || key.includes('when to use') || key.includes('invoke')) {
        const bullets = this.extractBulletPoints(value);
        triggers.push(...bullets);
      }
    }

    // Look for "when" patterns
    const whenMatches = content.match(/(?:activate|invoke|use this agent|trigger)[\s\S]{0,20}when\s+([^.\n]+)/gi);
    if (whenMatches) {
      for (const match of whenMatches) {
        const trigger = match.match(/when\s+([^.\n]+)/i);
        if (trigger && trigger[1]) {
          triggers.push(trigger[1].trim());
        }
      }
    }

    return [...new Set(triggers)]; // Remove duplicates
  }

  private extractTools(sections: Map<string, string>, content: string): string[] {
    const tools: string[] = [];

    // Look for tools section
    for (const [key, value] of sections) {
      if (key.includes('tool') || key.includes('integration') || key.includes('api') || key.includes('resource')) {
        const bullets = this.extractBulletPoints(value);
        tools.push(...bullets);
      }
    }

    // Look for common tool patterns
    const toolPatterns = [
      /uses?\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:tool|api|service)/gi,
      /(?:read|write|edit|search|execute)\s+(?:files?|code|commands?)/gi,
    ];

    for (const pattern of toolPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const tool = match[1] || match[0];
        if (tool && !tools.includes(tool)) {
          tools.push(tool.trim());
        }
      }
    }

    return [...new Set(tools)];
  }

  private extractConstraints(sections: Map<string, string>, content: string): string[] {
    const constraints: string[] = [];

    // Look for constraints/limitations section
    for (const [key, value] of sections) {
      if (key.includes('constraint') || key.includes('limitation') || key.includes('restriction') || key.includes('boundary')) {
        const bullets = this.extractBulletPoints(value);
        constraints.push(...bullets);
      }
    }

    // Look for "never", "don't", "must not" patterns
    const constraintMatches = content.match(/(?:never|don't|do not|must not|cannot|should not)\s+([^.\n]+)/gi);
    if (constraintMatches) {
      for (const match of constraintMatches) {
        if (match.length > 10 && match.length < 200) {
          constraints.push(match.trim());
        }
      }
    }

    return [...new Set(constraints)].slice(0, 15);
  }

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

  private estimateComplexity(agent: ClaudeAgentParsed): 'simple' | 'moderate' | 'complex' {
    let score = 0;

    score += agent.instructions.length * 0.5;
    score += agent.examples.length * 2;
    score += agent.tools.length * 1.5;
    score += agent.constraints.length * 1;
    score += agent.triggers.length * 0.5;

    if (score < 5) return 'simple';
    if (score < 15) return 'moderate';
    return 'complex';
  }

  // Conversion methods

  private convertAgent(parsed: ClaudeAgentParsed): EGCEAgent {
    // Group instructions by category
    const instructionCategories = this.categorizeInstructions(parsed.instructions);

    // Convert tools to EGCE format
    const tools: AgentTool[] = parsed.tools.map(tool => ({
      name: tool,
      description: `Tool: ${tool}`,
      required: false,
    }));

    // Convert triggers to EGCE format
    const triggers: AgentTrigger[] = parsed.triggers.map(trigger => ({
      condition: trigger,
      action: 'activate',
    }));

    return {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description,
      role: parsed.role,
      expertise: parsed.capabilities.slice(0, 10),
      responsibilities: this.deriveResponsibilities(parsed),
      instructions: instructionCategories,
      examples: parsed.examples,
      tools,
      constraints: parsed.constraints,
      triggers,
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
    };
  }

  private categorizeInstructions(instructions: string[]): AgentInstruction[] {
    const categories: Record<string, string[]> = {
      general: [],
      behavior: [],
      communication: [],
      quality: [],
      safety: [],
    };

    for (const instruction of instructions) {
      const lower = instruction.toLowerCase();

      if (lower.includes('always') || lower.includes('never') || lower.includes('must')) {
        categories.behavior.push(instruction);
      } else if (lower.includes('respond') || lower.includes('communicate') || lower.includes('explain') || lower.includes('ask')) {
        categories.communication.push(instruction);
      } else if (lower.includes('quality') || lower.includes('test') || lower.includes('verify') || lower.includes('check')) {
        categories.quality.push(instruction);
      } else if (lower.includes('safe') || lower.includes('security') || lower.includes('private') || lower.includes('sensitive')) {
        categories.safety.push(instruction);
      } else {
        categories.general.push(instruction);
      }
    }

    // Convert to array format, excluding empty categories
    return Object.entries(categories)
      .filter(([, items]) => items.length > 0)
      .map(([category, items]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        items,
      }));
  }

  private deriveResponsibilities(parsed: ClaudeAgentParsed): string[] {
    const responsibilities: string[] = [];

    // From capabilities
    for (const cap of parsed.capabilities.slice(0, 5)) {
      responsibilities.push(`Can ${cap.toLowerCase()}`);
    }

    // From role
    if (parsed.role) {
      responsibilities.push(parsed.role);
    }

    // Infer from name
    const nameLower = parsed.name.toLowerCase();
    if (nameLower.includes('review')) {
      responsibilities.push('Review code and provide feedback');
    }
    if (nameLower.includes('architect')) {
      responsibilities.push('Design and evaluate system architecture');
    }
    if (nameLower.includes('security')) {
      responsibilities.push('Identify security vulnerabilities');
    }
    if (nameLower.includes('test')) {
      responsibilities.push('Help with testing strategies');
    }
    if (nameLower.includes('document')) {
      responsibilities.push('Generate and maintain documentation');
    }

    return [...new Set(responsibilities)].slice(0, 8);
  }

  private generateSummary(parsed: ClaudeAgentParsed[], converted: EGCEAgent[]): ConversionSummary {
    const complexities = parsed.map(a => a.metadata.estimatedComplexity);
    const complexityScore = complexities.reduce((sum, c) => {
      if (c === 'simple') return sum + 1;
      if (c === 'moderate') return sum + 2;
      return sum + 3;
    }, 0);

    const avgComplexity = complexityScore / parsed.length;
    let avgComplexityStr: string;
    if (avgComplexity < 1.5) avgComplexityStr = 'simple';
    else if (avgComplexity < 2.5) avgComplexityStr = 'moderate';
    else avgComplexityStr = 'complex';

    return {
      totalParsed: parsed.length,
      totalConverted: converted.length,
      withExamples: parsed.filter(a => a.metadata.hasExamples).length,
      withTools: parsed.filter(a => a.metadata.hasTools).length,
      averageComplexity: avgComplexityStr,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

// Export singleton instance
export const agentsParser = new AgentsParser();
