import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { config } from '../config';
import { jettonDepositQueue } from '../queues/jetton-queue';

const router = Router();

/**
 * Middleware to verify webhook signature
 */
const verifyWebhookSignature = (req: any, res: any, next: any) => {
  const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', config.security.webhookSecret)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
    logger.warn('Invalid webhook signature', { 
      provided: providedSignature.substring(0, 8),
      expected: expectedSignature.substring(0, 8)
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

/**
 * Webhook for jetton transfer notifications
 * Expects payload from TonAPI or TonCenter webhook
 */
router.post('/jetton-transfer',
  verifyWebhookSignature,
  [
    body('account').isString().notEmpty(),
    body('tx_hash').isString().notEmpty(),
    body('amount').isNumeric(),
    body('jetton_master').isString().optional(),
    body('from_address').isString().notEmpty(),
    body('to_address').isString().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const {
        account,
        tx_hash,
        amount,
        jetton_master,
        from_address,
        to_address,
        timestamp,
        block_number
      } = req.body;

      // Log incoming webhook
      logger.info('Received jetton transfer webhook', {
        tx_hash,
        from_address,
        to_address,
        amount,
        jetton_master
      });

      // Queue for processing
      await jettonDepositQueue.add('process-jetton-deposit', {
        txHash: tx_hash,
        fromAddress: from_address,
        toAddress: to_address,
        amount: amount.toString(),
        jettonMaster: jetton_master || config.treasury.jettonMaster,
        timestamp: timestamp || new Date().toISOString(),
        blockNumber: block_number,
        rawData: req.body
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      });

      res.status(200).json({ 
        success: true, 
        message: 'Jetton deposit queued for processing',
        tx_hash 
      });

    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to process webhook'
      });
    }
  }
);

/**
 * Webhook for TON transfer notifications (if needed for monitoring)
 */
router.post('/ton-transfer',
  verifyWebhookSignature,
  [
    body('tx_hash').isString().notEmpty(),
    body('amount').isNumeric(),
    body('from_address').isString().notEmpty(),
    body('to_address').isString().notEmpty()
  ],
  async (req, res) => {
    try {
      const {
        tx_hash,
        amount,
        from_address,
        to_address,
        timestamp,
        block_number
      } = req.body;

      logger.info('Received TON transfer webhook', {
        tx_hash,
        from_address,
        to_address,
        amount
      });

      // For monitoring purposes - log significant transfers
      if (parseFloat(amount) >= 1.0) {
        logger.warn('Large TON transfer detected', {
          tx_hash,
          amount,
          from_address,
          to_address
        });
      }

      res.status(200).json({ 
        success: true, 
        message: 'TON transfer logged' 
      });

    } catch (error) {
      logger.error('TON webhook processing error:', error);
      res.status(500).json({ 
        error: 'Internal server error' 
      });
    }
  }
);

/**
 * Test webhook endpoint for development
 */
if (config.server.nodeEnv !== 'production') {
  router.post('/test', (req, res) => {
    logger.info('Test webhook received', req.body);
    res.status(200).json({ 
      success: true, 
      message: 'Test webhook received',
      body: req.body 
    });
  });
}

export { router as webhookRoutes };