import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { config } from '../config';
import { db } from '../database/connection';
import { tonPayoutQueue } from '../queues/ton-queue';
import { jettonPayoutQueue } from '../queues/jetton-queue';
import { auditLog } from '../utils/audit';

const router = Router();

/**
 * Request TON withdrawal (BIM → TON)
 */
router.post('/withdraw/ton',
  [
    body('wallet_address').isString().notEmpty().isLength({ min: 48, max: 48 }),
    body('amount').isNumeric().custom(value => {
      if (parseFloat(value) < config.limits.minTonWithdrawal) {
        throw new Error(`Minimum withdrawal is ${config.limits.minTonWithdrawal} TON`);
      }
      return true;
    }),
    body('to_address').isString().notEmpty().isLength({ min: 48, max: 48 })
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

      const { wallet_address, amount, to_address } = req.body;
      const tonAmount = parseFloat(amount);
      const bimRequired = tonAmount / config.rates.bimToTon;

      // Get user and validate balance
      const userResult = await db.query(
        'SELECT id, bim_balance, daily_ton_withdrawn FROM users WHERE wallet_address = $1',
        [wallet_address]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Check BIM balance
      if (user.bim_balance < bimRequired) {
        return res.status(400).json({ 
          error: 'Insufficient BIM balance',
          required: bimRequired,
          available: user.bim_balance
        });
      }

      // Check daily limit
      if (user.daily_ton_withdrawn + tonAmount > config.limits.dailyTonWithdrawal) {
        return res.status(400).json({ 
          error: 'Daily withdrawal limit exceeded',
          limit: config.limits.dailyTonWithdrawal,
          used: user.daily_ton_withdrawn,
          requested: tonAmount
        });
      }

      // Create withdrawal record
      const withdrawalResult = await db.query(`
        INSERT INTO withdrawals (user_id, withdrawal_type, amount, bim_amount, to_address, status)
        VALUES ($1, 'ton', $2, $3, $4, 'pending')
        RETURNING id
      `, [user.id, tonAmount, bimRequired, to_address]);

      const withdrawalId = withdrawalResult.rows[0].id;

      // Queue for processing
      await tonPayoutQueue.add('process-ton-payout', {
        withdrawalId,
        userId: user.id,
        walletAddress: wallet_address,
        toAddress: to_address,
        tonAmount,
        bimAmount: bimRequired
      }, {
        attempts: config.limits.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });

      // Audit log
      await auditLog(user.id, 'withdrawal_request', 'withdrawal', withdrawalId, {
        type: 'ton',
        amount: tonAmount,
        bim_deducted: bimRequired,
        to_address
      });

      logger.info('TON withdrawal requested', {
        userId: user.id,
        withdrawalId,
        tonAmount,
        bimRequired,
        toAddress: to_address
      });

      res.status(201).json({
        success: true,
        withdrawal_id: withdrawalId,
        ton_amount: tonAmount,
        bim_deducted: bimRequired,
        status: 'pending',
        estimated_processing_time: '5-10 minutes'
      });

    } catch (error) {
      logger.error('TON withdrawal error:', error);
      res.status(500).json({ error: 'Failed to process withdrawal request' });
    }
  }
);

/**
 * Request Jetton withdrawal (BIM → Jettons)
 */
router.post('/withdraw/jetton',
  [
    body('wallet_address').isString().notEmpty(),
    body('amount').isNumeric().custom(value => {
      if (parseFloat(value) < config.limits.minJettonWithdrawal) {
        throw new Error(`Minimum withdrawal is ${config.limits.minJettonWithdrawal} jettons`);
      }
      return true;
    }),
    body('to_address').isString().notEmpty(),
    body('jetton_master').isString().optional()
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
        wallet_address, 
        amount, 
        to_address, 
        jetton_master = config.treasury.jettonMaster 
      } = req.body;
      
      const jettonAmount = parseFloat(amount);
      const bimRequired = jettonAmount / config.rates.bimToJetton;

      // Get user and validate balance
      const userResult = await db.query(
        'SELECT id, bim_balance, daily_jetton_withdrawn FROM users WHERE wallet_address = $1',
        [wallet_address]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Check BIM balance
      if (user.bim_balance < bimRequired) {
        return res.status(400).json({ 
          error: 'Insufficient BIM balance',
          required: bimRequired,
          available: user.bim_balance
        });
      }

      // Check daily limit
      if (user.daily_jetton_withdrawn + jettonAmount > config.limits.dailyJettonWithdrawal) {
        return res.status(400).json({ 
          error: 'Daily jetton withdrawal limit exceeded',
          limit: config.limits.dailyJettonWithdrawal,
          used: user.daily_jetton_withdrawn,
          requested: jettonAmount
        });
      }

      // Create withdrawal record
      const withdrawalResult = await db.query(`
        INSERT INTO withdrawals (user_id, withdrawal_type, amount, bim_amount, to_address, jetton_master, status)
        VALUES ($1, 'jetton', $2, $3, $4, $5, 'pending')
        RETURNING id
      `, [user.id, jettonAmount, bimRequired, to_address, jetton_master]);

      const withdrawalId = withdrawalResult.rows[0].id;

      // Queue for processing
      await jettonPayoutQueue.add('process-jetton-payout', {
        withdrawalId,
        userId: user.id,
        walletAddress: wallet_address,
        toAddress: to_address,
        jettonAmount,
        bimAmount: bimRequired,
        jettonMaster: jetton_master
      }, {
        attempts: config.limits.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });

      // Audit log
      await auditLog(user.id, 'withdrawal_request', 'withdrawal', withdrawalId, {
        type: 'jetton',
        amount: jettonAmount,
        bim_deducted: bimRequired,
        to_address,
        jetton_master
      });

      logger.info('Jetton withdrawal requested', {
        userId: user.id,
        withdrawalId,
        jettonAmount,
        bimRequired,
        toAddress: to_address,
        jettonMaster: jetton_master
      });

      res.status(201).json({
        success: true,
        withdrawal_id: withdrawalId,
        jetton_amount: jettonAmount,
        bim_deducted: bimRequired,
        jetton_master: jetton_master,
        status: 'pending',
        estimated_processing_time: '5-10 minutes'
      });

    } catch (error) {
      logger.error('Jetton withdrawal error:', error);
      res.status(500).json({ error: 'Failed to process jetton withdrawal request' });
    }
  }
);

/**
 * Get user balance and limits
 */
router.get('/balance/:wallet_address',
  [
    param('wallet_address').isString().notEmpty()
  ],
  async (req, res) => {
    try {
      const { wallet_address } = req.params;

      const userResult = await db.query(`
        SELECT 
          wallet_address,
          bim_balance,
          daily_ton_withdrawn,
          daily_jetton_withdrawn,
          last_reset_date,
          created_at
        FROM users 
        WHERE wallet_address = $1
      `, [wallet_address]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      res.json({
        wallet_address: user.wallet_address,
        bim_balance: parseFloat(user.bim_balance),
        daily_limits: {
          ton: {
            limit: config.limits.dailyTonWithdrawal,
            used: parseFloat(user.daily_ton_withdrawn),
            remaining: config.limits.dailyTonWithdrawal - parseFloat(user.daily_ton_withdrawn)
          },
          jetton: {
            limit: config.limits.dailyJettonWithdrawal,
            used: parseFloat(user.daily_jetton_withdrawn),
            remaining: config.limits.dailyJettonWithdrawal - parseFloat(user.daily_jetton_withdrawn)
          }
        },
        last_reset_date: user.last_reset_date,
        member_since: user.created_at
      });

    } catch (error) {
      logger.error('Balance query error:', error);
      res.status(500).json({ error: 'Failed to get balance' });
    }
  }
);

/**
 * Get withdrawal history
 */
router.get('/withdrawals/:wallet_address',
  [
    param('wallet_address').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      const { wallet_address } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const userResult = await db.query(
        'SELECT id FROM users WHERE wallet_address = $1',
        [wallet_address]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userId = userResult.rows[0].id;

      const withdrawalsResult = await db.query(`
        SELECT 
          w.id,
          w.withdrawal_type,
          w.amount,
          w.bim_amount,
          w.to_address,
          w.jetton_master,
          w.status,
          w.created_at,
          w.approved_at,
          p.tx_hash,
          p.processed_at
        FROM withdrawals w
        LEFT JOIN payouts p ON w.payout_id = p.id
        WHERE w.user_id = $1
        ORDER BY w.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      res.json({
        withdrawals: withdrawalsResult.rows.map(row => ({
          id: row.id,
          type: row.withdrawal_type,
          amount: parseFloat(row.amount),
          bim_deducted: parseFloat(row.bim_amount),
          to_address: row.to_address,
          jetton_master: row.jetton_master,
          status: row.status,
          tx_hash: row.tx_hash,
          created_at: row.created_at,
          approved_at: row.approved_at,
          processed_at: row.processed_at
        })),
        pagination: {
          limit,
          offset,
          has_more: withdrawalsResult.rows.length === limit
        }
      });

    } catch (error) {
      logger.error('Withdrawal history error:', error);
      res.status(500).json({ error: 'Failed to get withdrawal history' });
    }
  }
);

export { router as apiRoutes };