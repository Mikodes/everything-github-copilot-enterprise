import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables for tests
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'test-secret-key-for-testing-only-32chars';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

// Global test setup
beforeAll(async () => {
  // Setup code that runs before all tests
});

afterAll(async () => {
  // Cleanup code that runs after all tests
});

// Mock external services
vi.mock('openai', () => ({
  default: class OpenAI {
    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    };
  },
}));
