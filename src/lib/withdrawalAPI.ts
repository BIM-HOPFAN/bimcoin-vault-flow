import { supabase } from "@/integrations/supabase/client";

const WITHDRAWAL_API_URL = "https://xyskyvwxbpnlveamxwlb.supabase.co/functions/v1/withdrawal-api";

export interface WithdrawalPreview {
  bim_amount: number;
  ton_amount?: number;
  jetton_amount?: number;
  burn_type: string;
  penalty_amount: number;
  total_bim_deducted: number;
}

export interface WithdrawalResult {
  success: boolean;
  bim_withdrawn: number;
  ton_received?: number;
  jetton_received?: number;
  penalty_amount?: number;
  burn_type: string;
  withdrawal_id?: string;
  tx_hash?: string;
  error?: string;
}

class WithdrawalAPI {
  private async makeRequest(endpoint: string, body: any): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('Making withdrawal API request to:', `${WITHDRAWAL_API_URL}${endpoint}`);
      console.log('Request body:', body);
      
      const response = await fetch(`${WITHDRAWAL_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(body),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('API error response:', error);
        throw new Error(error.error || 'Request failed');
      }

      const result = await response.json();
      console.log('API success response:', result);
      return result;
    } catch (error) {
      console.error('Withdrawal API request failed:', error);
      throw error;
    }
  }

  async withdrawTON(
    walletAddress: string,
    bimAmount: number
  ): Promise<WithdrawalResult> {
    return this.makeRequest('/withdraw-ton', {
      wallet_address: walletAddress,
      bim_amount: bimAmount,
    });
  }

  async withdrawJetton(
    walletAddress: string,
    bimAmount: number
  ): Promise<WithdrawalResult> {
    return this.makeRequest('/withdraw-jetton', {
      wallet_address: walletAddress,
      bim_amount: bimAmount,
    });
  }

  async previewWithdrawal(
    walletAddress: string,
    bimAmount: number,
    withdrawalType: 'ton' | 'jetton'
  ): Promise<WithdrawalPreview> {
    return this.makeRequest('/preview', {
      wallet_address: walletAddress,
      bim_amount: bimAmount,
      withdrawal_type: withdrawalType,
    });
  }
}

export const withdrawalAPI = new WithdrawalAPI();
