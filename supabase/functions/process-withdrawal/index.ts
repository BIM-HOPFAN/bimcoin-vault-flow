import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Address, TonClient, WalletContractV4, internal, beginCell, toNano } from 'https://esm.sh/@ton/ton@15.0.0';
import { mnemonicToWalletKey } from 'https://esm.sh/@ton/crypto@3.3.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address',
};

const TRANSACTION_FEE = 0.1; // TON for fees

/**
 * Verify if the wallet address is an admin
 */
async function verifyAdmin(supabase: any, walletAddress: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('wallet_address')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) {
    console.error('Error verifying admin:', error);
    return false;
  }

  return !!data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get wallet address from header for admin verification
    const walletAddress = req.headers.get('x-wallet-address');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Wallet address required in x-wallet-address header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = await verifyAdmin(supabase, walletAddress);
    if (!isAdmin) {
      console.log('Unauthorized withdrawal processing attempt from:', walletAddress);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { withdrawal_id } = await req.json();

    if (!withdrawal_id) {
      return new Response(
        JSON.stringify({ error: 'Withdrawal ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing withdrawal:', withdrawal_id);

    // Get withdrawal details
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .select('*, users(id, wallet_address, bim_balance, earned_bim_balance, deposit_bim_balance)')
      .eq('id', withdrawal_id)
      .single();

    if (withdrawalError || !withdrawal) {
      console.error('Withdrawal not found:', withdrawalError);
      return new Response(
        JSON.stringify({ error: 'Withdrawal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (withdrawal.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Withdrawal must be approved first' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = withdrawal.users;

    // Process TON withdrawal
    if (withdrawal.withdrawal_type === 'ton') {
      console.log('Processing TON withdrawal');

      // Initialize TON client and treasury wallet
      const tonClient = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: Deno.env.get('TON_CENTER_API_KEY') || ''
      });

      const mnemonic = Deno.env.get('ADMIN_MNEMONIC')?.split(' ') || [];
      const key = await mnemonicToWalletKey(mnemonic);
      const treasuryWallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
      const treasuryContract = tonClient.open(treasuryWallet);

      // Check treasury balance
      const treasuryBalance = await treasuryContract.getBalance();
      const requiredBalance = toNano(withdrawal.ton_amount.toString()) + toNano(TRANSACTION_FEE.toString());

      if (treasuryBalance < requiredBalance) {
        console.error('Insufficient treasury balance');
        
        await supabase
          .from('withdrawals')
          .update({ 
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: 'Insufficient treasury balance. Please try again later.'
          })
          .eq('id', withdrawal_id);

        return new Response(
          JSON.stringify({ error: 'Insufficient treasury balance' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send TON transaction
      try {
        const seqno = await treasuryContract.getSeqno();
        
        await treasuryContract.sendTransfer({
          secretKey: key.secretKey,
          seqno: seqno,
          messages: [
            internal({
              to: withdrawal.wallet_address,
              value: toNano(withdrawal.ton_amount.toString()),
              bounce: false,
              body: beginCell()
                .storeUint(0, 32)
                .storeStringTail(`BIM Withdrawal: ${withdrawal.bim_amount} BIM`)
                .endCell()
            })
          ]
        });

        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 5000));

        const txHash = `ton_${Date.now()}_${withdrawal_id}`;

        // Update balances
        const newBimBalance = user.bim_balance - withdrawal.total_bim_deducted;
        const newEarnedBim = Math.max(0, user.earned_bim_balance - withdrawal.bim_amount);
        const depositBimUsed = Math.max(0, withdrawal.bim_amount - user.earned_bim_balance);
        const newDepositBim = user.deposit_bim_balance - depositBimUsed;

        await supabase
          .from('users')
          .update({
            bim_balance: newBimBalance,
            earned_bim_balance: newEarnedBim,
            deposit_bim_balance: Math.max(0, newDepositBim)
          })
          .eq('id', user.id);

        // Update withdrawal as completed
        await supabase
          .from('withdrawals')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            tx_hash: txHash
          })
          .eq('id', withdrawal_id);

        console.log('TON withdrawal completed:', txHash);

        return new Response(
          JSON.stringify({
            success: true,
            tx_hash: txHash,
            message: 'Withdrawal processed successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (txError) {
        console.error('Transaction failed:', txError);
        
        await supabase
          .from('withdrawals')
          .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: `Transaction failed: ${txError.message}`
          })
          .eq('id', withdrawal_id);

        return new Response(
          JSON.stringify({ error: 'Transaction failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Process Jetton withdrawal
    if (withdrawal.withdrawal_type === 'jetton') {
      console.log('Processing Jetton withdrawal');

      // Call jetton-minter function
      const { data: jettonResult, error: jettonError } = await supabase.functions.invoke('jetton-minter', {
        body: {
          action: 'transfer',
          recipient: withdrawal.wallet_address,
          amount: withdrawal.jetton_amount.toString()
        }
      });

      if (jettonError || !jettonResult?.success) {
        console.error('Jetton transfer failed:', jettonError);
        
        await supabase
          .from('withdrawals')
          .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: 'Jetton transfer failed. Please contact support.'
          })
          .eq('id', withdrawal_id);

        return new Response(
          JSON.stringify({ error: 'Jetton transfer failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update balances
      const newBimBalance = user.bim_balance - withdrawal.total_bim_deducted;
      const newEarnedBim = Math.max(0, user.earned_bim_balance - withdrawal.bim_amount);
      const depositBimUsed = Math.max(0, withdrawal.bim_amount - user.earned_bim_balance);
      const newDepositBim = user.deposit_bim_balance - depositBimUsed;

      await supabase
        .from('users')
        .update({
          bim_balance: newBimBalance,
          earned_bim_balance: newEarnedBim,
          deposit_bim_balance: Math.max(0, newDepositBim)
        })
        .eq('id', user.id);

      // Update withdrawal as completed
      await supabase
        .from('withdrawals')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          tx_hash: jettonResult.txHash || `jetton_${Date.now()}`
        })
        .eq('id', withdrawal_id);

      console.log('Jetton withdrawal completed');

      return new Response(
        JSON.stringify({
          success: true,
          tx_hash: jettonResult.txHash,
          message: 'Withdrawal processed successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid withdrawal type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});