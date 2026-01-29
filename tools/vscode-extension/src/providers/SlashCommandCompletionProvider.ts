/**
 * US-008: Slash Command Completion Provider
 *
 * Provides IntelliSense auto-completion for Memory Bank slash commands
 * in comments and chat contexts.
 *
 * Supports:
 * - AC-008.5: Auto-completion of available commands
 * - Command suggestions when typing /
 * - Argument suggestions for each command
 */

import * as vscode from 'vscode';
import { MemoryBankService } from '../services/MemoryBankService';

// ============================================
// Types
// ============================================

interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  examples: string[];
  category: 'context' | 'documentation' | 'team' | 'help';
}

// ============================================
// Available Commands (mirrors backend)
// ============================================

const AVAILABLE_COMMANDS: SlashCommand[] = [
  {
    name: 'context',
    aliases: ['ctx', 'c'],
    description: 'Shows context information for the current file or module',
    usage: '/context [file-path] [--module <module-name>]',
    examples: [
      '/context',
      '/context src/services/auth.ts',
      '/context --module user-management',
    ],
    category: 'context',
  },
  {
    name: 'adr',
    aliases: ['decision', 'decisions'],
    description: 'Lists and searches Architecture Decision Records',
    usage: '/adr [search-query] [--status <status>] [--limit <n>]',
    examples: [
      '/adr',
      '/adr database',
      '/adr --status active',
      '/adr authentication --limit 5',
    ],
    category: 'documentation',
  },
  {
    name: 'pattern',
    aliases: ['patterns', 'pat'],
    description: 'Searches documented design patterns in the Memory Bank',
    usage: '/pattern [search-query] [--category <category>]',
    examples: [
      '/pattern',
      '/pattern repository',
      '/pattern --category creational',
    ],
    category: 'documentation',
  },
  {
    name: 'team',
    aliases: ['conventions', 'rules'],
    description: 'Shows team conventions, coding standards, and contacts',
    usage: '/team [section] [--role <role>]',
    examples: [
      '/team',
      '/team conventions',
      '/team contacts',
    ],
    category: 'team',
  },
  {
    name: 'help',
    aliases: ['?', 'h'],
    description: 'Shows help information for available slash commands',
    usage: '/help [command-name]',
    examples: [
      '/help',
      '/help context',
      '/help adr',
    ],
    category: 'help',
  },
];

// ============================================
// Completion Provider
// ============================================

export class SlashCommandCompletionProvider
  implements vscode.CompletionItemProvider
{
  private memoryBankService: MemoryBankService;
  private commandMap: Map<string, SlashCommand>;

  constructor(memoryBankService: MemoryBankService) {
    this.memoryBankService = memoryBankService;
    this.commandMap = new Map();

    // Build command lookup map
    for (const cmd of AVAILABLE_COMMANDS) {
      this.commandMap.set(cmd.name, cmd);
      for (const alias of cmd.aliases) {
        this.commandMap.set(alias, cmd);
      }
    }
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
    const lineText = document.lineAt(position).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // Check if we're in a comment or at the start of a line that could be a command
    if (!this.isSlashCommandContext(document, position, textBeforeCursor)) {
      return undefined;
    }

    // Find the slash command part
    const slashMatch = textBeforeCursor.match(/\/(\w*)$/);
    if (!slashMatch) {
      return undefined;
    }

    const partial = slashMatch[1].toLowerCase();
    const completions: vscode.CompletionItem[] = [];

    // If just "/" or partial command, suggest commands
    if (partial === '' || !this.isCompleteCommand(partial)) {
      completions.push(...this.getCommandCompletions(partial));
    } else {
      // Suggest arguments for the command
      completions.push(...this.getArgumentCompletions(textBeforeCursor));
    }

    return completions;
  }

  /**
   * Check if cursor is in a valid context for slash commands
   */
  private isSlashCommandContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    textBeforeCursor: string
  ): boolean {
    // Check if we're in a comment
    const lineText = document.lineAt(position).text.trim();

    // Common comment patterns
    const commentPatterns = [
      /^\/\//, // Single-line comment (JS, TS, etc.)
      /^\/\*/, // Multi-line comment start
      /^\*/, // Inside multi-line comment
      /^#/, // Shell, Python, Ruby comments
      /^--/, // SQL, Lua comments
      /^<!--/, // HTML comment
      /^{\/\*/, // JSX comment
    ];

    // Check if line starts with a comment pattern
    const isInComment = commentPatterns.some((pattern) =>
      pattern.test(lineText)
    );

    // Also allow in markdown files (for documentation)
    const isMarkdown =
      document.languageId === 'markdown' ||
      document.fileName.endsWith('.md');

    // Allow in chat-like contexts (special file types)
    const isChatContext =
      document.languageId === 'copilot-chat' ||
      document.fileName.includes('.chat');

    // Check if the slash is at the start of a line or after whitespace
    const hasSlashStart = /(?:^|\s)\/\w*$/.test(textBeforeCursor);

    return (isInComment || isMarkdown || isChatContext) && hasSlashStart;
  }

  /**
   * Check if the given string is a complete command name
   */
  private isCompleteCommand(text: string): boolean {
    return this.commandMap.has(text);
  }

  /**
   * Get completion items for commands
   */
  private getCommandCompletions(partial: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];
    const seenCommands = new Set<string>();

    for (const cmd of AVAILABLE_COMMANDS) {
      // Check main command name
      if (cmd.name.startsWith(partial)) {
        if (!seenCommands.has(cmd.name)) {
          seenCommands.add(cmd.name);
          completions.push(this.createCommandCompletion(cmd, cmd.name));
        }
      }

      // Check aliases
      for (const alias of cmd.aliases) {
        if (alias.startsWith(partial) && !seenCommands.has(alias)) {
          seenCommands.add(alias);
          completions.push(
            this.createCommandCompletion(cmd, alias, true)
          );
        }
      }
    }

    return completions;
  }

  /**
   * Create a completion item for a command
   */
  private createCommandCompletion(
    cmd: SlashCommand,
    displayName: string,
    isAlias = false
  ): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
      displayName,
      vscode.CompletionItemKind.Function
    );

    item.detail = isAlias
      ? `${cmd.description} (alias for /${cmd.name})`
      : cmd.description;

    item.insertText = new vscode.SnippetString(`${displayName} $0`);

    // Build documentation
    const docs = new vscode.MarkdownString();
    docs.appendMarkdown(`**/${cmd.name}**\n\n`);
    docs.appendMarkdown(`${cmd.description}\n\n`);
    docs.appendMarkdown(`**Usage:** \`${cmd.usage}\`\n\n`);

    if (cmd.examples.length > 0) {
      docs.appendMarkdown('**Examples:**\n');
      for (const example of cmd.examples) {
        docs.appendMarkdown(`- \`${example}\`\n`);
      }
    }

    if (cmd.aliases.length > 0) {
      docs.appendMarkdown(`\n**Aliases:** ${cmd.aliases.map((a) => `/${a}`).join(', ')}\n`);
    }

    item.documentation = docs;

    // Set sort text to prioritize main commands over aliases
    item.sortText = isAlias ? `1-${displayName}` : `0-${displayName}`;

    // Add command category as label
    item.label = {
      label: displayName,
      description: cmd.category,
    };

    return item;
  }

  /**
   * Get completion items for command arguments
   */
  private getArgumentCompletions(textBeforeCursor: string): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    // Parse the command from the text
    const commandMatch = textBeforeCursor.match(/\/(\w+)/);
    if (!commandMatch) {
      return completions;
    }

    const commandName = commandMatch[1].toLowerCase();
    const cmd = this.commandMap.get(commandName);
    if (!cmd) {
      return completions;
    }

    // Check if we're after a flag that needs a value
    const flagMatch = textBeforeCursor.match(/--(\w+)\s*$/);
    if (flagMatch) {
      completions.push(...this.getFlagValueCompletions(cmd.name, flagMatch[1]));
      return completions;
    }

    // Suggest flags based on command
    completions.push(...this.getFlagCompletions(cmd.name, textBeforeCursor));

    return completions;
  }

  /**
   * Get flag completions for a command
   */
  private getFlagCompletions(
    commandName: string,
    textBeforeCursor: string
  ): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];
    const existingFlags = new Set(
      [...textBeforeCursor.matchAll(/--(\w+)/g)].map((m) => m[1])
    );

    const flagsByCommand: Record<string, Array<{ flag: string; description: string; values?: string[] }>> = {
      context: [
        { flag: 'module', description: 'Filter by module name' },
      ],
      adr: [
        { flag: 'status', description: 'Filter by status', values: ['active', 'deprecated', 'draft', 'superseded'] },
        { flag: 'limit', description: 'Maximum number of results' },
      ],
      pattern: [
        { flag: 'category', description: 'Filter by pattern category', values: ['creational', 'structural', 'behavioral', 'architectural'] },
        { flag: 'limit', description: 'Maximum number of results' },
      ],
      team: [
        { flag: 'role', description: 'Filter by team role' },
      ],
    };

    const flags = flagsByCommand[commandName] || [];

    for (const { flag, description } of flags) {
      if (!existingFlags.has(flag)) {
        const item = new vscode.CompletionItem(
          `--${flag}`,
          vscode.CompletionItemKind.Property
        );
        item.detail = description;
        item.insertText = new vscode.SnippetString(`--${flag} $0`);
        completions.push(item);
      }
    }

    return completions;
  }

  /**
   * Get value completions for a flag
   */
  private getFlagValueCompletions(
    commandName: string,
    flagName: string
  ): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    const valuesByFlag: Record<string, Record<string, string[]>> = {
      adr: {
        status: ['active', 'deprecated', 'draft', 'superseded'],
      },
      pattern: {
        category: ['creational', 'structural', 'behavioral', 'architectural'],
      },
      team: {
        role: ['backend', 'frontend', 'devops', 'qa', 'lead'],
      },
    };

    const values = valuesByFlag[commandName]?.[flagName] || [];

    for (const value of values) {
      const item = new vscode.CompletionItem(
        value,
        vscode.CompletionItemKind.Value
      );
      completions.push(item);
    }

    return completions;
  }

  /**
   * Resolve completion item with additional details
   */
  async resolveCompletionItem(
    item: vscode.CompletionItem,
    _token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    // Could fetch additional details from the backend here
    return item;
  }
}

/**
 * Register the slash command completion provider for relevant document types
 */
export function registerSlashCommandCompletionProvider(
  context: vscode.ExtensionContext,
  memoryBankService: MemoryBankService
): void {
  const provider = new SlashCommandCompletionProvider(memoryBankService);

  // Register for all common languages
  const languages = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
    'python',
    'java',
    'csharp',
    'go',
    'rust',
    'ruby',
    'php',
    'markdown',
    'plaintext',
    'yaml',
    'json',
    'html',
    'css',
    'scss',
    'sql',
    'shell',
    'dockerfile',
  ];

  for (const language of languages) {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        { language, scheme: 'file' },
        provider,
        '/' // Trigger on /
      )
    );
  }

  // Also register for untitled files
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'untitled' },
      provider,
      '/'
    )
  );
}
