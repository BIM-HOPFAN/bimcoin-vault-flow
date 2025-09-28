import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { redisClient } from './redis';
import { pool } from '../database/connection';
import { config } from '../config';

/**
 * System monitoring and health checks
 */
export class MonitoringService {
  private static instance: MonitoringService;

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const checks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkExternalAPIs()
      ]);

      const results = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
          redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
          externalAPIs: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
        }
      };

      // If any check failed, mark as unhealthy
      const hasFailures = checks.some(check => check.status === 'rejected');
      if (hasFailures) {
        results.status = 'unhealthy';
        logger.warn('Health check failed', { results });
        res.status(503).json(results);
      } else {
        res.status(200).json(results);
      }
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  }

  /**
   * System metrics endpoint
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        database: await this.getDatabaseMetrics(),
        redis: await this.getRedisMetrics(),
        queues: await this.getQueueMetrics()
      };

      res.status(200).json(metrics);
    } catch (error) {
      logger.error('Metrics collection error:', error);
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<void> {
    await redisClient.ping();
  }

  /**
   * Check external API connectivity
   */
  private async checkExternalAPIs(): Promise<void> {
    const axios = require('axios');
    
    // Check TonCenter API
    await axios.get(`${config.ton.endpoint}/getAddressInformation`, {
      params: { address: config.treasury.tonAddress },
      headers: { 'X-API-Key': config.ton.apiKey },
      timeout: 5000
    });

    // Check TonAPI if available
    if (config.tonApi.key) {
      await axios.get(`${config.tonApi.baseUrl}/v2/blockchain/accounts/${config.treasury.tonAddress}`, {
        headers: { 'Authorization': `Bearer ${config.tonApi.key}` },
        timeout: 5000
      });
    }
  }

  /**
   * Get database connection metrics
   */
  private async getDatabaseMetrics(): Promise<any> {
    try {
      return {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      };
    } catch (error) {
      return { error: 'Failed to get database metrics' };
    }
  }

  /**
   * Get Redis metrics
   */
  private async getRedisMetrics(): Promise<any> {
    try {
      const info = await redisClient.info('memory');
      const keyspace = await redisClient.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: redisClient.status === 'ready'
      };
    } catch (error) {
      return { error: 'Failed to get Redis metrics' };
    }
  }

  /**
   * Get queue metrics
   */
  private async getQueueMetrics(): Promise<any> {
    try {
      // This would require integrating with BullMQ's queue metrics
      // For now, return basic info
      return {
        tonPayoutQueue: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        },
        jettonDepositQueue: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        }
      };
    } catch (error) {
      return { error: 'Failed to get queue metrics' };
    }
  }

  /**
   * Alert when critical thresholds are exceeded
   */
  async checkAlerts(): Promise<void> {
    try {
      // Check queue depth
      const queueMetrics = await this.getQueueMetrics();
      
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      if (memoryUsagePercent > 90) {
        logger.error('High memory usage alert', { memoryUsagePercent });
        // PRODUCTION: Send alert to monitoring system
      }

      // Check database connections
      const dbMetrics = await this.getDatabaseMetrics();
      if (dbMetrics.waitingClients > 10) {
        logger.error('High database connection wait', dbMetrics);
        // PRODUCTION: Send alert to monitoring system
      }

    } catch (error) {
      logger.error('Alert check failed:', error);
    }
  }
}

export const monitoringService = MonitoringService.getInstance();