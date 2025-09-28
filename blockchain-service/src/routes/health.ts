import { Router } from 'express';
import { db } from '../database/connection';
import { getRedisClient } from '../services/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Basic health check
 */
router.get('/', async (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

/**
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      database: 'unknown',
      redis: 'unknown'
    },
    memory: process.memoryUsage(),
    version: process.version
  };

  // Check database
  try {
    await db.query('SELECT 1');
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
    logger.error('Database health check failed:', error);
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
    logger.error('Redis health check failed:', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Readiness probe (Kubernetes)
 */
router.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const redis = getRedisClient();
    await redis.ping();
    
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

/**
 * Liveness probe (Kubernetes)
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

export { router as healthRoutes };