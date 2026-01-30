/**
 * PR Context Module - US-015
 * Implements: Generación de Contexto para PRs
 *
 * This module provides automatic generation of rich context for Pull Requests,
 * including semantic diff analysis, ADR detection, pattern identification,
 * reviewer suggestions, and breaking change detection.
 *
 * Acceptance Criteria:
 * - AC-015.1: Generates PR description based on commits and context
 * - AC-015.2: Includes related ADRs with the changes
 * - AC-015.3: Lists patterns used or modified
 * - AC-015.4: Suggests reviewers based on module ownership
 * - AC-015.5: Detects potential breaking changes
 */

// Export main generator
export { PrContextGenerator, getPrContextGenerator } from './PrContextGenerator';

// Export types
export type {
  // Core types
  Commit,
  FileChange,
  ChangeCategory,
  PrContext,
  PrContextOptions,

  // Analysis types
  SemanticDiffAnalysis,
  ImpactAnalysis,

  // ADR types
  RelatedAdr,

  // Pattern types
  DetectedPattern,

  // Reviewer types
  SuggestedReviewer,
  ModuleOwnership,

  // Breaking change types
  BreakingChange,
  CodeLocation,
} from './PrContextGenerator';
