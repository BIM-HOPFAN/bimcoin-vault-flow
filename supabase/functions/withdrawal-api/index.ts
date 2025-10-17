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
    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Withdrawal API called');

    const url = new URL(req.url);
    const path = url.pathname.replace('/withdrawal-api', '');
    
    console.log('Request path:', path, 'Method:', req.method);

    // Submit withdrawal request (TON)
    if (path === '/withdraw-ton' && req.method === 'POST') {
      console.log('Processing TON withdrawal request');
      
      const body = await req.json();
      const { wallet_address, bim_amount } = body;

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
        .select('id, bim_balance, deposit_bim_balance, earned_bim_balance')
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
          JSON.stringify({ error: 'Insufficient BIM balance' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate penalty if needed
      let burnType = 'earned_bim';
      let penaltyAmount = 0;
      let totalDeducted = bimAmountNum;

      if (bimAmountNum > userData.earned_bim_balance) {
        const depositBimNeeded = bimAmountNum - userData.earned_bim_balance;
        burnType = 'mixed';
        
        const activeDepositBim = await calculateActiveDepositBim(supabase, userData.id);
        
        if (depositBimNeeded > activeDepositBim) {
          penaltyAmount = (depositBimNeeded - activeDepositBim) * 0.5;
          totalDeducted = bimAmountNum + penaltyAmount;
          
          if (userData.bim_balance < totalDeducted) {
            return new Response(
              JSON.stringify({ error: 'Insufficient BIM balance after penalty' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Create withdrawal request
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: userData.id,
          wallet_address,
          bim_amount: bimAmountNum,
          withdrawal_type: 'ton',
          ton_amount: tonAmount,
          penalty_amount: penaltyAmount,
          total_bim_deducted: totalDeducted,
          status: 'pending'
        })
        .select()
        .single();

      if (withdrawalError) {
        console.error('Error creating withdrawal request:', withdrawalError);
        return new Response(
          JSON.stringify({ error: 'Failed to create withdrawal request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          withdrawal_id: withdrawal.id,
          bim_amount: bimAmountNum,
          ton_amount: tonAmount,
          penalty_amount: penaltyAmount,
          total_bim_deducted: totalDeducted,
          status: 'pending',
          message: 'Withdrawal request submitted successfully. Awaiting admin approval.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Submit withdrawal request (Jetton)
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
        .select('id, bim_balance, deposit_bim_balance, earned_bim_balance')
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
          JSON.stringify({ error: 'Insufficient BIM balance' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create withdrawal request
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: userData.id,
          wallet_address,
          bim_amount: bimAmountNum,
          withdrawal_type: 'jetton',
          jetton_amount: jettonAmount,
          penalty_amount: 0,
          total_bim_deducted: bimAmountNum,
          status: 'pending'
        })
        .select()
        .single();

      if (withdrawalError) {
        console.error('Error creating withdrawal request:', withdrawalError);
        return new Response(
          JSON.stringify({ error: 'Failed to create withdrawal request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          withdrawal_id: withdrawal.id,
          bim_amount: bimAmountNum,
          jetton_amount: jettonAmount,
          status: 'pending',
          message: 'Withdrawal request submitted successfully. Awaiting admin approval.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's withdrawal requests
    if (path === '/my-withdrawals' && req.method === 'GET') {
      const url = new URL(req.url);
      const wallet = url.searchParams.get('wallet_address');

      if (!wallet) {
        return new Response(
          JSON.stringify({ error: 'Wallet address required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet)
        .single();

      if (!userData) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: withdrawals, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch withdrawals' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: withdrawals }),
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
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateActiveDepositBim(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase.rpc('get_active_deposit_bim', { user_uuid: userId });
  return data || 0;
}
