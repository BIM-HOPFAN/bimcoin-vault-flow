import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Address, TonClient, WalletContractV4, internal, beginCell, toNano } from 'https://esm.sh/@ton/ton@15.0.0';
import { mnemonicToWalletKey } from 'https://esm.sh/@ton/crypto@3.3.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const BIM_TO_TON_RATE = 0.005; // 1 BIM = 0.005 TON
const BIM_TO_JETTON_RATE = 1; // 1 BIM = 1 Bimcoin
const MIN_TON_WITHDRAWAL = 0.1;
const MIN_JETTON_WITHDRAWAL = 1;
const TRANSACTION_FEE = 0.1; // TON needed for transaction fees

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.replace('/withdrawal-api', '');

    // Withdraw TON
    if (path === '/withdraw-ton' && req.method === 'POST') {
      const { wallet_address, bim_amount } = await req.json();

      if (!wallet_address || !bim_amount) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const bimAmountNum = parseFloat(bim_amount);
      const tonAmount = bimAmountNum * BIM_TO_TON_RATE;

      if (tonAmount < MIN_TON_WITHDRAWAL) {
        return new Response(
          JSON.stringify({ error: `Minimum withdrawal is ${MIN_TON_WITHDRAWAL} TON (${MIN_TON_WITHDRAWAL / BIM_TO_TON_RATE} BIM)` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user and check balance
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, wallet_address, bim_balance, deposit_bim_balance, earned_bim_balance')
        .eq('wallet_address', wallet_address)
        .single();

      if (userError || !userData) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (userData.bim_balance < bimAmountNum) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient BIM balance',
            required: bimAmountNum,
            available: userData.bim_balance
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine burn type and calculate any penalties
      let burnType = 'earned_bim';
      let penaltyAmount = 0;
      let bimToDeduct = bimAmountNum;

      if (bimAmountNum > userData.earned_bim_balance) {
        // Need to use deposit BIM
        const depositBimNeeded = bimAmountNum - userData.earned_bim_balance;
        burnType = 'mixed';
        
        // Check if there's deposit BIM available
        const activeDepositBim = await calculateActiveDepositBim(supabase, userData.id);
        
        if (depositBimNeeded > activeDepositBim) {
          // Calculate penalty for using expired deposit BIM
          penaltyAmount = (depositBimNeeded - activeDepositBim) * 0.5; // 50% penalty
          bimToDeduct = bimAmountNum + penaltyAmount;
          
          if (userData.bim_balance < bimToDeduct) {
            return new Response(
              JSON.stringify({ 
                error: 'Insufficient BIM balance after penalty',
                required: bimToDeduct,
                available: userData.bim_balance,
                penalty: penaltyAmount
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Initialize TON client and treasury wallet
      const tonClient = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: Deno.env.get('TON_CENTER_API_KEY') || ''
      });

      const mnemonic = Deno.env.get('ADMIN_MNEMONIC')?.split(' ') || [];
      const key = await mnemonicToWalletKey(mnemonic);
      const treasuryAddress = Address.parse(Deno.env.get('TREASURY_ADDRESS') || '');
      const treasuryWallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
      const treasuryContract = tonClient.open(treasuryWallet);

      // Check treasury balance
      const treasuryBalance = await treasuryContract.getBalance();
      const requiredBalance = toNano(tonAmount.toString()) + toNano(TRANSACTION_FEE.toString());

      if (treasuryBalance < requiredBalance) {
        console.error('Insufficient treasury balance:', {
          required: requiredBalance.toString(),
          available: treasuryBalance.toString()
        });
        
        return new Response(
          JSON.stringify({ error: 'Treasury balance insufficient. Please try again later.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create withdrawal record
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('burns')
        .insert({
          user_id: userData.id,
          bim_amount: bimAmountNum,
          ton_amount: tonAmount,
          burn_type: burnType,
          penalty_amount: penaltyAmount,
          payout_processed: false,
          jetton_burn_hash: `withdrawal_${Date.now()}`
        })
        .select()
        .single();

      if (withdrawalError) {
        console.error('Error creating withdrawal record:', withdrawalError);
        return new Response(
          JSON.stringify({ error: 'Failed to create withdrawal record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
              to: wallet_address,
              value: toNano(tonAmount.toString()),
              bounce: false,
              body: beginCell()
                .storeUint(0, 32)
                .storeStringTail(`BIM Withdrawal: ${bimAmountNum} BIM -> ${tonAmount} TON`)
                .endCell()
            })
          ]
        });

        // Wait for transaction confirmation (simple delay)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Update balances
        const newBimBalance = userData.bim_balance - bimToDeduct;
        const newEarnedBim = Math.max(0, userData.earned_bim_balance - bimAmountNum);
        const depositBimUsed = Math.max(0, bimAmountNum - userData.earned_bim_balance);
        const newDepositBim = userData.deposit_bim_balance - depositBimUsed;

        await supabase
          .from('users')
          .update({
            bim_balance: newBimBalance,
            earned_bim_balance: newEarnedBim,
            deposit_bim_balance: Math.max(0, newDepositBim)
          })
          .eq('id', userData.id);

        // Mark withdrawal as processed
        await supabase
          .from('burns')
          .update({
            payout_processed: true,
            processed_at: new Date().toISOString(),
            ton_payout_hash: `ton_transfer_${Date.now()}`
          })
          .eq('id', withdrawalData.id);

        console.log('TON withdrawal successful:', {
          userId: userData.id,
          bimAmount: bimAmountNum,
          tonAmount,
          penaltyAmount
        });

        return new Response(
          JSON.stringify({
            success: true,
            bim_withdrawn: bimToDeduct,
            ton_received: tonAmount,
            penalty_amount: penaltyAmount,
            burn_type: burnType,
            withdrawal_id: withdrawalData.id
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (txError) {
        console.error('Transaction failed:', txError);
        
        // Delete the withdrawal record on failure
        await supabase
          .from('burns')
          .delete()
          .eq('id', withdrawalData.id);

        return new Response(
          JSON.stringify({ error: 'Transaction failed. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Withdraw Bimcoin jettons
    if (path === '/withdraw-jetton' && req.method === 'POST') {
      const { wallet_address, bim_amount } = await req.json();

      if (!wallet_address || !bim_amount) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const bimAmountNum = parseFloat(bim_amount);
      const jettonAmount = bimAmountNum * BIM_TO_JETTON_RATE;

      if (jettonAmount < MIN_JETTON_WITHDRAWAL) {
        return new Response(
          JSON.stringify({ error: `Minimum withdrawal is ${MIN_JETTON_WITHDRAWAL} Bimcoin` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user and check balance
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, wallet_address, bim_balance, deposit_bim_balance, earned_bim_balance')
        .eq('wallet_address', wallet_address)
        .single();

      if (userError || !userData) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (userData.bim_balance < bimAmountNum) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient BIM balance',
            required: bimAmountNum,
            available: userData.bim_balance
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine burn type
      let burnType = 'earned_bim';
      if (bimAmountNum > userData.earned_bim_balance) {
        burnType = 'mixed';
      }

      // Send jettons (call jetton-minter function)
      const { data: jettonResult, error: jettonError } = await supabase.functions.invoke('jetton-minter', {
        body: {
          action: 'transfer',
          recipient: wallet_address,
          amount: jettonAmount.toString()
        }
      });

      if (jettonError || !jettonResult?.success) {
        console.error('Jetton transfer failed:', jettonError);
        return new Response(
          JSON.stringify({ error: 'Jetton transfer failed. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update balances
      const newBimBalance = userData.bim_balance - bimAmountNum;
      const newEarnedBim = Math.max(0, userData.earned_bim_balance - bimAmountNum);
      const depositBimUsed = Math.max(0, bimAmountNum - userData.earned_bim_balance);
      const newDepositBim = userData.deposit_bim_balance - depositBimUsed;

      await supabase
        .from('users')
        .update({
          bim_balance: newBimBalance,
          earned_bim_balance: newEarnedBim,
          deposit_bim_balance: Math.max(0, newDepositBim)
        })
        .eq('id', userData.id);

      // Create withdrawal record
      await supabase
        .from('burns')
        .insert({
          user_id: userData.id,
          bim_amount: bimAmountNum,
          ton_amount: jettonAmount, // Store jetton amount in ton_amount field
          burn_type: burnType,
          payout_processed: true,
          processed_at: new Date().toISOString(),
          jetton_burn_hash: jettonResult.txHash || `jetton_${Date.now()}`
        });

      console.log('Jetton withdrawal successful:', {
        userId: userData.id,
        bimAmount: bimAmountNum,
        jettonAmount
      });

      return new Response(
        JSON.stringify({
          success: true,
          bim_withdrawn: bimAmountNum,
          jetton_received: jettonAmount,
          burn_type: burnType,
          tx_hash: jettonResult.txHash
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preview withdrawal
    if (path === '/preview' && req.method === 'POST') {
      const { wallet_address, bim_amount, withdrawal_type } = await req.json();

      const bimAmountNum = parseFloat(bim_amount);
      
      // Get user balance
      const { data: userData } = await supabase
        .from('users')
        .select('id, earned_bim_balance, deposit_bim_balance')
        .eq('wallet_address', wallet_address)
        .single();

      let burnType = 'earned_bim';
      let penaltyAmount = 0;

      if (userData && bimAmountNum > userData.earned_bim_balance) {
        const depositBimNeeded = bimAmountNum - userData.earned_bim_balance;
        burnType = 'mixed';
        
        // Check active deposit BIM
        const activeDepositBim = await calculateActiveDepositBim(supabase, userData.id);
        
        if (depositBimNeeded > activeDepositBim) {
          penaltyAmount = (depositBimNeeded - activeDepositBim) * 0.5;
        }
      }

      const result = {
        bim_amount: bimAmountNum,
        burn_type: burnType,
        penalty_amount: penaltyAmount,
        total_bim_deducted: bimAmountNum + penaltyAmount
      };

      if (withdrawal_type === 'ton') {
        result['ton_amount'] = bimAmountNum * BIM_TO_TON_RATE;
      } else {
        result['jetton_amount'] = bimAmountNum * BIM_TO_JETTON_RATE;
      }

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in withdrawal-api:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateActiveDepositBim(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase.rpc('get_active_deposit_bim', { user_uuid: userId });
  return data || 0;
}
