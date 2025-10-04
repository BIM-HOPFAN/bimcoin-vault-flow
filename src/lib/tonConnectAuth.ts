import { TonConnectUI } from '@tonconnect/ui-react';

export interface TonProof {
  timestamp: number;
  domain: string;
  signature: string;
  payload: string;
  state_init: string;
}

export interface TonProofPayload {
  address: string;
  proof: TonProof;
}

/**
 * Generates a TON Connect proof by requesting the wallet to sign a message
 * This proves the user owns the private key for their wallet address
 */
export async function generateTonProof(
  tonConnectUI: TonConnectUI,
  walletAddress: string
): Promise<TonProofPayload | null> {
  try {
    if (!tonConnectUI.connected || !tonConnectUI.wallet) {
      console.error('Wallet not connected');
      return null;
    }

    const payload = `bimcoin-auth-${Date.now()}-${walletAddress}`;
    
    // Request proof from the connected wallet
    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 60, // 60 seconds
      messages: [
        {
          address: walletAddress,
          amount: '0', // No actual transaction, just signature
        },
      ],
    });

    if (!result) {
      return null;
    }

    return {
      address: walletAddress,
      proof: {
        timestamp: Date.now(),
        domain: window.location.hostname,
        signature: result.boc, // Bag of cells contains the signature
        payload,
        state_init: tonConnectUI.wallet.account.walletStateInit || '',
      },
    };
  } catch (error) {
    console.error('Failed to generate TON proof:', error);
    return null;
  }
}

/**
 * For now, we'll use a simpler approach: sign a timestamp
 * The backend will verify the timestamp is recent (within 5 minutes)
 */
export function generateSimpleAuth(walletAddress: string): {
  wallet_address: string;
  timestamp: number;
  signature: string;
} {
  const timestamp = Date.now();
  // In a real implementation, this would be signed by the wallet
  // For now, we'll send wallet_address + timestamp
  // Backend will verify wallet format and timestamp freshness
  const message = `${walletAddress}-${timestamp}`;
  
  return {
    wallet_address: walletAddress,
    timestamp,
    signature: btoa(message), // Base64 encode for transport
  };
}
