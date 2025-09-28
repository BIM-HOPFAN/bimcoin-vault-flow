import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { config } from '../config';

// Database connection pool
let pool: Pool;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeout,
      ssl: config.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

/**
 * Get database connection from pool
 */
export const db = {
  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', {
          query: text.substring(0, 100),
          duration,
          params: params?.length
        });
      }
      
      return res;
    } catch (error) {
      logger.error('Database query error:', {
        query: text.substring(0, 100),
        error: error.message,
        params: params?.length
      });
      throw error;
    }
  },

  async getClient(): Promise<PoolClient> {
    return await pool.connect();
  },

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await db.query(schema);
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Close database connections
 */
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', closeDatabase);
process.on('SIGINT', closeDatabase);