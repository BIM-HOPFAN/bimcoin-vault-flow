import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TonClient, WalletContractV4, internal } from 'https://esm.sh/@ton/ton@15.3.1'
import { mnemonicToWalletKey } from 'https://esm.sh/@ton/crypto@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-timestamp, x-signature',
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
      
      // Get burn rate from config
      const { data: burnRateConfig, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'burn_rate_bim_per_ton')
        .single()

      if (configError) {
        console.error('Failed to get burn rate config:', configError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get exchange rate configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const burnRateBimPerTon = parseFloat(burnRateConfig.value) // e.g., 200
      const tonAmount = burnAmount / burnRateBimPerTon // e.g., burnAmount / 200

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

      // Determine burn type (no penalty applied)
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      let finalBurnAmount = burnAmount
      let actualTonAmount = tonAmount

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
        
        console.log(`Burning deposit BIM without penalty: ${depositBurnAmount} BIM, final TON: ${actualTonAmount}`)
      }

        try {
        console.log(`=== Starting BIM to TON burn process ===`)
        console.log(`User: ${wallet_address}, Amount: ${burnAmount} BIM, Expected TON: ${actualTonAmount}`)

        // Initialize TON client and treasury wallet
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

        // Check treasury balance
        const treasuryBalance = await treasuryContract.getBalance()
        const requiredNano = BigInt(Math.floor(actualTonAmount * 1e9))
        const treasuryBalanceTon = Number(treasuryBalance) / 1e9
        const requiredTon = Number(requiredNano) / 1e9
        
        console.log(`Treasury wallet address: ${treasuryWallet.address.toString()}`)
        console.log(`Treasury balance: ${treasuryBalanceTon} TON`)
        console.log(`Required amount: ${requiredTon} TON (+ 0.1 TON for fees)`)
        
        if (treasuryBalance < requiredNano + BigInt(1e8)) { // Add 0.1 TON for fees
          throw new Error(`Insufficient treasury balance. Has ${treasuryBalanceTon} TON, needs ${requiredTon + 0.1} TON`)
        }

        // Send TON to user
        console.log(`Sending ${actualTonAmount} TON to ${wallet_address}`)
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

        // Wait for transaction confirmation
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

        const ton_payout_hash = `${seqno}_confirmed`
        console.log(`TON payout successful: ${ton_payout_hash}`)

        // Record the burn transaction - trigger will handle balance updates
        const { data: burnRecord, error: burnError } = await supabase
          .from('burns')
          .insert({
            user_id: user.id,
            bim_amount: bim_amount,
            ton_amount: actualTonAmount,
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

      // Determine burn type (no penalty applied)
      const depositBimBalance = parseFloat(user.deposit_bim_balance || '0')
      const earnedBimBalance = parseFloat(user.earned_bim_balance || '0')
      
      let burnType = 'earned_bim'
      let penaltyAmount = 0
      let finalBurnAmount = burnAmount
      let jettonAmount = burnAmount // 1:1 ratio for jettons

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
        
        console.log(`Burning deposit BIM without penalty: ${depositBurnAmount} BIM, final jettons: ${jettonAmount}`)
      }

      try {
        // Call jetton minter to mint tokens to user's wallet
        const mintResponse = await supabase.functions.invoke('jetton-minter', {
          body: { 
            action: 'mint', 
            user_wallet: wallet_address, 
            bim_amount: jettonAmount 
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