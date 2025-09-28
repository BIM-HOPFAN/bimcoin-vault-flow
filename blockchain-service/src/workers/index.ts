import { Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { config } from '../config';
import { 
  tonPayoutQueue, 
  processTonPayout,
  jettonDepositQueue,
  jettonPayoutQueue,
  processJettonDeposit,
  processJettonPayout
} from '../queues';

let workers: Worker[] = [];

/**
 * Start all background workers
 */
export async function startWorkers(): Promise<void> {
  try {
    // TON Payout Worker
    const tonPayoutWorker = new Worker('ton-payout', processTonPayout, {
      connection: {
        host: new URL(config.redis.url).hostname,
        port: parseInt(new URL(config.redis.url).port) || 6379,
        password: new URL(config.redis.url).password || undefined
      },
      concurrency: 5,
      maxStalledCount: 3,
      stalledInterval: 30000
    });

    // Jetton Deposit Worker
    const jettonDepositWorker = new Worker('jetton-deposit', processJettonDeposit, {
      connection: {
        host: new URL(config.redis.url).hostname,
        port: parseInt(new URL(config.redis.url).port) || 6379,
        password: new URL(config.redis.url).password || undefined
      },
      concurrency: 10,
      maxStalledCount: 3,
      stalledInterval: 30000
    });

    // Jetton Payout Worker  
    const jettonPayoutWorker = new Worker('jetton-payout', processJettonPayout, {
      connection: {
        host: new URL(config.redis.url).hostname,
        port: parseInt(new URL(config.redis.url).port) || 6379,
        password: new URL(config.redis.url).password || undefined
      },
      concurrency: 5,
      maxStalledCount: 3,
      stalledInterval: 30000
    });

    workers = [tonPayoutWorker, jettonDepositWorker, jettonPayoutWorker];

    // Set up event handlers
    workers.forEach(worker => {
      worker.on('completed', (job) => {
        logger.info(`Job ${job.id} completed`, {
          queue: worker.name,
          jobName: job.name,
          duration: Date.now() - job.timestamp
        });
      });

      worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed`, {
          queue: worker.name,
          jobName: job?.name,
          error: err.message,
          attempts: job?.attemptsMade,
          maxAttempts: job?.opts?.attempts
        });
      });

      worker.on('stalled', (jobId) => {
        logger.warn(`Job ${jobId} stalled`, {
          queue: worker.name
        });
      });

      worker.on('error', (err) => {
        logger.error(`Worker ${worker.name} error:`, err);
      });
    });

    logger.info('All workers started successfully', {
      workers: workers.map(w => w.name)
    });

  } catch (error) {
    logger.error('Failed to start workers:', error);
    throw error;
  }
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  logger.info('Stopping all workers...');
  
  try {
    await Promise.all(workers.map(worker => worker.close()));
    workers = [];
    logger.info('All workers stopped');
  } catch (error) {
    logger.error('Error stopping workers:', error);
    throw error;
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await stopWorkers();
});

process.on('SIGINT', async () => {
  await stopWorkers();
});