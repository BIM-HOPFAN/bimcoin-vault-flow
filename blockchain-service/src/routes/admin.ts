import express from 'express';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import { tonService } from '../services/ton-service';
import { jettonService } from '../services/jetton-service';
import { apiRateLimit } from '../middleware/security';

const router = express.Router();

// Apply rate limiting
router.use(apiRateLimit);

/**
 * Admin authentication middleware (PRODUCTION: Implement proper auth)
 */
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminToken = req.headers.authorization?.replace('Bearer ', '');
  
  // PRODUCTION: Implement proper JWT verification or OAuth
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  next();
};

/**
 * Get system statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    
    const stats = await Promise.all([
      client.query('SELECT COUNT(*) as total_users FROM users'),
      client.query('SELECT COUNT(*) as total_transactions FROM onchain_events WHERE created_at > NOW() - INTERVAL \'24 hours\''),
      client.query('SELECT SUM(amount) as total_ton_payouts FROM payouts WHERE status = \'completed\' AND created_at > NOW() - INTERVAL \'24 hours\''),
      client.query('SELECT SUM(amount) as total_jetton_payouts FROM withdrawals WHERE status = \'completed\' AND created_at > NOW() - INTERVAL \'24 hours\''),
      client.query('SELECT SUM(bim_balance) as total_bim_balance FROM offchain_balances'),
    ]);
    
    client.release();

    const systemStats = {
      totalUsers: parseInt(stats[0].rows[0].total_users),
      dailyTransactions: parseInt(stats[1].rows[0].total_transactions),
      dailyTonPayouts: parseFloat(stats[2].rows[0].total_ton_payouts || '0'),
      dailyJettonPayouts: parseFloat(stats[3].rows[0].total_jetton_payouts || '0'),
      totalBimBalance: parseFloat(stats[4].rows[0].total_bim_balance || '0'),
      treasuryTonBalance: await tonService.getTonBalance(process.env.TREASURY_TON_ADDRESS!),
      timestamp: new Date().toISOString()
    };

    res.json(systemStats);
  } catch (error) {
    logger.error('Failed to get admin stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * Get recent transactions
 */
router.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        tx_hash,
        user_address,
        amount,
        type,
        status,
        created_at,
        updated_at
      FROM onchain_events 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    client.release();

    res.json({
      transactions: result.rows,
      pagination: {
        limit,
        offset,
        total: result.rowCount
      }
    });
  } catch (error) {
    logger.error('Failed to get admin transactions:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

/**
 * Get user balances
 */
router.get('/balances', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        u.address,
        u.created_at as user_created,
        ob.bim_balance,
        ob.last_updated
      FROM users u
      LEFT JOIN offchain_balances ob ON u.address = ob.user_address
      ORDER BY ob.bim_balance DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    client.release();

    res.json({
      balances: result.rows,
      pagination: {
        limit,
        offset,
        total: result.rowCount
      }
    });
  } catch (error) {
    logger.error('Failed to get user balances:', error);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

/**
 * Manual transaction retry
 */
router.post('/retry-transaction', requireAdmin, async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    const client = await pool.connect();
    
    // Get transaction details
    const result = await client.query(
      'SELECT * FROM onchain_events WHERE id = $1',
      [transactionId]
    );

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = result.rows[0];

    if (transaction.status === 'completed') {
      client.release();
      return res.status(400).json({ error: 'Transaction already completed' });
    }

    // Reset transaction status for retry
    await client.query(
      'UPDATE onchain_events SET status = $1, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2',
      ['pending', transactionId]
    );

    client.release();

    // PRODUCTION: Add to appropriate queue for retry
    logger.info('Transaction marked for retry', { transactionId, type: transaction.type });

    res.json({ message: 'Transaction marked for retry', transactionId });
  } catch (error) {
    logger.error('Failed to retry transaction:', error);
    res.status(500).json({ error: 'Failed to retry transaction' });
  }
});

/**
 * Emergency pause system
 */
router.post('/emergency-pause', requireAdmin, async (req, res) => {
  try {
    // PRODUCTION: Implement emergency pause mechanism
    // This could set a flag in Redis that all workers check
    
    logger.error('EMERGENCY PAUSE ACTIVATED', {
      admin: req.headers.authorization,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Emergency pause activated' });
  } catch (error) {
    logger.error('Failed to activate emergency pause:', error);
    res.status(500).json({ error: 'Failed to activate emergency pause' });
  }
});

/**
 * Treasury balance check
 */
router.get('/treasury-balance', requireAdmin, async (req, res) => {
  try {
    const tonBalance = await tonService.getTonBalance(process.env.TREASURY_TON_ADDRESS!);
    const jettonBalance = await jettonService.getJettonBalance(
      process.env.TREASURY_TON_ADDRESS!,
      process.env.TREASURY_JETTON_MASTER!
    );

    res.json({
      treasury: {
        address: process.env.TREASURY_TON_ADDRESS,
        tonBalance: tonBalance,
        jettonBalance: jettonBalance,
        jettonMaster: process.env.TREASURY_JETTON_MASTER
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get treasury balance:', error);
    res.status(500).json({ error: 'Failed to get treasury balance' });
  }
});

export default router;