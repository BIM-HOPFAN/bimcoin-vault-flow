import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TonClient, WalletContractV4, internal } from 'https://esm.sh/@ton/ton@15.3.1'
import { mnemonicToWalletKey } from 'https://esm.sh/@ton/crypto@3.3.0'

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
        // Update user balances directly since this is an OBA conversion
        const { error: updateError } = await supabase
          .from('users')
          .update({
            oba_balance: user.oba_balance - oba_amount,
            earned_bim_balance: parseFloat(user.earned_bim_balance || '0') + bim_amount,
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
            payout_processed: false,
            penalty_amount: 0,
            burn_type: 'oba_conversion'
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

        // Create a deposit record for the BIM earned from OBA conversion
        await supabase
          .from('deposits')
          .insert({
            user_id: user.id,
            deposit_type: 'OBA_Conversion',
            source_type: 'oba_conversion',
            ton_amount: 0,
            bim_amount: bim_amount,
            oba_reward: 0,
            status: 'completed',
            processed_at: new Date().toISOString(),
            deposit_comment: `OBA to BIM conversion: ${oba_amount} OBA → ${bim_amount} BIM`
          })

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

    // Burn BIM for TON with penalty logic
    if (req.method === 'POST' && path === '/burn-bim') {
      const { wallet_address, bim_amount } = await req.json()

      if (!wallet_address || !bim_amount || bim_amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid wallet address or BIM amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnAmount = parseFloat(bim_amount)
      // Exchange rate: 200 BIM = 1 TON
      const tonAmount = burnAmount * 0.005

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

      // Check if user has enough BIM balance
      if (parseFloat(user.bim_balance) < burnAmount) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient BIM balance. Available: ${user.bim_balance}, Required: ${burnAmount}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Determine burn type and calculate penalty
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      let finalBurnAmount = burnAmount
      let actualTonAmount = tonAmount

      // If burning more than earned BIM, we're burning from deposits (penalty applies)
      if (burnAmount > earnedBimBalance) {
        const depositBurnAmount = burnAmount - earnedBimBalance
        
        if (depositBurnAmount > depositBimBalance) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Insufficient deposit BIM balance' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Apply 50% penalty to deposit BIM being burned
        penaltyAmount = depositBurnAmount * 0.5
        actualTonAmount = tonAmount * (1 - (penaltyAmount / burnAmount))
        burnType = 'deposit_bim'
        
        console.log(`Burning deposit BIM with penalty: ${depositBurnAmount} BIM, penalty: ${penaltyAmount}, final TON: ${actualTonAmount}`)
      }

      try {
        // Initialize TON client with multiple endpoints for reliability
        let client
        let endpoint
        const tonCenterKey = Deno.env.get('TON_CENTER_API_KEY')
        
        // Try TON Center first, fallback to TonHub
        try {
          endpoint = 'https://toncenter.com/api/v2/jsonRPC'
          client = new TonClient({
            endpoint: endpoint,
            apiKey: tonCenterKey
          })
        } catch (tonCenterError) {
          console.log('TON Center failed, trying TonHub:', tonCenterError)
          endpoint = 'https://mainnet-v4.tonhubapi.com'
          client = new TonClient({
            endpoint: endpoint
          })
        }

        console.log(`Using TON endpoint: ${endpoint}`)

        const adminMnemonic = Deno.env.get('ADMIN_MNEMONIC')
        if (!adminMnemonic) {
          throw new Error('ADMIN_MNEMONIC not configured')
        }

        const keyPair = await mnemonicToWalletKey(adminMnemonic.split(' '))
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey })
        const contract = client.open(wallet)

        // Check wallet balance first
        // Send TON to user's wallet (after penalty deduction)
        let ton_amount = actualTonAmount
        const recipientAddress = wallet_address
        
        try {
          const balance = await contract.getBalance()
          const balanceInTon = Number(balance) / 1_000_000_000
          console.log(`Treasury wallet balance: ${balanceInTon} TON`)
          
          if (balanceInTon < ton_amount + 0.01) { // Need extra for fees
            throw new Error(`Insufficient treasury balance: ${balanceInTon} TON, required: ${ton_amount + 0.01} TON`)
          }
        } catch (balanceError) {
          console.error('Failed to check treasury balance:', balanceError)
          throw new Error('Unable to verify treasury wallet state')
        }
        
        console.log(`Preparing to send ${ton_amount} TON (${BigInt(Math.floor(ton_amount * 1_000_000_000))} nanotons) to ${recipientAddress}`)

        // Get sequence number and send transaction
        const seqno = await contract.getSeqno()
        console.log(`Current treasury seqno: ${seqno}`)
        
        await contract.sendTransfer({
          secretKey: keyPair.secretKey,
          seqno: seqno,
          messages: [
            internal({
              to: recipientAddress,
              value: BigInt(Math.floor(ton_amount * 1_000_000_000)),
              body: `BIM burn payout: ${burnAmount} BIM → ${ton_amount} TON`,
              bounce: false,
            }),
          ],
        })

        // Wait for transaction confirmation with better error handling
        let currentSeqno = seqno
        let attempts = 0
        const maxAttempts = 30

        console.log('Waiting for transaction confirmation...')
        while (currentSeqno === seqno && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          try {
            currentSeqno = await contract.getSeqno()
            console.log(`Seqno check ${attempts + 1}: ${currentSeqno} (expecting > ${seqno})`)
          } catch (error) {
            console.log(`Seqno check attempt ${attempts + 1} failed:`, error)
          }
          attempts++
        }

        if (currentSeqno === seqno) {
          throw new Error('Transaction not confirmed within timeout period - TON transfer may have failed')
        }

        const ton_payout_hash = `confirmed_${seqno}_${Date.now()}`
        console.log(`TON transfer confirmed! Seqno: ${seqno} -> ${currentSeqno}`)

        // Now update user balances (only after successful TON transfer)
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
            payout_processed: true
          })
          .select()
          .single()

        if (burnError) {
          console.error('Burn record error:', burnError)
          // Note: We don't rollback BIM here since TON was already sent
          console.error('CRITICAL: TON sent but failed to record transaction in database')
        }

        console.log(`BIM burn successful: ${burnAmount} BIM → ${actualTonAmount} TON for user ${wallet_address}`)

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord?.id || 'unknown',
            bim_burned: burnAmount,
            ton_received: actualTonAmount,
            penalty_amount: penaltyAmount,
            burn_type: burnType,
            ton_payout_hash: ton_payout_hash,
            new_bim_balance: parseFloat(user.bim_balance) - burnAmount
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        console.error('BIM burn transaction error:', error)
        
        // Return more specific error message
        const errorObj = error as Error
        let errorMessage = 'Failed to process burn transaction'
        if (errorObj.message?.includes('Insufficient treasury balance')) {
          errorMessage = 'Treasury wallet has insufficient balance'
        } else if (errorObj.message?.includes('ADMIN_MNEMONIC not configured')) {
          errorMessage = 'Treasury wallet not configured'
        } else if (errorObj.message?.includes('Transaction not confirmed')) {
          errorMessage = 'TON network transaction failed - your BIM was not deducted'
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorMessage,
            details: errorObj.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Burn BIM for Bimcoin jettons
    if (req.method === 'POST' && path === '/burn-bim-for-jetton') {
      const { wallet_address, bim_amount } = await req.json()

      if (!wallet_address || !bim_amount) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing wallet_address or bim_amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnAmount = parseFloat(bim_amount)
      if (burnAmount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid burn amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user from database
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

      // Check if user has enough BIM balance
      if (parseFloat(user.bim_balance) < burnAmount) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient BIM balance. Available: ${user.bim_balance}, Required: ${burnAmount}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Determine burn type and calculate penalty
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      let finalBurnAmount = burnAmount
      let jettonAmount = burnAmount // 1:1 ratio for jettons

      // If burning more than earned BIM, we're burning from deposits (penalty applies)
      if (burnAmount > earnedBimBalance) {
        const depositBurnAmount = burnAmount - earnedBimBalance
        
        if (depositBurnAmount > depositBimBalance) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Insufficient deposit BIM balance' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Apply 50% penalty to deposit BIM being burned
        penaltyAmount = depositBurnAmount * 0.5
        jettonAmount = burnAmount * (1 - (penaltyAmount / burnAmount))
        burnType = 'deposit_bim'
        
        console.log(`Burning deposit BIM with penalty: ${depositBurnAmount} BIM, penalty: ${penaltyAmount}, final jettons: ${jettonAmount}`)
      }

      try {
        // Call jetton minter to mint tokens to user's wallet
        const mintResponse = await supabase.functions.invoke('jetton-minter', {
          body: { 
            action: 'mint', 
            destination: wallet_address, 
            amount: jettonAmount 
          }
        })

        if (mintResponse.error) {
          throw new Error(`Jetton minting failed: ${mintResponse.error.message}`)
        }

        if (!mintResponse.data?.success) {
          throw new Error(`Jetton minting failed: ${mintResponse.data?.error || 'Unknown error'}`)
        }

        const jettonHash = mintResponse.data.transaction_hash || 'pending'
        console.log(`Jetton minting successful with hash: ${jettonHash}`)

        // Record burn with jetton details
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: burnAmount,
            ton_amount: 0, // No TON for jetton burns
            jetton_burn_hash: jettonHash,
            payout_processed: true, // Mark as processed since jettons are minted
            penalty_amount: penaltyAmount,
            burn_type: burnType
          })
          .select()
          .single()

        if (burnError) throw burnError

        console.log(`Burn record created successfully for user ${user.id}`)

        return new Response(
          JSON.stringify({
            success: true,
            message: 'BIM burned and Bimcoin jettons minted successfully',
            bim_burned: burnAmount,
            jettons_received: jettonAmount,
            penalty_applied: penaltyAmount,
            burn_type: burnType,
            jetton_hash: jettonHash
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        console.error('Jetton burn error:', error)
        const errorObj = error as Error
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to mint jettons', 
            details: errorObj.message 
          }),
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
          burns: burns
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Burn API error:', error)
    const errorObj = error as Error
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: errorObj.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})