import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  getClient(): Promise<PoolClientWrapper>;
  end(): Promise<void>;
}

export interface PoolClientWrapper {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  release(): void;
}

class PostgresClient implements DatabaseClient {
  private pool: Pool;

  constructor() {
    const poolConfig: PoolConfig = {
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_SIZE,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error');
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug({
        query: text.substring(0, 100),
        duration,
        rows: result.rowCount,
      }, 'Database query executed');

      return result;
    } catch (error) {
      logger.error({ error, query: text.substring(0, 100) }, 'Database query failed');
      throw error;
    }
  }

  async getClient(): Promise<PoolClientWrapper> {
    const client = await this.pool.connect();
    return {
      query: <T extends QueryResultRow>(text: string, params?: unknown[]) =>
        client.query<T>(text, params),
      release: () => client.release(),
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let dbClient: PostgresClient | null = null;

export function getDatabase(): PostgresClient {
  if (!dbClient) {
    dbClient = new PostgresClient();
  }
  return dbClient;
}

export async function closeDatabase(): Promise<void> {
  if (dbClient) {
    await dbClient.end();
    dbClient = null;
  }
}

// Transaction helper
export async function withTransaction<T>(
  fn: (client: PoolClientWrapper) => Promise<T>
): Promise<T> {
  const client = await getDatabase().getClient();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
