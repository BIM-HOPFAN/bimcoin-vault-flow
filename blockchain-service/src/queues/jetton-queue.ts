import { Queue, Job } from 'bullmq';
import { logger } from '../utils/logger';
import { config } from '../config';
import { db } from '../database/connection';
import { jettonService } from '../services/jetton-service';
import { auditLog } from '../utils/audit';

// Create queues
export const jettonDepositQueue = new Queue('jetton-deposit', {
  connection: {
    host: new URL(config.redis.url).hostname,
    port: parseInt(new URL(config.redis.url).port) || 6379,
    password: new URL(config.redis.url).password || undefined
  }
});

export const jettonPayoutQueue = new Queue('jetton-payout', {
  connection: {
    host: new URL(config.redis.url).hostname,
    port: parseInt(new URL(config.redis.url).port) || 6379,
    password: new URL(config.redis.url).password || undefined
  }
});

/**
 * Process jetton deposit (Jetton → BIM credit)
 */
export async function processJettonDeposit(job: Job): Promise<void> {
  const { txHash, fromAddress, toAddress, amount, jettonMaster, timestamp, blockNumber, rawData } = job.data;
  
  logger.info('Processing jetton deposit', {
    jobId: job.id,
    txHash,
    fromAddress,
    amount,
    jettonMaster
  });

  try {
    // Check if transaction already processed
    const existingEvent = await db.query(
      'SELECT id FROM onchain_events WHERE tx_hash = $1',
      [txHash]
    );

    if (existingEvent.rows.length > 0) {
      logger.info('Transaction already processed', { txHash });
      return;
    }

    // Verify transaction on blockchain
    const verifiedTx = await jettonService.verifyJettonTransaction(txHash);
    if (!verifiedTx) {
      throw new Error('Transaction verification failed');
    }

    // Calculate BIM to credit
    const jettonAmount = parseFloat(amount);
    const bimToCredit = jettonAmount * config.rates.jettonToBim;

    await db.transaction(async (client) => {
      // 1. Record onchain event
      await client.query(`
        INSERT INTO onchain_events (tx_hash, event_type, from_address, to_address, amount, jetton_master, processed, block_number, timestamp, raw_data)
        VALUES ($1, 'jetton_deposit', $2, $3, $4, $5, true, $6, $7, $8)
      `, [txHash, fromAddress, toAddress, jettonAmount, jettonMaster, blockNumber, timestamp, JSON.stringify(rawData)]);

      // 2. Find or create user
      let userResult = await client.query(
        'SELECT id, bim_balance FROM users WHERE wallet_address = $1',
        [fromAddress]
      );

      let userId: string;
      let previousBalance: number;

      if (userResult.rows.length === 0) {
        // Create new user
        const newUserResult = await client.query(`
          INSERT INTO users (wallet_address, bim_balance)
          VALUES ($1, $2)
          RETURNING id, bim_balance
        `, [fromAddress, bimToCredit]);
        
        userId = newUserResult.rows[0].id;
        previousBalance = 0;
      } else {
        // Update existing user
        userId = userResult.rows[0].id;
        previousBalance = parseFloat(userResult.rows[0].bim_balance);

        await client.query(
          'UPDATE users SET bim_balance = bim_balance + $1 WHERE id = $2',
          [bimToCredit, userId]
        );
      }

      // 3. Record balance change
      await client.query(`
        INSERT INTO offchain_balances (user_id, balance_type, previous_balance, new_balance, change_amount, reason, reference_id)
        VALUES ($1, 'bim', $2, $3, $4, 'jetton_deposit', $5)
      `, [userId, previousBalance, previousBalance + bimToCredit, bimToCredit, txHash]);

      logger.info('Jetton deposit processed successfully', {
        txHash,
        fromAddress,
        jettonAmount,
        bimCredited: bimToCredit,
        userId
      });
    });

    // Audit log
    const userResult = await db.query('SELECT id FROM users WHERE wallet_address = $1', [fromAddress]);
    if (userResult.rows.length > 0) {
      await auditLog(userResult.rows[0].id, 'jetton_deposit_processed', 'deposit', txHash, {
        jetton_amount: jettonAmount,
        bim_credited: bimToCredit,
        jetton_master: jettonMaster
      });
    }

  } catch (error) {
    logger.error('Jetton deposit processing failed', {
      jobId: job.id,
      txHash,
      error: error.message,
      attempts: job.attemptsMade
    });

    throw error;
  }
}

/**
 * Process jetton payout (BIM → Jetton transfer)
 */
export async function processJettonPayout(job: Job): Promise<void> {
  const { withdrawalId, userId, walletAddress, toAddress, jettonAmount, bimAmount, jettonMaster } = job.data;
  
  logger.info('Processing jetton payout', {
    jobId: job.id,
    withdrawalId,
    userId,
    jettonAmount,
    bimAmount
  });

  try {
    await db.transaction(async (client) => {
      // 1. Update withdrawal status
      await client.query(
        'UPDATE withdrawals SET status = $1 WHERE id = $2',
        ['processing', withdrawalId]
      );

      // 2. Check user balance
      const userResult = await client.query(
        'SELECT bim_balance, daily_jetton_withdrawn FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      
      if (user.bim_balance < bimAmount) {
        throw new Error('Insufficient BIM balance');
      }

      if (user.daily_jetton_withdrawn + jettonAmount > config.limits.dailyJettonWithdrawal) {
        throw new Error('Daily jetton withdrawal limit exceeded');
      }

      // 3. Deduct BIM balance
      await client.query(`
        UPDATE users 
        SET bim_balance = bim_balance - $1,
            daily_jetton_withdrawn = daily_jetton_withdrawn + $2
        WHERE id = $3
      `, [bimAmount, jettonAmount, userId]);

      // 4. Record balance change
      await client.query(`
        INSERT INTO offchain_balances (user_id, balance_type, previous_balance, new_balance, change_amount, reason, reference_id)
        VALUES ($1, 'bim', $2, $3, $4, 'jetton_payout', $5)
      `, [userId, user.bim_balance, user.bim_balance - bimAmount, -bimAmount, withdrawalId]);

      // 5. Send jetton transaction
      let txHash: string;
      try {
        txHash = await jettonService.sendJettons(toAddress, jettonAmount.toString(), `BIM->Jetton withdrawal`);
      } catch (jettonError) {
        logger.error('Jetton transfer failed, rolling back...', {
          withdrawalId,
          error: jettonError.message
        });
        
        await client.query(
          'UPDATE withdrawals SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', jettonError.message, withdrawalId]
        );
        
        throw jettonError;
      }

      // 6. Create payout record
      const payoutResult = await client.query(`
        INSERT INTO payouts (user_id, payout_type, amount, bim_deducted, to_address, jetton_master, status, tx_hash, processed_at)
        VALUES ($1, 'jetton', $2, $3, $4, $5, 'completed', $6, NOW())
        RETURNING id
      `, [userId, jettonAmount, bimAmount, toAddress, jettonMaster, txHash]);

      const payoutId = payoutResult.rows[0].id;

      // 7. Update withdrawal
      await client.query(
        'UPDATE withdrawals SET status = $1, payout_id = $2, approved_at = NOW() WHERE id = $3',
        ['completed', payoutId, withdrawalId]
      );

      // 8. Record onchain event
      await client.query(`
        INSERT INTO onchain_events (tx_hash, event_type, from_address, to_address, amount, jetton_master, processed, timestamp, raw_data)
        VALUES ($1, 'jetton_payout', $2, $3, $4, $5, true, NOW(), $6)
      `, [
        txHash, 
        config.treasury.tonAddress, 
        toAddress, 
        jettonAmount,
        jettonMaster,
        JSON.stringify({ withdrawalId, payoutId, bimDeducted: bimAmount })
      ]);

      logger.info('Jetton payout completed successfully', {
        withdrawalId,
        payoutId,
        txHash,
        jettonAmount,
        bimDeducted: bimAmount
      });
    });

    // Audit log
    await auditLog(userId, 'jetton_payout_completed', 'payout', withdrawalId, {
      jetton_amount: jettonAmount,
      bim_deducted: bimAmount,
      jetton_master: jettonMaster,
      to_address: toAddress
    });

  } catch (error) {
    logger.error('Jetton payout failed', {
      jobId: job.id,
      withdrawalId,
      error: error.message,
      attempts: job.attemptsMade
    });

    // Update withdrawal status to failed
    try {
      await db.query(
        'UPDATE withdrawals SET status = $1, error_message = $2 WHERE id = $3 AND status = $4',
        ['failed', error.message, withdrawalId, 'processing']
      );
    } catch (updateError) {
      logger.error('Failed to update withdrawal status:', updateError);
    }

    // Audit log for failure
    await auditLog(userId, 'jetton_payout_failed', 'payout', withdrawalId, {
      error: error.message,
      attempts: job.attemptsMade
    });

    throw error;
  }
}