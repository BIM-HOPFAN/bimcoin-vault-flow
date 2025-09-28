import { Queue, Job } from 'bullmq';
import { logger } from '../utils/logger';
import { config } from '../config';
import { db } from '../database/connection';
import { tonService } from '../services/ton-service';
import { auditLog } from '../utils/audit';

// Create TON payout queue
export const tonPayoutQueue = new Queue('ton-payout', {
  connection: {
    host: new URL(config.redis.url).hostname,
    port: parseInt(new URL(config.redis.url).port) || 6379,
    password: new URL(config.redis.url).password || undefined
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

/**
 * Process TON payout job
 */
export async function processTonPayout(job: Job): Promise<void> {
  const { withdrawalId, userId, walletAddress, toAddress, tonAmount, bimAmount } = job.data;
  
  logger.info('Processing TON payout', {
    jobId: job.id,
    withdrawalId,
    userId,
    tonAmount,
    bimAmount
  });

  try {
    // Start database transaction
    await db.transaction(async (client) => {
      // 1. Update withdrawal status to processing
      await client.query(
        'UPDATE withdrawals SET status = $1 WHERE id = $2',
        ['processing', withdrawalId]
      );

      // 2. Check user balance again (prevent race conditions)
      const userResult = await client.query(
        'SELECT bim_balance, daily_ton_withdrawn FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      
      if (user.bim_balance < bimAmount) {
        throw new Error('Insufficient BIM balance');
      }

      if (user.daily_ton_withdrawn + tonAmount > config.limits.dailyTonWithdrawal) {
        throw new Error('Daily withdrawal limit exceeded');
      }

      // 3. Deduct BIM balance and update daily limit
      await client.query(`
        UPDATE users 
        SET bim_balance = bim_balance - $1,
            daily_ton_withdrawn = daily_ton_withdrawn + $2
        WHERE id = $3
      `, [bimAmount, tonAmount, userId]);

      // 4. Record balance change
      await client.query(`
        INSERT INTO offchain_balances (user_id, balance_type, previous_balance, new_balance, change_amount, reason, reference_id)
        VALUES ($1, 'bim', $2, $3, $4, 'ton_payout', $5)
      `, [userId, user.bim_balance, user.bim_balance - bimAmount, -bimAmount, withdrawalId]);

      // 5. Send TON transaction
      let txHash: string;
      try {
        txHash = await tonService.sendTon(toAddress, tonAmount.toString(), `BIM->TON withdrawal`);
      } catch (tonError) {
        logger.error('TON transfer failed, rolling back...', {
          withdrawalId,
          error: tonError.message
        });
        
        // Update withdrawal status to failed
        await client.query(
          'UPDATE withdrawals SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', tonError.message, withdrawalId]
        );
        
        throw tonError;
      }

      // 6. Create payout record
      const payoutResult = await client.query(`
        INSERT INTO payouts (user_id, payout_type, amount, bim_deducted, to_address, status, tx_hash, processed_at)
        VALUES ($1, 'ton', $2, $3, $4, 'completed', $5, NOW())
        RETURNING id
      `, [userId, tonAmount, bimAmount, toAddress, txHash]);

      const payoutId = payoutResult.rows[0].id;

      // 7. Update withdrawal with payout reference
      await client.query(
        'UPDATE withdrawals SET status = $1, payout_id = $2, approved_at = NOW() WHERE id = $3',
        ['completed', payoutId, withdrawalId]
      );

      // 8. Record onchain event
      await client.query(`
        INSERT INTO onchain_events (tx_hash, event_type, from_address, to_address, amount, processed, timestamp, raw_data)
        VALUES ($1, 'ton_payout', $2, $3, $4, true, NOW(), $5)
      `, [
        txHash, 
        config.treasury.tonAddress, 
        toAddress, 
        tonAmount,
        JSON.stringify({ withdrawalId, payoutId, bimDeducted: bimAmount })
      ]);

      logger.info('TON payout completed successfully', {
        withdrawalId,
        payoutId,
        txHash,
        tonAmount,
        bimDeducted: bimAmount
      });
    });

    // Audit log (outside transaction)
    await auditLog(userId, 'ton_payout_completed', 'payout', withdrawalId, {
      ton_amount: tonAmount,
      bim_deducted: bimAmount,
      to_address: toAddress
    });

  } catch (error) {
    logger.error('TON payout failed', {
      jobId: job.id,
      withdrawalId,
      error: error.message,
      attempts: job.attemptsMade
    });

    // Update withdrawal status to failed if not already updated
    try {
      await db.query(
        'UPDATE withdrawals SET status = $1, error_message = $2 WHERE id = $3 AND status = $4',
        ['failed', error.message, withdrawalId, 'processing']
      );
    } catch (updateError) {
      logger.error('Failed to update withdrawal status:', updateError);
    }

    // Audit log for failure
    await auditLog(userId, 'ton_payout_failed', 'payout', withdrawalId, {
      error: error.message,
      attempts: job.attemptsMade
    });

    throw error;
  }
}