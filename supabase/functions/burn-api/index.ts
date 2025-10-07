import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TonClient, WalletContractV4, internal } from 'https://esm.sh/@ton/ton@15.3.1'
import { mnemonicToWalletKey } from 'https://esm.sh/@ton/crypto@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting and monitoring
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(JSON.stringify({ timestamp, level, message, ...(data && { data }) }))
}

function checkRateLimit(ip: string, limit: number = 30): boolean {
  const now = Date.now()
  const windowMs = 60000 // 1 minute
  const key = `${ip}_${Math.floor(now / windowMs)}`
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  const record = rateLimitStore.get(key)!
  if (record.count >= limit) return false
  
  record.count++
  return true
}

// Validation functions
function validateBurnOBARequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!data.wallet_address || !/^[0-9A-Za-z_-]{48}$|^EQ[0-9A-Za-z_-]{46}$/.test(data.wallet_address)) {
    errors.push('Invalid wallet address format')
  }
  
  if (!data.oba_amount || parseFloat(data.oba_amount) <= 0 || parseFloat(data.oba_amount) > 1000000) {
    errors.push('OBA amount must be between 0 and 1,000,000')
  }
  
  return { valid: errors.length === 0, errors }
}

function validateBurnBIMRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!data.wallet_address || !/^[0-9A-Za-z_-]{48}$|^EQ[0-9A-Za-z_-]{46}$/.test(data.wallet_address)) {
    errors.push('Invalid wallet address format')
  }
  
  if (!data.bim_amount || parseFloat(data.bim_amount) <= 0 || parseFloat(data.bim_amount) > 100000) {
    errors.push('BIM amount must be between 0 and 100,000')
  }
  
  return { valid: errors.length === 0, errors }
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
        log('info', 'Starting OBA to BIM conversion', { wallet_address, oba_amount, bim_amount })

        // Step 1: Deduct OBA balance only (BIM will be added by trigger)
        const { error: obaUpdateError } = await supabase
          .from('users')
          .update({
            oba_balance: user.oba_balance - oba_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (obaUpdateError) {
          log('error', 'Failed to deduct OBA balance', { error: obaUpdateError })
          throw new Error('Failed to update OBA balance')
        }

        // Step 2: Create deposit record with 'pending' status first
        const { data: depositRecord, error: depositInsertError } = await supabase
          .from('deposits')
          .insert({
            user_id: user.id,
            deposit_type: 'OBA_Conversion',
            source_type: 'oba_conversion',
            ton_amount: 0,
            bim_amount: bim_amount,
            oba_reward: 0,
            status: 'pending',
            deposit_comment: `OBA to BIM conversion: ${oba_amount} OBA → ${bim_amount} BIM`
          })
          .select()
          .single()

        if (depositInsertError || !depositRecord) {
          log('error', 'Failed to create deposit record', { error: depositInsertError })
          // Rollback OBA deduction
          await supabase
            .from('users')
            .update({
              oba_balance: user.oba_balance,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
          throw new Error('Failed to create deposit record')
        }

        // Step 3: Update deposit to 'confirmed' - this triggers the balance update function
        const { error: confirmError } = await supabase
          .from('deposits')
          .update({
            status: 'confirmed',
            processed_at: new Date().toISOString()
          })
          .eq('id', depositRecord.id)

        if (confirmError) {
          log('error', 'Failed to confirm deposit', { error: confirmError })
          throw new Error('Failed to confirm deposit')
        }

        // Step 4: Record the burn transaction
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: bim_amount,
            ton_amount: 0,
            jetton_burn_hash: jetton_burn_hash,
            processed_at: new Date().toISOString(),
            payout_processed: false,
            penalty_amount: 0,
            burn_type: 'oba_conversion'
          })
          .select()
          .single()

        if (burnError) {
          log('error', 'Failed to record burn transaction', { error: burnError })
          // Note: Deposit is already confirmed, so we don't rollback
          // The balance updates have already been applied by the trigger
        }

        // Fetch updated user balances
        const { data: updatedUser } = await supabase
          .from('users')
          .select('oba_balance, bim_balance, earned_bim_balance')
          .eq('id', user.id)
          .single()

        log('info', 'OBA conversion completed successfully', {
          wallet_address,
          oba_burned: oba_amount,
          bim_received: bim_amount,
          new_balances: updatedUser
        })

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord?.id || depositRecord.id,
            deposit_id: depositRecord.id,
            oba_burned: oba_amount,
            bim_received: bim_amount,
            burn_hash: jetton_burn_hash,
            new_oba_balance: updatedUser?.oba_balance || (user.oba_balance - oba_amount),
            new_bim_balance: updatedUser?.bim_balance || (user.bim_balance + bim_amount),
            new_earned_bim_balance: updatedUser?.earned_bim_balance
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        log('error', 'OBA to BIM conversion failed', { error: errorMessage, wallet_address, oba_amount })
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to process OBA burn transaction',
            details: errorMessage 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Burn BIM for TON payout
    if (req.method === 'POST' && path === '/burn-bim') {
      const { wallet_address, bim_amount } = await req.json()

      log('info', 'BIM to TON burn request', { wallet_address, bim_amount })

      if (!wallet_address || !bim_amount || bim_amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid wallet address or BIM amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnAmount = parseFloat(bim_amount)
      
      // Get burn rate from config (default 200 BIM per TON)
      const { data: burnRateConfig, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'burn_rate_bim_per_ton')
        .single()

      if (configError) {
        log('error', 'Failed to get burn rate config', { error: configError })
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get exchange rate configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnRateBimPerTon = parseFloat(burnRateConfig.value) // e.g., 200
      const tonAmount = burnAmount / burnRateBimPerTon // e.g., burnAmount / 200

      log('info', 'Exchange rate', { burnRateBimPerTon, burnAmount, tonAmount })

      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', wallet_address)
        .single()

      if (userError || !user) {
        log('error', 'User fetch error', { error: userError, wallet_address })
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user has enough BIM balance
      if (parseFloat(user.bim_balance) < burnAmount) {
        log('warn', 'Insufficient BIM balance', { 
          available: user.bim_balance, 
          required: burnAmount,
          wallet_address 
        })
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient BIM balance. Available: ${user.bim_balance}, Required: ${burnAmount}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Determine burn type (no penalty in current implementation)
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0

      // If burning more than earned BIM, we're burning from deposits
      if (burnAmount > earnedBimBalance) {
        const depositBurnAmount = burnAmount - earnedBimBalance
        
        if (depositBurnAmount > depositBimBalance) {
          log('warn', 'Insufficient deposit BIM balance', {
            earned: earnedBimBalance,
            deposit: depositBimBalance,
            required: burnAmount,
            wallet_address
          })
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Insufficient deposit BIM balance' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        burnType = 'deposit_bim'
        log('info', 'Burning deposit BIM', { depositBurnAmount, earnedBimBalance })
      }

      try {
        log('info', 'Starting BIM to TON payout', { 
          wallet_address, 
          burnAmount, 
          tonAmount, 
          burnType 
        })

        // Step 1: Initialize TON client and treasury wallet
        const tonClient = new TonClient({
          endpoint: 'https://toncenter.com/api/v2/jsonRPC',
          apiKey: Deno.env.get('TON_CENTER_API_KEY') || ''
        })

        const adminMnemonic = Deno.env.get('ADMIN_MNEMONIC')
        if (!adminMnemonic) {
          throw new Error('Treasury wallet not configured')
        }

        const keyPair = await mnemonicToWalletKey(adminMnemonic.split(' '))
        const treasuryWallet = WalletContractV4.create({ 
          workchain: 0, 
          publicKey: keyPair.publicKey 
        })
        const treasuryContract = tonClient.open(treasuryWallet)

        // Step 2: Check treasury balance before proceeding
        const treasuryBalance = await treasuryContract.getBalance()
        const requiredNano = BigInt(Math.floor(tonAmount * 1e9))
        const treasuryBalanceTon = Number(treasuryBalance) / 1e9
        const requiredTon = Number(requiredNano) / 1e9
        
        log('info', 'Treasury wallet check', {
          address: treasuryWallet.address.toString(),
          balance: treasuryBalanceTon,
          required: requiredTon + 0.1
        })
        
        if (treasuryBalance < requiredNano + BigInt(1e8)) { // Add 0.1 TON for fees
          throw new Error(`Insufficient treasury balance. Has ${treasuryBalanceTon} TON, needs ${requiredTon + 0.1} TON`)
        }

        // Step 3: Send TON to user
        log('info', 'Sending TON transaction', { amount: tonAmount, to: wallet_address })
        const seqno = await treasuryContract.getSeqno()
        
        await treasuryContract.sendTransfer({
          seqno,
          secretKey: keyPair.secretKey,
          messages: [
            internal({
              value: requiredNano.toString(),
              to: wallet_address,
              body: `BIM burn payout: ${burnAmount} BIM`
            })
          ]
        })

        // Step 4: Wait for transaction confirmation
        let currentSeqno = seqno
        let attempts = 0
        while (currentSeqno === seqno && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          currentSeqno = await treasuryContract.getSeqno()
          attempts++
        }

        if (currentSeqno === seqno) {
          throw new Error('Transaction not confirmed after 60 seconds')
        }

        const ton_payout_hash = `ton_${seqno}_${Date.now()}`
        log('info', 'TON transaction confirmed', { hash: ton_payout_hash })

        // Step 5: Record burn transaction - trigger will handle balance updates
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: burnAmount,
            ton_amount: tonAmount,
            jetton_burn_hash: `bim_burn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            ton_payout_hash: ton_payout_hash,
            processed_at: new Date().toISOString(),
            payout_processed: true,
            penalty_amount: penaltyAmount,
            burn_type: burnType
          })
          .select()
          .single()

        if (burnError) {
          log('error', 'CRITICAL: TON sent but failed to record burn', { 
            error: burnError, 
            ton_hash: ton_payout_hash,
            wallet_address
          })
          throw new Error('Failed to record burn transaction - TON already sent, contact support')
        }

        // Step 6: Fetch updated balances after trigger fires
        const { data: updatedUser } = await supabase
          .from('users')
          .select('bim_balance, deposit_bim_balance, earned_bim_balance')
          .eq('id', user.id)
          .single()

        log('info', 'BIM to TON burn completed successfully', {
          burn_id: burnRecord.id,
          bim_burned: burnAmount,
          ton_sent: tonAmount,
          burn_type: burnType,
          new_balances: updatedUser
        })

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord.id,
            bim_burned: burnAmount,
            ton_received: tonAmount,
            penalty_amount: penaltyAmount,
            burn_type: burnType,
            ton_payout_hash: ton_payout_hash,
            new_bim_balance: updatedUser?.bim_balance || 0,
            new_deposit_bim_balance: updatedUser?.deposit_bim_balance || 0,
            new_earned_bim_balance: updatedUser?.earned_bim_balance || 0
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        const errorObj = error as Error
        const errorMessage = errorObj.message || 'Unknown error'
        
        log('error', 'BIM to TON burn failed', { 
          error: errorMessage, 
          wallet_address, 
          burnAmount 
        })
        
        // Return user-friendly error message
        let userError = 'Failed to process burn transaction'
        if (errorMessage.includes('Insufficient treasury balance')) {
          userError = 'Treasury wallet has insufficient balance. Please contact support.'
        } else if (errorMessage.includes('not configured')) {
          userError = 'System configuration error. Please contact support.'
        } else if (errorMessage.includes('not confirmed')) {
          userError = 'TON transaction failed - your BIM was not deducted'
        } else if (errorMessage.includes('TON already sent')) {
          userError = errorMessage // Critical error - TON sent but DB failed
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: userError,
            details: errorMessage 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Burn BIM for Bimcoin jettons
    if (req.method === 'POST' && path === '/burn-bim-for-jetton') {
      const { wallet_address, bim_amount } = await req.json()

      log('info', 'BIM to Bimcoin jetton burn request', { wallet_address, bim_amount })

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
        log('error', 'User fetch error', { error: userError, wallet_address })
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user has enough BIM balance
      if (parseFloat(user.bim_balance) < burnAmount) {
        log('warn', 'Insufficient BIM balance for jetton burn', {
          available: user.bim_balance,
          required: burnAmount,
          wallet_address
        })
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient BIM balance. Available: ${user.bim_balance}, Required: ${burnAmount}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Determine burn type
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      const jettonAmount = burnAmount // 1:1 ratio for jettons

      // If burning more than earned BIM, we're burning from deposits
      if (burnAmount > earnedBimBalance) {
        const depositBurnAmount = burnAmount - earnedBimBalance
        
        if (depositBurnAmount > depositBimBalance) {
          log('warn', 'Insufficient deposit BIM for jetton burn', {
            earned: earnedBimBalance,
            deposit: depositBimBalance,
            required: burnAmount,
            wallet_address
          })
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Insufficient deposit BIM balance' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        burnType = 'deposit_bim'
        log('info', 'Burning deposit BIM for jettons', { 
          depositBurnAmount, 
          earnedBimBalance, 
          jettonAmount 
        })
      }

      try {
        log('info', 'Starting jetton minting process', { 
          wallet_address, 
          burnAmount, 
          jettonAmount 
        })

        // Step 1: Call jetton minter to mint tokens to user's wallet
        const mintResponse = await supabase.functions.invoke('jetton-minter', {
          body: { 
            action: 'mint', 
            user_wallet: wallet_address, 
            bim_amount: jettonAmount 
          }
        })

        if (mintResponse.error) {
          log('error', 'Jetton minting invocation error', { 
            error: mintResponse.error 
          })
          throw new Error(`Jetton minting failed: ${mintResponse.error.message}`)
        }

        if (!mintResponse.data?.success) {
          log('error', 'Jetton minting returned failure', { 
            data: mintResponse.data 
          })
          throw new Error(`Jetton minting failed: ${mintResponse.data?.error || 'Unknown error'}`)
        }

        const jettonHash = mintResponse.data.transaction_hash || `jetton_${Date.now()}`
        log('info', 'Jetton minting successful', { hash: jettonHash })

        // Step 2: Record burn with payout_processed=true (triggers balance update)
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: burnAmount,
            ton_amount: 0, // No TON for jetton burns
            jetton_burn_hash: jettonHash,
            payout_processed: true, // Triggers balance update
            penalty_amount: penaltyAmount,
            burn_type: burnType,
            processed_at: new Date().toISOString()
          })
          .select()
          .single()

        if (burnError) {
          log('error', 'CRITICAL: Jettons minted but failed to record burn', {
            error: burnError,
            jetton_hash: jettonHash,
            wallet_address
          })
          throw new Error('Failed to record burn transaction - jettons already minted, contact support')
        }

        // Step 3: Fetch updated balances after trigger fires
        const { data: updatedUser } = await supabase
          .from('users')
          .select('bim_balance, deposit_bim_balance, earned_bim_balance')
          .eq('id', user.id)
          .single()

        log('info', 'BIM to jetton burn completed successfully', {
          burn_id: burnRecord.id,
          bim_burned: burnAmount,
          jettons_minted: jettonAmount,
          burn_type: burnType,
          new_balances: updatedUser
        })

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord.id,
            message: 'BIM burned and Bimcoin jettons minted successfully',
            bim_burned: burnAmount,
            jettons_received: jettonAmount,
            penalty_applied: penaltyAmount,
            burn_type: burnType,
            jetton_hash: jettonHash,
            new_bim_balance: updatedUser?.bim_balance || 0,
            new_deposit_bim_balance: updatedUser?.deposit_bim_balance || 0,
            new_earned_bim_balance: updatedUser?.earned_bim_balance || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        const errorObj = error as Error
        const errorMessage = errorObj.message || 'Unknown error'
        
        log('error', 'BIM to jetton burn failed', { 
          error: errorMessage, 
          wallet_address, 
          burnAmount 
        })

        // Return user-friendly error message
        let userError = 'Failed to mint jettons'
        if (errorMessage.includes('jettons already minted')) {
          userError = errorMessage // Critical error - jettons minted but DB failed
        } else if (errorMessage.includes('not configured')) {
          userError = 'Jetton minter not configured. Please contact support.'
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: userError, 
            details: errorMessage 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get burn preview with penalty calculation
    if (req.method === 'POST' && path === '/preview') {
      const { wallet_address, bim_amount } = await req.json()

      if (!wallet_address || !bim_amount || bim_amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid wallet address or BIM amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnAmount = parseFloat(bim_amount)

      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', wallet_address)
        .single()

      if (userError || !user) {
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

      // Get burn rate from config
      const { data: burnRateConfig, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'burn_rate_bim_per_ton')
        .single()

      if (configError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get exchange rate configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnRateBimPerTon = parseFloat(burnRateConfig.value) // e.g., 200
      console.log(`Burn rate config: ${burnRateBimPerTon}, type: ${typeof burnRateBimPerTon}`)

      // Calculate preview (no penalty applied)
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      
      // Ensure proper floating point division for TON calculation
      const tonAmount = Number((burnAmount / burnRateBimPerTon).toFixed(9))
      const jettonAmount = burnAmount // 1:1 ratio for jettons
      const finalTonAmount = tonAmount
      const finalJettonAmount = jettonAmount
      
      console.log(`Preview calculation: burnAmount=${burnAmount}, burnRate=${burnRateBimPerTon}, tonAmount=${tonAmount}`)

      // If burning more than earned BIM, no penalty
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

        // No penalty applied
        burnType = 'deposit_bim'
      }

      return new Response(
        JSON.stringify({
          success: true,
          preview: {
            bim_amount: burnAmount,
            ton_amount: finalTonAmount,
            jetton_amount: finalJettonAmount,
            penalty_amount: penaltyAmount,
            burn_type: burnType,
            deposit_bim_balance: depositBimBalance,
            earned_bim_balance: earnedBimBalance
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Burn BIM for TON payout
    if (req.method === 'POST' && path === '/burn-bim-for-ton') {
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

      // Get burn rate from config
      const { data: burnRateConfig, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'burn_rate_bim_per_ton')
        .single()

      if (configError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get exchange rate configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnRateBimPerTon = parseFloat(burnRateConfig.value) // e.g., 200

      // Determine burn type (no penalty applied)
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      let tonAmount = burnAmount / burnRateBimPerTon // e.g., burnAmount / 200
      let finalTonAmount = tonAmount

      // If burning more than earned BIM, we're burning from deposits (no penalty)
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

        // No penalty applied
        burnType = 'deposit_bim'
        
        console.log(`Burning deposit BIM without penalty: ${depositBurnAmount} BIM, final TON: ${finalTonAmount}`)
      }

      try {
        // Record burn with TON details
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: burnAmount,
            ton_amount: finalTonAmount,
            penalty_amount: penaltyAmount,
            burn_type: burnType,
            jetton_burn_hash: 'ton_payout_pending',
            payout_processed: false
          })
          .select('*')
          .single()

        if (burnError) {
          throw new Error(`Failed to record burn: ${burnError.message}`)
        }

        // TODO: Implement actual TON transfer logic here
        // For now, we'll mark it as processed with a placeholder hash
        const tonPayoutHash = `ton_${Date.now()}_${burnRecord.id.substring(0, 8)}`
        
        const { error: updateError } = await supabase
          .from('burns')
          .update({
            ton_payout_hash: tonPayoutHash,
            payout_processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', burnRecord.id)

        if (updateError) {
          throw new Error(`Failed to update burn record: ${updateError.message}`)
        }

        console.log(`TON payout successful: ${finalTonAmount} TON to ${wallet_address}`)

        return new Response(
          JSON.stringify({
            success: true,
            burn_id: burnRecord.id,
            bim_burned: burnAmount,
            ton_amount: finalTonAmount,
            penalty_amount: penaltyAmount,
            ton_payout_hash: tonPayoutHash,
            message: 'BIM burned successfully, TON payout processed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error) {
        console.error('TON burn error:', error)
        const errorObj = error as Error
        return new Response(
          JSON.stringify({ success: false, error: errorObj.message }),
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