/**
 * US-005: Auto Context Detection Service Tests
 *
 * Tests for automatic context detection functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AutoContextDetectionService,
  getAutoContextDetectionService,
  shutdownAutoContextDetection,
  FileAnalysisResult,
  GitContext,
  NavigationEvent,
} from '../../src/services/auto-context-detection.service.js';

describe('AutoContextDetectionService', () => {
  let service: AutoContextDetectionService;

  beforeEach(() => {
    shutdownAutoContextDetection();
    service = new AutoContextDetectionService({
      enabled: true,
      maxSuggestions: 5,
      minConfidenceThreshold: 0.3,
    });
  });

  afterEach(() => {
    shutdownAutoContextDetection();
  });

  // ============================================
  // T-005.1: File Analyzer Tests
  // ============================================

  describe('File Analysis (T-005.1)', () => {
    it('should extract basic file information', () => {
      const result = service.analyzeFile('/src/services/user.service.ts');

      expect(result.fileName).toBe('user.service.ts');
      expect(result.extension).toBe('ts');
      expect(result.language).toBe('typescript');
      expect(result.directory).toBe('/src/services');
    });

    it('should detect service file patterns', () => {
      const result = service.analyzeFile('/src/services/auth.service.ts');

      expect(result.patterns).toContain('service');
      expect(result.patterns).toContain('business-logic');
    });

    it('should detect test file patterns', () => {
      const result = service.analyzeFile('/tests/unit/user.test.ts');

      expect(result.patterns).toContain('testing');
      expect(result.patterns).toContain('unit-tests');
    });

    it('should detect spec file patterns', () => {
      const result = service.analyzeFile('/tests/user.spec.js');

      expect(result.patterns).toContain('testing');
      expect(result.patterns).toContain('unit-tests');
    });

    it('should detect e2e test patterns', () => {
      const result = service.analyzeFile('/e2e/login.e2e.ts');

      expect(result.patterns).toContain('testing');
      expect(result.patterns).toContain('e2e-tests');
    });

    it('should detect controller patterns', () => {
      const result = service.analyzeFile('/src/api/user.controller.ts');

      expect(result.patterns).toContain('api');
      expect(result.patterns).toContain('controller');
      expect(result.patterns).toContain('http');
    });

    it('should detect React hook patterns', () => {
      const result = service.analyzeFile('/src/hooks/useAuth.tsx');

      expect(result.patterns).toContain('react');
      expect(result.patterns).toContain('hooks');
    });

    it('should detect React component patterns', () => {
      const result = service.analyzeFile('/src/components/Button.tsx');

      expect(result.patterns).toContain('react');
      expect(result.patterns).toContain('ui');
      expect(result.patterns).toContain('component');
    });

    it('should detect Dockerfile patterns', () => {
      const result = service.analyzeFile('/docker/Dockerfile.production');

      expect(result.patterns).toContain('docker');
      expect(result.patterns).toContain('deployment');
    });

    it('should detect GitHub Actions patterns', () => {
      const result = service.analyzeFile('/.github/workflows/ci.yml');

      expect(result.patterns).toContain('ci-cd');
      expect(result.patterns).toContain('github-actions');
    });

    it('should detect module hints from directory structure', () => {
      const result = service.analyzeFile('/src/services/payment.service.ts');

      expect(result.moduleHints).toContain('services');
    });

    it('should detect database module hints', () => {
      const result = service.analyzeFile('/src/database/migrations/001_init.sql');

      expect(result.moduleHints).toContain('database');
    });

    it('should detect infrastructure module hints', () => {
      const result = service.analyzeFile('/infrastructure/terraform/main.tf');

      expect(result.moduleHints).toContain('infrastructure');
    });

    it('should handle various programming languages', () => {
      const cases: Array<{ path: string; expected: string }> = [
        { path: 'app.py', expected: 'python' },
        { path: 'Main.java', expected: 'java' },
        { path: 'lib.rs', expected: 'rust' },
        { path: 'main.go', expected: 'go' },
        { path: 'Program.cs', expected: 'csharp' },
        { path: 'App.kt', expected: 'kotlin' },
        { path: 'script.sh', expected: 'shell' },
        { path: 'config.yaml', expected: 'yaml' },
        { path: 'data.json', expected: 'json' },
      ];

      for (const { path, expected } of cases) {
        const result = service.analyzeFile(path);
        expect(result.language).toBe(expected);
      }
    });

    it('should handle files without extensions', () => {
      const result = service.analyzeFile('/docker/Dockerfile');

      expect(result.extension).toBe('');
      expect(result.language).toBe('unknown');
    });

    it('should normalize Windows path separators', () => {
      const result = service.analyzeFile('C:\\Users\\dev\\project\\src\\app.ts');

      expect(result.filePath).toBe('C:/Users/dev/project/src/app.ts');
      expect(result.fileName).toBe('app.ts');
    });
  });

  // ============================================
  // T-005.2: Navigation Tracker Tests
  // ============================================

  describe('Navigation Tracking (T-005.2)', () => {
    it('should record navigation events', () => {
      const event: NavigationEvent = {
        userId: 'user-123',
        projectId: 'project-456',
        filePath: '/src/index.ts',
        timestamp: Date.now(),
        duration: 5000,
      };

      service.recordNavigation(event);

      const history = service.getNavigationHistory('user-123', 'project-456');
      expect(history).toHaveLength(1);
      expect(history[0].filePath).toBe('/src/index.ts');
    });

    it('should maintain navigation history per user-project', () => {
      service.recordNavigation({
        userId: 'user-1',
        projectId: 'project-a',
        filePath: '/file1.ts',
        timestamp: Date.now(),
        duration: 1000,
      });

      service.recordNavigation({
        userId: 'user-1',
        projectId: 'project-b',
        filePath: '/file2.ts',
        timestamp: Date.now(),
        duration: 1000,
      });

      service.recordNavigation({
        userId: 'user-2',
        projectId: 'project-a',
        filePath: '/file3.ts',
        timestamp: Date.now(),
        duration: 1000,
      });

      expect(service.getNavigationHistory('user-1', 'project-a')).toHaveLength(1);
      expect(service.getNavigationHistory('user-1', 'project-b')).toHaveLength(1);
      expect(service.getNavigationHistory('user-2', 'project-a')).toHaveLength(1);
      expect(service.getNavigationHistory('user-2', 'project-b')).toHaveLength(0);
    });

    it('should limit navigation history size', () => {
      const limitedService = new AutoContextDetectionService({
        navigationHistoryLimit: 5,
      });

      for (let i = 0; i < 10; i++) {
        limitedService.recordNavigation({
          userId: 'user-1',
          projectId: 'project-1',
          filePath: `/file${i}.ts`,
          timestamp: Date.now() + i,
          duration: 1000,
        });
      }

      const history = limitedService.getNavigationHistory('user-1', 'project-1');
      expect(history).toHaveLength(5);
      // Should keep the most recent ones
      expect(history[0].filePath).toBe('/file5.ts');
      expect(history[4].filePath).toBe('/file9.ts');
    });

    it('should include moduleId when provided', () => {
      const event: NavigationEvent = {
        userId: 'user-123',
        projectId: 'project-456',
        filePath: '/src/services/auth.ts',
        moduleId: 'module-789',
        timestamp: Date.now(),
        duration: 3000,
      };

      service.recordNavigation(event);

      const history = service.getNavigationHistory('user-123', 'project-456');
      expect(history[0].moduleId).toBe('module-789');
    });
  });

  // ============================================
  // T-005.3: Git Integration Tests
  // ============================================

  describe('Git Context Parsing (T-005.3)', () => {
    it('should detect feature branches', () => {
      const cases = [
        { branch: 'feature/user-authentication', expected: true },
        { branch: 'feat/add-login', expected: true },
        { branch: 'main', expected: false },
        { branch: 'develop', expected: false },
      ];

      for (const { branch, expected } of cases) {
        const context = service.parseGitContext(branch, [], []);
        expect(context.isFeatureBranch).toBe(expected);
      }
    });

    it('should extract feature name from branch', () => {
      const context = service.parseGitContext('feature/user-authentication', [], []);

      expect(context.featureName).toBe('user-authentication');
    });

    it('should extract JIRA-style ticket IDs', () => {
      const context = service.parseGitContext('feature/PROJ-123-user-auth', [], []);

      expect(context.ticketId).toBe('PROJ-123');
    });

    it('should extract GitHub issue numbers', () => {
      const context = service.parseGitContext('fix/#456-bug-fix', [], []);

      expect(context.ticketId).toBe('456');
    });

    it('should extract ticket ID from commit messages', () => {
      const context = service.parseGitContext(
        'feature/new-feature',
        [],
        ['feat: implement login PROJ-789', 'chore: cleanup']
      );

      expect(context.ticketId).toBe('PROJ-789');
    });

    it('should preserve modified files list', () => {
      const modifiedFiles = [
        'src/auth/login.ts',
        'src/auth/logout.ts',
        'tests/auth.test.ts',
      ];

      const context = service.parseGitContext('feature/auth', modifiedFiles, []);

      expect(context.modifiedFiles).toEqual(modifiedFiles);
    });

    it('should handle bugfix branches', () => {
      const cases = [
        { branch: 'bugfix/fix-crash', expected: 'bugfix' },
        { branch: 'fix/memory-leak', expected: 'bugfix' },
        { branch: 'hotfix/security-patch', expected: 'hotfix' },
      ];

      for (const { branch } of cases) {
        const context = service.parseGitContext(branch, [], []);
        expect(context.isFeatureBranch).toBe(false);
      }
    });

    it('should handle release branches', () => {
      const context = service.parseGitContext('release/v2.0.0', [], []);

      expect(context.isFeatureBranch).toBe(false);
      expect(context.featureName).toBe('v2.0.0');
    });
  });

  // ============================================
  // T-005.4: User Preference Tests
  // ============================================

  describe('User Preferences (T-005.4)', () => {
    const mockContextEntry = {
      id: 'ctx-123',
      projectId: 'proj-456',
      moduleId: 'mod-789',
      type: 'adr' as const,
      title: 'Test ADR',
      content: 'Test content',
      contentFormat: 'markdown' as const,
      status: 'active' as const,
      supersededBy: null,
      tags: ['architecture', 'backend'],
      metadata: {},
      embedding: null,
      version: 1,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update type preferences', () => {
      service.updateUserPreference('user-1', 'proj-1', mockContextEntry, 1);
      service.updateUserPreference('user-1', 'proj-1', mockContextEntry, 1);

      const stats = service.getUserPreferenceStats('user-1', 'proj-1');
      expect(stats.topTypes.length).toBeGreaterThan(0);
      expect(stats.topTypes[0].type).toBe('adr');
    });

    it('should update module preferences', () => {
      service.updateUserPreference('user-1', 'proj-1', mockContextEntry, 1);

      const stats = service.getUserPreferenceStats('user-1', 'proj-1');
      expect(stats.topModules.length).toBeGreaterThan(0);
      expect(stats.topModules[0].moduleId).toBe('mod-789');
    });

    it('should update tag preferences', () => {
      service.updateUserPreference('user-1', 'proj-1', mockContextEntry, 1);

      const stats = service.getUserPreferenceStats('user-1', 'proj-1');
      expect(stats.topTags.length).toBeGreaterThan(0);
      expect(stats.topTags.map(t => t.tag)).toContain('architecture');
      expect(stats.topTags.map(t => t.tag)).toContain('backend');
    });

    it('should apply decay to preferences', () => {
      // First access with high weight
      service.updateUserPreference('user-1', 'proj-1', mockContextEntry, 10);

      const firstStats = service.getUserPreferenceStats('user-1', 'proj-1');
      const firstWeight = firstStats.topTypes[0].weight;

      // Second access (triggers decay)
      service.updateUserPreference('user-1', 'proj-1', { ...mockContextEntry, type: 'pattern' as const }, 1);

      const secondStats = service.getUserPreferenceStats('user-1', 'proj-1');
      const adrType = secondStats.topTypes.find(t => t.type === 'adr');

      // Weight should be decayed
      expect(adrType?.weight).toBeLessThan(firstWeight);
    });

    it('should record file-context associations', () => {
      // First create a preference entry
      service.updateUserPreference('user-1', 'proj-1', mockContextEntry, 1);

      // Then record association
      service.recordFileContextAssociation('user-1', 'proj-1', 'ts', 'ctx-123');

      const stats = service.getUserPreferenceStats('user-1', 'proj-1');
      expect(stats.lastUpdated).not.toBeNull();
    });

    it('should return empty stats for unknown user', () => {
      const stats = service.getUserPreferenceStats('unknown-user', 'unknown-proj');

      expect(stats.topTypes).toHaveLength(0);
      expect(stats.topModules).toHaveLength(0);
      expect(stats.topTags).toHaveLength(0);
      expect(stats.lastUpdated).toBeNull();
    });

    it('should maintain separate preferences per project', () => {
      const entryProj1 = { ...mockContextEntry, type: 'adr' as const };
      const entryProj2 = { ...mockContextEntry, type: 'pattern' as const };

      service.updateUserPreference('user-1', 'proj-1', entryProj1, 5);
      service.updateUserPreference('user-1', 'proj-2', entryProj2, 5);

      const stats1 = service.getUserPreferenceStats('user-1', 'proj-1');
      const stats2 = service.getUserPreferenceStats('user-1', 'proj-2');

      expect(stats1.topTypes[0]?.type).toBe('adr');
      expect(stats2.topTypes[0]?.type).toBe('pattern');
    });
  });

  // ============================================
  // T-005.5: Override Support Tests
  // ============================================

  describe('Override Management (T-005.5)', () => {
    it('should set and get override', () => {
      service.setOverride('user-1', 'proj-1', ['ctx-1', 'ctx-2']);

      const override = service.getActiveOverride('user-1', 'proj-1');
      expect(override).not.toBeNull();
      expect(override?.contextIds).toEqual(['ctx-1', 'ctx-2']);
    });

    it('should set override with expiration', () => {
      // Set override that expires in 100ms
      service.setOverride('user-1', 'proj-1', ['ctx-1'], 100);

      const override = service.getActiveOverride('user-1', 'proj-1');
      expect(override).not.toBeNull();
      expect(override?.expiresAt).not.toBeNull();
    });

    it('should clear expired override', async () => {
      // Set override that expires in 50ms
      service.setOverride('user-1', 'proj-1', ['ctx-1'], 50);

      // Should exist initially
      expect(service.getActiveOverride('user-1', 'proj-1')).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be expired
      expect(service.getActiveOverride('user-1', 'proj-1')).toBeNull();
    });

    it('should clear override manually', () => {
      service.setOverride('user-1', 'proj-1', ['ctx-1']);
      expect(service.getActiveOverride('user-1', 'proj-1')).not.toBeNull();

      service.clearOverride('user-1', 'proj-1');
      expect(service.getActiveOverride('user-1', 'proj-1')).toBeNull();
    });

    it('should maintain separate overrides per user-project', () => {
      service.setOverride('user-1', 'proj-1', ['ctx-1']);
      service.setOverride('user-1', 'proj-2', ['ctx-2']);
      service.setOverride('user-2', 'proj-1', ['ctx-3']);

      expect(service.getActiveOverride('user-1', 'proj-1')?.contextIds).toEqual(['ctx-1']);
      expect(service.getActiveOverride('user-1', 'proj-2')?.contextIds).toEqual(['ctx-2']);
      expect(service.getActiveOverride('user-2', 'proj-1')?.contextIds).toEqual(['ctx-3']);
    });

    it('should return null for no override', () => {
      const override = service.getActiveOverride('user-1', 'proj-1');
      expect(override).toBeNull();
    });
  });

  // ============================================
  // Service Statistics Tests
  // ============================================

  describe('Service Statistics', () => {
    it('should return service stats', () => {
      const stats = service.getStats();

      expect(stats.isEnabled).toBe(true);
      expect(stats.config).toBeDefined();
      expect(stats.activeSessionsCount).toBe(0);
      expect(stats.activeOverridesCount).toBe(0);
      expect(stats.userPreferencesCount).toBe(0);
      expect(stats.navigationHistorySize).toBe(0);
    });

    it('should track session count after navigation', () => {
      service.recordNavigation({
        userId: 'user-1',
        projectId: 'proj-1',
        filePath: '/file.ts',
        timestamp: Date.now(),
        duration: 1000,
      });

      const stats = service.getStats();
      expect(stats.activeSessionsCount).toBe(1);
    });

    it('should track override count', () => {
      service.setOverride('user-1', 'proj-1', ['ctx-1']);
      service.setOverride('user-2', 'proj-1', ['ctx-2']);

      const stats = service.getStats();
      expect(stats.activeOverridesCount).toBe(2);
    });

    it('should track user preference count', () => {
      const mockEntry = {
        id: 'ctx-1',
        projectId: 'proj-1',
        moduleId: null,
        type: 'adr' as const,
        title: 'Test',
        content: 'Test',
        contentFormat: 'markdown' as const,
        status: 'active' as const,
        supersededBy: null,
        tags: [],
        metadata: {},
        embedding: null,
        version: 1,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.updateUserPreference('user-1', 'proj-1', mockEntry, 1);
      service.updateUserPreference('user-2', 'proj-1', mockEntry, 1);

      const stats = service.getStats();
      expect(stats.userPreferencesCount).toBe(2);
    });

    it('should track navigation history size', () => {
      for (let i = 0; i < 5; i++) {
        service.recordNavigation({
          userId: 'user-1',
          projectId: 'proj-1',
          filePath: `/file${i}.ts`,
          timestamp: Date.now(),
          duration: 1000,
        });
      }

      const stats = service.getStats();
      expect(stats.navigationHistorySize).toBe(5);
    });
  });

  // ============================================
  // Session Cleanup Tests
  // ============================================

  describe('Session Cleanup', () => {
    it('should clear user session data', () => {
      // Create some session data
      service.recordNavigation({
        userId: 'user-1',
        projectId: 'proj-1',
        filePath: '/file.ts',
        timestamp: Date.now(),
        duration: 1000,
      });
      service.setOverride('user-1', 'proj-1', ['ctx-1']);

      // Clear session
      service.clearUserSession('user-1');

      // Verify cleared
      expect(service.getNavigationHistory('user-1', 'proj-1')).toHaveLength(0);
      expect(service.getActiveOverride('user-1', 'proj-1')).toBeNull();
    });

    it('should not affect other users when clearing session', () => {
      service.recordNavigation({
        userId: 'user-1',
        projectId: 'proj-1',
        filePath: '/file.ts',
        timestamp: Date.now(),
        duration: 1000,
      });
      service.recordNavigation({
        userId: 'user-2',
        projectId: 'proj-1',
        filePath: '/file.ts',
        timestamp: Date.now(),
        duration: 1000,
      });

      service.clearUserSession('user-1');

      expect(service.getNavigationHistory('user-1', 'proj-1')).toHaveLength(0);
      expect(service.getNavigationHistory('user-2', 'proj-1')).toHaveLength(1);
    });
  });
});

// ============================================
// Singleton Tests
// ============================================

describe('Singleton Instance', () => {
  beforeEach(() => {
    shutdownAutoContextDetection();
  });

  afterEach(() => {
    shutdownAutoContextDetection();
  });

  it('should return the same instance', () => {
    const instance1 = getAutoContextDetectionService();
    const instance2 = getAutoContextDetectionService();
    expect(instance1).toBe(instance2);
  });

  it('should create new instance after shutdown', () => {
    const instance1 = getAutoContextDetectionService();

    // Add some data
    instance1.recordNavigation({
      userId: 'user-1',
      projectId: 'proj-1',
      filePath: '/file.ts',
      timestamp: Date.now(),
      duration: 1000,
    });

    shutdownAutoContextDetection();

    const instance2 = getAutoContextDetectionService();
    const history = instance2.getNavigationHistory('user-1', 'proj-1');
    expect(history).toHaveLength(0);
  });
});
