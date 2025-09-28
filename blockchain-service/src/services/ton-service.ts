import { TonClient, WalletContractV4, internal, fromNano, toNano } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Address, Cell } from '@ton/core';
import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

export class TonService {
  private client: TonClient;
  private treasuryWallet: WalletContractV4 | null = null;

  constructor() {
    this.client = new TonClient({
      endpoint: config.ton.endpoint,
      apiKey: config.ton.apiKey
    });
  }

  /**
   * Initialize treasury wallet from mnemonic
   * PRODUCTION NOTE: Use KMS/HSM for private key management
   */
  async initializeTreasuryWallet(): Promise<void> {
    try {
      // SECURITY: In production, retrieve mnemonic from secure storage (KMS/HSM)
      const mnemonic = process.env.TREASURY_MNEMONIC?.split(' ') || [];
      if (mnemonic.length !== 24) {
        throw new Error('Invalid treasury mnemonic - must be 24 words');
      }

      const key = await mnemonicToWalletKey(mnemonic);
      const workchain = 0; // Usually 0 for mainnet
      
      this.treasuryWallet = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain
      });

      logger.info('Treasury wallet initialized', {
        address: this.treasuryWallet.address.toString()
      });
    } catch (error) {
      logger.error('Failed to initialize treasury wallet:', error);
      throw error;
    }
  }

  /**
   * Get TON balance for an address
   */
  async getTonBalance(address: string): Promise<string> {
    try {
      const addr = Address.parse(address);
      const balance = await this.client.getBalance(addr);
      return fromNano(balance);
    } catch (error) {
      logger.error(`Failed to get TON balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Send TON from treasury wallet
   * PRODUCTION NOTE: Implement multi-sig and additional security checks
   */
  async sendTon(toAddress: string, amount: string, memo?: string): Promise<string> {
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet not initialized');
    }

    try {
      // SECURITY: In production, use secure signing (HSM/KMS)
      const mnemonic = process.env.TREASURY_MNEMONIC?.split(' ') || [];
      const key = await mnemonicToWalletKey(mnemonic);
      
      const walletContract = this.client.open(this.treasuryWallet);
      const seqno = await walletContract.getSeqno();

      // Create transfer message
      const transfer = {
        seqno,
        messages: [
          internal({
            to: Address.parse(toAddress),
            value: toNano(amount),
            body: memo ? memo : undefined,
            bounce: false // Set to false for user wallets
          })
        ]
      };

      // Send transaction
      await walletContract.sendTransfer({
        ...transfer,
        secretKey: key.secretKey
      });

      // Wait for transaction confirmation
      let currentSeqno = seqno;
      while (currentSeqno === seqno) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        currentSeqno = await walletContract.getSeqno();
      }

      // Get transaction hash (simplified - in production, properly track the transaction)
      const txHash = `tx_${Date.now()}_${toAddress.slice(-8)}`;
      
      logger.info('TON transfer completed', {
        to: toAddress,
        amount,
        txHash,
        memo
      });

      return txHash;
    } catch (error) {
      logger.error('Failed to send TON:', error);
      throw error;
    }
  }

  /**
   * Verify TON transaction using TonCenter API with fallback
   */
  async verifyTonTransaction(txHash: string): Promise<any> {
    try {
      // Primary: TonCenter API
      const tonCenterResponse = await this.verifyWithTonCenter(txHash);
      if (tonCenterResponse) return tonCenterResponse;

      // Fallback: TonAPI
      const tonApiResponse = await this.verifyWithTonApi(txHash);
      if (tonApiResponse) return tonApiResponse;

      throw new Error('Transaction not found in any API');
    } catch (error) {
      logger.error(`Failed to verify TON transaction ${txHash}:`, error);
      throw error;
    }
  }

  private async verifyWithTonCenter(txHash: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://toncenter.com/api/v2/getTransactions`,
        {
          params: {
            address: config.treasury.tonAddress,
            limit: 100,
            hash: txHash
          },
          headers: {
            'X-API-Key': config.ton.apiKey
          }
        }
      );

      return response.data?.result?.find((tx: any) => tx.transaction_id?.hash === txHash);
    } catch (error) {
      logger.warn('TonCenter API failed:', error);
      return null;
    }
  }

  private async verifyWithTonApi(txHash: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://tonapi.io/v2/blockchain/transactions/${txHash}`,
        {
          headers: {
            'Authorization': `Bearer ${config.tonApi.key}`
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.warn('TonAPI failed:', error);
      return null;
    }
  }

  /**
   * Get recent transactions for treasury address
   */
  async getRecentTransactions(limit: number = 100): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://toncenter.com/api/v2/getTransactions`,
        {
          params: {
            address: config.treasury.tonAddress,
            limit
          },
          headers: {
            'X-API-Key': config.ton.apiKey
          }
        }
      );

      return response.data?.result || [];
    } catch (error) {
      logger.error('Failed to get recent transactions:', error);
      throw error;
    }
  }
}

// Singleton instance
export const tonService = new TonService();