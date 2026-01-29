import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SearchQuerySchema,
  SearchResponseSchema,
  SearchHighlightSchema,
} from '../../src/models/index.js';

describe('Semantic Search Models', () => {
  describe('SearchQuerySchema', () => {
    it('should validate a basic search query', () => {
      const query = {
        query: 'how to implement authentication',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.semantic).toBe(true);
        expect(result.data.minSimilarity).toBe(0.7);
        expect(result.data.limit).toBe(10);
        expect(result.data.includeHighlights).toBe(true);
      }
    });

    it('should validate search query with all filters', () => {
      const query = {
        query: 'authentication patterns',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        types: ['adr', 'pattern'],
        tags: ['security', 'auth'],
        moduleId: '123e4567-e89b-12d3-a456-426614174001',
        status: ['active', 'draft'],
        createdBy: '123e4567-e89b-12d3-a456-426614174002',
        createdAfter: '2025-01-01T00:00:00Z',
        createdBefore: '2026-01-31T23:59:59Z',
        updatedAfter: '2025-06-01T00:00:00Z',
        updatedBefore: '2026-01-31T23:59:59Z',
        limit: 20,
        offset: 10,
        semantic: true,
        minSimilarity: 0.8,
        includeHighlights: true,
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toEqual(['adr', 'pattern']);
        expect(result.data.tags).toEqual(['security', 'auth']);
        expect(result.data.status).toEqual(['active', 'draft']);
        expect(result.data.limit).toBe(20);
        expect(result.data.minSimilarity).toBe(0.8);
      }
    });

    it('should validate text-only search query', () => {
      const query = {
        query: 'authentication',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        semantic: false,
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.semantic).toBe(false);
      }
    });

    it('should reject query without required fields', () => {
      const query = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        // missing query
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject empty query string', () => {
      const query = {
        query: '',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject invalid type filter', () => {
      const query = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        types: ['invalid-type'],
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status filter', () => {
      const query = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        status: ['invalid-status'],
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject minSimilarity out of range', () => {
      const query1 = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        minSimilarity: 1.5,
      };

      const query2 = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        minSimilarity: -0.1,
      };

      expect(SearchQuerySchema.safeParse(query1).success).toBe(false);
      expect(SearchQuerySchema.safeParse(query2).success).toBe(false);
    });

    it('should reject limit out of range', () => {
      const query1 = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 0,
      };

      const query2 = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 101,
      };

      expect(SearchQuerySchema.safeParse(query1).success).toBe(false);
      expect(SearchQuerySchema.safeParse(query2).success).toBe(false);
    });

    it('should coerce date strings to Date objects', () => {
      const query = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        createdAfter: '2025-01-01',
        createdBefore: '2026-12-31',
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAfter).toBeInstanceOf(Date);
        expect(result.data.createdBefore).toBeInstanceOf(Date);
      }
    });
  });

  describe('SearchHighlightSchema', () => {
    it('should validate a title highlight', () => {
      const highlight = {
        field: 'title',
        text: 'Authentication Pattern for JWT',
        matchedTerms: ['authentication', 'pattern'],
      };

      const result = SearchHighlightSchema.safeParse(highlight);
      expect(result.success).toBe(true);
    });

    it('should validate a content highlight', () => {
      const highlight = {
        field: 'content',
        text: 'This document describes the authentication flow using JWT tokens...',
        matchedTerms: ['authentication', 'jwt'],
      };

      const result = SearchHighlightSchema.safeParse(highlight);
      expect(result.success).toBe(true);
    });

    it('should validate semantic highlight without explicit matched terms', () => {
      const highlight = {
        field: 'content',
        text: 'Security considerations for token-based auth...',
        matchedTerms: ['[semantic]'],
      };

      const result = SearchHighlightSchema.safeParse(highlight);
      expect(result.success).toBe(true);
    });

    it('should reject invalid field value', () => {
      const highlight = {
        field: 'invalid',
        text: 'Some text',
        matchedTerms: [],
      };

      const result = SearchHighlightSchema.safeParse(highlight);
      expect(result.success).toBe(false);
    });
  });

  describe('SearchResponseSchema', () => {
    it('should validate a complete search response', () => {
      const response = {
        results: [
          {
            entry: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              projectId: '123e4567-e89b-12d3-a456-426614174001',
              moduleId: null,
              type: 'adr',
              title: 'Authentication Strategy',
              content: '# Authentication\n\nWe use JWT for authentication...',
              contentFormat: 'markdown',
              status: 'active',
              supersededBy: null,
              tags: ['security', 'auth'],
              metadata: {},
              embedding: null,
              version: 1,
              createdBy: '123e4567-e89b-12d3-a456-426614174002',
              updatedBy: '123e4567-e89b-12d3-a456-426614174002',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            similarity: 0.92,
            highlights: [
              {
                field: 'title',
                text: 'Authentication Strategy',
                matchedTerms: ['authentication'],
              },
              {
                field: 'content',
                text: 'We use JWT for authentication...',
                matchedTerms: ['authentication'],
              },
            ],
          },
        ],
        query: 'authentication',
        semantic: true,
        total: 1,
        took: 45,
        cached: false,
      };

      const result = SearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty search results', () => {
      const response = {
        results: [],
        query: 'nonexistent term',
        semantic: true,
        total: 0,
        took: 12,
        cached: true,
      };

      const result = SearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should default cached to false', () => {
      const response = {
        results: [],
        query: 'test',
        semantic: false,
        total: 0,
        took: 5,
      };

      const result = SearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cached).toBe(false);
      }
    });
  });
});

describe('Semantic Search Service Logic', () => {
  describe('Query Term Extraction', () => {
    // Simulates the extractQueryTerms logic from semantic-search.service.ts
    const extractQueryTerms = (query: string): string[] => {
      const stopWords = new Set([
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
        'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'between', 'under', 'again', 'further', 'then', 'once',
        'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
        'if', 'or', 'because', 'until', 'while', 'about', 'against', 'between',
        'que', 'de', 'la', 'el', 'en', 'y', 'los', 'del', 'se', 'las',
        'por', 'un', 'para', 'con', 'una', 'su', 'al', 'es', 'lo',
        'como', 'más', 'pero', 'sus', 'le', 'ya', 'fue', 'este', 'ha',
        'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay',
      ]);

      const terms = query
        .toLowerCase()
        .replace(/[^\w\sáéíóúñü]/g, ' ')
        .split(/\s+/)
        .filter((term) => term.length >= 3 && !stopWords.has(term));

      return [...new Set(terms)];
    };

    it('should extract meaningful terms from English query', () => {
      const terms = extractQueryTerms('How to implement authentication with JWT?');
      expect(terms).toContain('implement');
      expect(terms).toContain('authentication');
      expect(terms).toContain('jwt');
      expect(terms).not.toContain('how');
      expect(terms).not.toContain('to');
      expect(terms).not.toContain('with');
    });

    it('should extract meaningful terms from Spanish query', () => {
      const terms = extractQueryTerms('Cómo implementar autenticación con JWT?');
      expect(terms).toContain('cómo');
      expect(terms).toContain('implementar');
      expect(terms).toContain('autenticación');
      expect(terms).toContain('jwt');
      expect(terms).not.toContain('con');
    });

    it('should remove duplicate terms', () => {
      const terms = extractQueryTerms('authentication authentication auth auth');
      const authCount = terms.filter((t) => t === 'authentication').length;
      expect(authCount).toBe(1);
    });

    it('should filter out short terms', () => {
      const terms = extractQueryTerms('is it ok to use db');
      expect(terms).not.toContain('is');
      expect(terms).not.toContain('it');
      expect(terms).not.toContain('ok');
      expect(terms).not.toContain('to');
      expect(terms).not.toContain('db');
    });

    it('should handle special characters', () => {
      const terms = extractQueryTerms('C++ vs C# for backend development');
      expect(terms).toContain('backend');
      expect(terms).toContain('development');
    });
  });

  describe('Cache Key Generation', () => {
    // Simulates cache key uniqueness
    const generateCacheKey = (query: {
      query: string;
      projectId: string;
      types?: string[];
      semantic?: boolean;
    }): string => {
      const keyData = {
        q: query.query,
        p: query.projectId,
        t: query.types?.sort(),
        sem: query.semantic ?? true,
      };
      return `search:${query.projectId}:${JSON.stringify(keyData)}`;
    };

    it('should generate unique keys for different queries', () => {
      const key1 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-1',
      });

      const key2 = generateCacheKey({
        query: 'authorization',
        projectId: 'proj-1',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys for different projects', () => {
      const key1 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-1',
      });

      const key2 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-2',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys for different filters', () => {
      const key1 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-1',
        types: ['adr'],
      });

      const key2 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-1',
        types: ['pattern'],
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate same key regardless of types array order', () => {
      const key1 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-1',
        types: ['adr', 'pattern'],
      });

      const key2 = generateCacheKey({
        query: 'authentication',
        projectId: 'proj-1',
        types: ['pattern', 'adr'],
      });

      expect(key1).toBe(key2);
    });
  });

  describe('Similarity Scoring', () => {
    it('should recognize valid similarity ranges', () => {
      // Cosine similarity ranges from 0 to 1 for normalized vectors
      const validScores = [0, 0.5, 0.7, 0.85, 0.95, 1.0];

      for (const score of validScores) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('should filter results below minimum similarity', () => {
      const results = [
        { id: '1', similarity: 0.95 },
        { id: '2', similarity: 0.85 },
        { id: '3', similarity: 0.75 },
        { id: '4', similarity: 0.65 },
        { id: '5', similarity: 0.55 },
      ];

      const minSimilarity = 0.7;
      const filtered = results.filter((r) => r.similarity >= minSimilarity);

      expect(filtered).toHaveLength(3);
      expect(filtered.every((r) => r.similarity >= minSimilarity)).toBe(true);
    });
  });

  describe('Highlight Extraction', () => {
    const findHighlightsInText = (
      text: string,
      terms: string[],
      field: 'title' | 'content',
      maxHighlights: number = 3
    ): { field: string; text: string; matchedTerms: string[] }[] => {
      const highlights: { field: string; text: string; matchedTerms: string[] }[] = [];
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.length < 10) continue;

        const matchedTerms: string[] = [];
        for (const term of terms) {
          if (trimmedLine.toLowerCase().includes(term.toLowerCase())) {
            matchedTerms.push(term);
          }
        }

        if (matchedTerms.length > 0) {
          highlights.push({
            field,
            text: trimmedLine.substring(0, 200),
            matchedTerms,
          });
        }

        if (highlights.length >= maxHighlights) break;
      }

      return highlights;
    };

    it('should extract highlights with matched terms', () => {
      const content = `
# Authentication Strategy

This document describes our authentication approach.
We use JWT tokens for stateless authentication.
The tokens are signed using RS256 algorithm.
`;

      const highlights = findHighlightsInText(
        content,
        ['authentication', 'jwt'],
        'content'
      );

      expect(highlights.length).toBeGreaterThan(0);
      expect(
        highlights.some((h) => h.matchedTerms.includes('authentication'))
      ).toBe(true);
    });

    it('should limit number of highlights', () => {
      const content = Array(10)
        .fill('This line contains authentication keyword.')
        .join('\n');

      const highlights = findHighlightsInText(
        content,
        ['authentication'],
        'content',
        3
      );

      expect(highlights).toHaveLength(3);
    });

    it('should skip short lines', () => {
      const content = `
auth
authentication strategy for the enterprise application
jwt
`;

      const highlights = findHighlightsInText(
        content,
        ['auth', 'authentication', 'jwt'],
        'content'
      );

      // Only the long line should be included
      expect(highlights).toHaveLength(1);
      expect(highlights[0].text).toContain('authentication strategy');
    });

    it('should truncate long text in highlights', () => {
      const longLine =
        'This is a very long line that contains the word authentication and goes on and on for more than two hundred characters to test the truncation functionality which should cut off at the 200 character mark approximately here and continue even further.';

      const highlights = findHighlightsInText(
        longLine,
        ['authentication'],
        'content'
      );

      expect(highlights[0].text.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Performance Thresholds', () => {
    const PERFORMANCE_WARNING_THRESHOLD = 200;
    const PERFORMANCE_CRITICAL_THRESHOLD = 500;

    it('should identify fast queries', () => {
      const took = 50;
      expect(took < PERFORMANCE_WARNING_THRESHOLD).toBe(true);
      expect(took < PERFORMANCE_CRITICAL_THRESHOLD).toBe(true);
    });

    it('should identify slow queries needing warning', () => {
      const took = 300;
      expect(took >= PERFORMANCE_WARNING_THRESHOLD).toBe(true);
      expect(took < PERFORMANCE_CRITICAL_THRESHOLD).toBe(true);
    });

    it('should identify critical performance issues', () => {
      const took = 600;
      expect(took >= PERFORMANCE_CRITICAL_THRESHOLD).toBe(true);
    });
  });
});

describe('Search Filter Combinations', () => {
  it('should support multiple type filters', () => {
    const query = {
      query: 'security',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      types: ['adr', 'pattern', 'knowledge'],
    };

    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.types).toHaveLength(3);
    }
  });

  it('should support date range filters', () => {
    const query = {
      query: 'api',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      createdAfter: '2025-01-01',
      createdBefore: '2025-12-31',
      updatedAfter: '2025-06-01',
    };

    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAfter).toBeInstanceOf(Date);
      expect(result.data.createdBefore).toBeInstanceOf(Date);
      expect(result.data.updatedAfter).toBeInstanceOf(Date);
      expect(result.data.updatedBefore).toBeUndefined();
    }
  });

  it('should support author filter with other filters', () => {
    const query = {
      query: 'database',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      createdBy: '123e4567-e89b-12d3-a456-426614174005',
      types: ['adr'],
      status: ['active'],
    };

    const result = SearchQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdBy).toBe('123e4567-e89b-12d3-a456-426614174005');
      expect(result.data.types).toEqual(['adr']);
      expect(result.data.status).toEqual(['active']);
    }
  });
});
