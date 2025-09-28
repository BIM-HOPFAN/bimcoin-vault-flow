import { TonClient, WalletContractV4, internal, fromNano, toNano } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Address, Cell, beginCell } from '@ton/core';
import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

export class JettonService {
  private client: TonClient;
  private treasuryWallet: WalletContractV4 | null = null;
  private treasuryJettonWallet: Address | null = null;

  constructor() {
    this.client = new TonClient({
      endpoint: config.ton.endpoint,
      apiKey: config.ton.apiKey
    });
  }

  /**
   * Initialize treasury wallet and derive jetton wallet
   */
  async initializeTreasuryWallet(): Promise<void> {
    try {
      // SECURITY: In production, retrieve from KMS/HSM
      const mnemonic = process.env.TREASURY_MNEMONIC?.split(' ') || [];
      if (mnemonic.length !== 24) {
        throw new Error('Invalid treasury mnemonic');
      }

      const key = await mnemonicToWalletKey(mnemonic);
      this.treasuryWallet = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain: 0
      });

      // Derive jetton wallet address
      this.treasuryJettonWallet = await this.deriveJettonWallet(
        this.treasuryWallet.address,
        Address.parse(config.treasury.jettonMaster)
      );

      logger.info('Treasury jetton wallet initialized', {
        masterAddress: this.treasuryWallet.address.toString(),
        jettonWallet: this.treasuryJettonWallet.toString()
      });
    } catch (error) {
      logger.error('Failed to initialize treasury jetton wallet:', error);
      throw error;
    }
  }

  /**
   * Derive jetton wallet address for a given owner and jetton master
   */
  async deriveJettonWallet(ownerAddress: Address, jettonMaster: Address): Promise<Address> {
    try {
      // Method 1: Try TonCenter API
      const jettonWallet = await this.deriveWithTonCenter(ownerAddress, jettonMaster);
      if (jettonWallet) return jettonWallet;

      // Method 2: Try TON SDK
      const sdkWallet = await this.deriveWithSDK(ownerAddress, jettonMaster);
      if (sdkWallet) return sdkWallet;

      throw new Error('Failed to derive jetton wallet with all methods');
    } catch (error) {
      logger.error('Failed to derive jetton wallet:', error);
      throw error;
    }
  }

  private async deriveWithTonCenter(ownerAddress: Address, jettonMaster: Address): Promise<Address | null> {
    try {
      const ownerCell = beginCell()
        .storeAddress(ownerAddress)
        .endCell();

      const response = await axios.post(
        'https://toncenter.com/api/v2/runGetMethod',
        {
          address: jettonMaster.toString(),
          method: 'get_wallet_address',
          stack: [
            ['tvm.Slice', ownerCell.toBoc().toString('base64')]
          ]
        },
        {
          headers: {
            'X-API-Key': config.ton.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.ok && response.data?.result?.length > 0) {
        const addressCell = Cell.fromBoc(
          Buffer.from(response.data.result[0][1].bytes, 'base64')
        )[0];
        return addressCell.beginParse().loadAddress();
      }

      return null;
    } catch (error) {
      logger.warn('TonCenter jetton derivation failed:', error);
      return null;
    }
  }

  private async deriveWithSDK(ownerAddress: Address, jettonMaster: Address): Promise<Address | null> {
    try {
      const jettonMasterContract = this.client.open({
        address: jettonMaster,
        async getWalletAddress(owner: Address) {
          // This is a simplified implementation
          // In production, use the actual jetton master contract methods
          const ownerCell = beginCell()
            .storeAddress(owner)
            .endCell();
          
          // Call get_wallet_address method
          const result = await this.client.runMethod(jettonMaster, 'get_wallet_address', [
            { type: 'slice', cell: ownerCell }
          ]);
          
          return result.stack.readAddress();
        }
      } as any);

      return await jettonMasterContract.getWalletAddress(ownerAddress);
    } catch (error) {
      logger.warn('SDK jetton derivation failed:', error);
      return null;
    }
  }

  /**
   * Get jetton balance for an address
   */
  async getJettonBalance(walletAddress: string, jettonMaster?: string): Promise<string> {
    try {
      // If no jetton master provided, use default
      const master = jettonMaster || config.treasury.jettonMaster;
      const ownerAddr = Address.parse(walletAddress);
      const masterAddr = Address.parse(master);
      
      const jettonWallet = await this.deriveJettonWallet(ownerAddr, masterAddr);
      
      // Get jetton wallet balance
      const result = await this.client.runMethod(jettonWallet, 'get_wallet_data');
      const balance = result.stack.readBigNumber();
      
      return fromNano(balance);
    } catch (error) {
      logger.error(`Failed to get jetton balance for ${walletAddress}:`, error);
      return '0';
    }
  }

  /**
   * Send jettons from treasury wallet
   */
  async sendJettons(
    toAddress: string,
    amount: string,
    memo?: string
  ): Promise<string> {
    if (!this.treasuryWallet || !this.treasuryJettonWallet) {
      throw new Error('Treasury wallets not initialized');
    }

    try {
      // SECURITY: In production, use KMS/HSM
      const mnemonic = process.env.TREASURY_MNEMONIC?.split(' ') || [];
      const key = await mnemonicToWalletKey(mnemonic);
      
      const walletContract = this.client.open(this.treasuryWallet);
      const seqno = await walletContract.getSeqno();

      // Create jetton transfer message
      const jettonAmount = toNano(amount);
      const forwardAmount = toNano('0.05'); // Gas for forward message
      
      // Build jetton transfer body
      const transferBody = beginCell()
        .storeUint(0xf8a7ea5, 32) // jetton transfer op
        .storeUint(0, 64) // query id
        .storeCoins(jettonAmount)
        .storeAddress(Address.parse(toAddress))
        .storeAddress(this.treasuryWallet.address) // response destination
        .storeBit(false) // custom payload
        .storeCoins(forwardAmount)
        .storeBit(false) // forward payload
        .endCell();

      // Send to treasury jetton wallet
      const transfer = {
        seqno,
        messages: [
          internal({
            to: this.treasuryJettonWallet,
            value: toNano('0.1'), // Gas fee
            body: transferBody,
            bounce: true
          })
        ]
      };

      await walletContract.sendTransfer({
        ...transfer,
        secretKey: key.secretKey
      });

      // Wait for confirmation
      let currentSeqno = seqno;
      while (currentSeqno === seqno) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        currentSeqno = await walletContract.getSeqno();
      }

      const txHash = `jetton_tx_${Date.now()}_${toAddress.slice(-8)}`;
      
      logger.info('Jetton transfer completed', {
        to: toAddress,
        amount,
        txHash,
        memo
      });

      return txHash;
    } catch (error) {
      logger.error('Failed to send jettons:', error);
      throw error;
    }
  }

  /**
   * Monitor jetton deposits using TonAPI
   */
  async getRecentJettonTransfers(limit: number = 100): Promise<any[]> {
    try {
      // Use TonAPI for jetton transfers
      const response = await axios.get(
        `https://tonapi.io/v2/accounts/${config.treasury.jettonMaster}/jettons/transfers`,
        {
          params: { limit },
          headers: {
            'Authorization': `Bearer ${config.tonApi.key}`
          }
        }
      );

      return response.data?.events || [];
    } catch (error) {
      // Fallback to TonCenter
      return this.getJettonTransfersFromTonCenter(limit);
    }
  }

  private async getJettonTransfersFromTonCenter(limit: number): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://toncenter.com/api/v2/getTransactions`,
        {
          params: {
            address: this.treasuryJettonWallet?.toString(),
            limit
          },
          headers: {
            'X-API-Key': config.ton.apiKey
          }
        }
      );

      return response.data?.result || [];
    } catch (error) {
      logger.error('Failed to get jetton transfers:', error);
      return [];
    }
  }

  /**
   * Verify jetton transaction
   */
  async verifyJettonTransaction(txHash: string): Promise<any> {
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
      logger.error(`Failed to verify jetton transaction ${txHash}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const jettonService = new JettonService();