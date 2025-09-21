import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`Burn API Request: ${req.method} ${req.url}`)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/burn-api', '')
    
    console.log(`Parsed path: "${path}", Method: ${req.method}`)

    // Burn OBA for BIM
    if (req.method === 'POST' && path === '/burn-oba') {
      const { wallet_address, oba_amount } = await req.json()

      if (!wallet_address || !oba_amount || oba_amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid wallet address or OBA amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Exchange rate: 200 OBA = 1 BIM
      const bim_amount = oba_amount / 200

      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', wallet_address)
        .single()

      if (userError || !user) {
        console.error('User fetch error:', userError)
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user has enough OBA
      if (user.oba_balance < oba_amount) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient OBA balance. Available: ${user.oba_balance}, Required: ${oba_amount}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate a mock burn hash for now (in real implementation, this would be from blockchain)
      const jetton_burn_hash = `burn_${Date.now()}_${Math.random().toString(36).substring(7)}`

      try {
        // Start transaction by updating user balances
        const { error: updateError } = await supabase
          .from('users')
          .update({
            oba_balance: user.oba_balance - oba_amount,
            bim_balance: user.bim_balance + bim_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('User update error:', updateError)
          throw new Error('Failed to update user balances')
        }

        // Record the burn transaction
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: bim_amount,
            ton_amount: 0, // This will be calculated when burning BIM for TON
            jetton_burn_hash: jetton_burn_hash,
            processed_at: new Date().toISOString(),
            payout_processed: false
          })
          .select()
          .single()

        if (burnError) {
          console.error('Burn record error:', burnError)
          // Rollback user balance update
          await supabase
            .from('users')
            .update({
              oba_balance: user.oba_balance,
              bim_balance: user.bim_balance,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
          
          throw new Error('Failed to record burn transaction')
        }

        console.log(`OBA burn successful: ${oba_amount} OBA → ${bim_amount} BIM for user ${wallet_address}`)

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord.id,
            oba_burned: oba_amount,
            bim_received: bim_amount,
            burn_hash: jetton_burn_hash,
            new_oba_balance: user.oba_balance - oba_amount,
            new_bim_balance: user.bim_balance + bim_amount
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        console.error('Transaction error:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to process burn transaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Burn BIM for TON
    if (req.method === 'POST' && path === '/burn-bim') {
      const { wallet_address, bim_amount } = await req.json()

      if (!wallet_address || !bim_amount || bim_amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid wallet address or BIM amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Exchange rate: 1 BIM = 0.001 TON (1000 BIM = 1 TON)
      const ton_amount = bim_amount / 1000

      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', wallet_address)
        .single()

      if (userError || !user) {
        console.error('User fetch error:', userError)
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user has enough BIM
      if (user.bim_balance < bim_amount) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient BIM balance. Available: ${user.bim_balance}, Required: ${bim_amount}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate a mock TON payout hash for now (in real implementation, this would be from blockchain)
      const ton_payout_hash = `ton_payout_${Date.now()}_${Math.random().toString(36).substring(7)}`

      try {
        // Start transaction by updating user balances
        const { error: updateError } = await supabase
          .from('users')
          .update({
            bim_balance: user.bim_balance - bim_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('User update error:', updateError)
          throw new Error('Failed to update user balances')
        }

        // Record the burn transaction
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: bim_amount,
            ton_amount: ton_amount,
            jetton_burn_hash: `bim_burn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            ton_payout_hash: ton_payout_hash,
            processed_at: new Date().toISOString(),
            payout_processed: true // Mark as processed for TON payouts
          })
          .select()
          .single()

        if (burnError) {
          console.error('Burn record error:', burnError)
          // Rollback user balance update
          await supabase
            .from('users')
            .update({
              bim_balance: user.bim_balance,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
          
          throw new Error('Failed to record burn transaction')
        }

        console.log(`BIM burn successful: ${bim_amount} BIM → ${ton_amount} TON for user ${wallet_address}`)

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord.id,
            bim_burned: bim_amount,
            ton_received: ton_amount,
            ton_payout_hash: ton_payout_hash,
            new_bim_balance: user.bim_balance - bim_amount
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        console.error('Transaction error:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to process burn transaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get burn history
    if (req.method === 'GET' && path === '/history') {
      const wallet_address = url.searchParams.get('wallet_address')
      const limit = parseInt(url.searchParams.get('limit') || '10')

      if (!wallet_address) {
        return new Response(
          JSON.stringify({ success: false, error: 'Wallet address required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet_address)
        .single()

      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get burn history
      const { data: burns, error: burnsError } = await supabase
        .from('burns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (burnsError) {
        console.error('Burns fetch error:', burnsError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch burn history' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          burns: burns || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Burn API error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})