/**
 * Agent Mode Module
 * Implements US-014: Integración con Copilot Agent Mode
 *
 * This module provides integration with GitHub Copilot Agent Mode,
 * enabling automatic context provision, pattern validation, template usage,
 * and ADR generation for architectural changes.
 */

// Export main providers
export { AgentModeProvider, getAgentModeProvider } from './AgentModeProvider';
export type {
  ProjectContext,
  TechStackInfo,
  ArchitecturePattern,
  TeamStandards,
  StyleRule,
  NamingConvention,
  ArchitectureRule,
  SecurityRule,
  TestingRule,
  AdrSummary,
  ModuleInfo,
  CodeTemplate,
  TemplateVariable,
} from './AgentModeProvider';

// Export pattern validator
export { PatternValidator, getPatternValidator } from './PatternValidator';
export type {
  ValidationResult,
  PatternViolation,
  PatternWarning,
  PatternSuggestion,
  MatchedPattern,
  CodeLocation,
  AdrSuggestion,
  ValidationOptions,
  ChangeValidationResult,
  PatternChange,
  ArchitecturalImpact,
  PatternRecommendation,
} from './PatternValidator';

// Export template provider
export { TemplateProvider, getTemplateProvider } from './TemplateProvider';
export type {
  CodeTemplate as Template,
  TemplateCategory,
  TemplateVariable as TemplateVar,
  VariableValidation,
  TemplateMetadata,
  RenderResult,
  TemplateSearchOptions,
  TemplateSuggestion,
} from './TemplateProvider';

// Export ADR draft generator
export { AdrDraftGenerator, getAdrDraftGenerator } from './AdrDraftGenerator';
export type {
  Adr,
  AdrStatus,
  AdrConsequences,
  AdrAlternative,
  AdrReference,
  AdrMetadata,
  AdrGenerationOptions,
  AdrDetectionResult,
} from './AdrDraftGenerator';
