/**
 * Parsers Index
 *
 * Central export for all Claude Code migration parsers.
 */

export { ClaudeMdParser, claudeMdParser } from './claude-md-parser.js';
export type {
  ClaudeMdParsed,
  ClaudeMdSection,
  CodeBlock,
  ClaudeMdMetadata,
  MemoryBankConversion,
  ProjectContextData,
  TeamContextData,
  KnowledgeEntryData,
  DecisionRecordData,
  InstructionData,
  TechnicalStack,
  ArchitectureInfo,
  ConventionSet,
} from './claude-md-parser.js';

export { AgentsParser, agentsParser } from './agents-parser.js';
export type {
  ClaudeAgentParsed,
  AgentExample,
  AgentMetadata,
  EGCEAgent,
  AgentInstruction,
  AgentTool,
  AgentTrigger,
  AgentConversionResult,
} from './agents-parser.js';

export { SkillsParser, skillsParser } from './skills-parser.js';
export type {
  ClaudeSkillParsed,
  SkillType,
  SkillConfig,
  SkillScope,
  SkillParameter,
  SkillExample,
  SkillMetadata,
  EGCEConfig,
  ConfigSettings,
  ConfigScope,
  ConfigRule,
  ConfigIntegration,
  SkillConversionResult,
} from './skills-parser.js';

export { CommandsParser, commandsParser } from './commands-parser.js';
export type {
  ClaudeCommandParsed,
  CommandArgument,
  CommandBehavior,
  ContextType,
  CommandExample,
  CommandMetadata,
  EGCEPrompt,
  PromptCategory,
  PromptTrigger,
  PromptTemplate,
  PromptArgument,
  PromptExample,
  PromptContext,
  PromptOutput,
  CommandConversionResult,
} from './commands-parser.js';
