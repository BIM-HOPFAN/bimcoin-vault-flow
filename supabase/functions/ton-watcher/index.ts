import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const TON_CENTER_API_KEY = Deno.env.get('TON_CENTER_API_KEY')
const TREASURY_ADDRESS = Deno.env.get('TREASURY_ADDRESS')
const MINTER_ADDRESS = Deno.env.get('MINTER_ADDRESS')

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    switch (req.method) {
      case 'POST':
        if (path === 'check-deposits') {
          return await checkDeposits()
        } else if (path === 'check-burns') {
          return await checkBurns()
        } else if (path === 'process-mint') {
          return await processMint(req)
        }
        break

      case 'GET':
        if (path === 'balance') {
          return await getBalance(url.searchParams)
        }
        break

      default:
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders 
        })
    }

    return new Response('Not found', { 
      status: 404,
      headers: corsHeaders 
    })
  } catch (error) {
    console.error('Error in ton-watcher function:', error)
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function checkDeposits() {
  console.log('Checking for new deposits...')

  if (!TREASURY_ADDRESS) {
    console.error('Treasury address not configured')
    return new Response(JSON.stringify({ error: 'Treasury address not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  console.log(`Using treasury address: ${TREASURY_ADDRESS}`)

  // Remove automatic processing of pending deposits without transaction verification
  // Only process deposits that have actual blockchain transaction evidence

  try {
    let data = null
    let apiUsed = 'toncenter'
    
    // Try TON Center API first
    try {
      const apiUrl = `https://toncenter.com/api/v2/getTransactions?address=${TREASURY_ADDRESS}&limit=20&api_key=${TON_CENTER_API_KEY}`
      console.log(`Fetching transactions from TON Center: ${apiUrl}`)
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        data = await response.json()
        console.log(`TON Center API Response:`, data)
      } else {
        throw new Error(`TON Center API error: ${response.status}`)
      }
    } catch (tonCenterError) {
      console.log(`TON Center API failed: ${tonCenterError.message}`)
      
      // Fallback to TonAPI.io
      try {
        const fallbackUrl = `https://tonapi.io/v2/blockchain/accounts/${TREASURY_ADDRESS}/transactions?limit=20`
        console.log(`Trying fallback API: ${fallbackUrl}`)
        
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (fallbackResponse.ok) {
          const tonApiData = await fallbackResponse.json()
          // Convert TonAPI format to TON Center format
          data = {
            result: tonApiData.transactions?.map(tx => ({
              hash: tx.hash,
              in_msg: tx.in_msg ? {
                message: tx.in_msg.decoded_body?.text || tx.in_msg.raw_body
              } : null,
              value: tx.in_msg?.value || '0'
            })) || []
          }
          apiUsed = 'tonapi'
          console.log(`TonAPI.io Response converted:`, data)
        } else {
          throw new Error(`TonAPI.io error: ${fallbackResponse.status}`)
        }
      } catch (tonApiError) {
        console.log(`Both APIs failed. TON Center: ${tonCenterError.message}, TonAPI: ${tonApiError.message}`)
        // Return success with no processed deposits rather than failing completely
        return new Response(JSON.stringify({
          success: true,
          processed_deposits: 0,
          checked_transactions: 0,
          error: 'Both TON APIs unavailable',
          apis_tried: ['toncenter', 'tonapi']
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }
    
    // Only process deposits with verified blockchain transactions
    console.log('Checking blockchain transactions for deposit verification...')
    
    let processedCount = 0
    
    if (data && data.result && Array.isArray(data.result)) {
      // Process verified transactions only
      for (const tx of data.result) {
        try {
          if (tx.in_msg && tx.in_msg.message) {
            const comment = tx.in_msg.message
            if (comment.startsWith('BIM:DEPOSIT:')) {
              const txHash = tx.hash
              const amount = tx.value ? (parseInt(tx.value) / 1000000000).toString() : '0'
              
              console.log(`Found verified deposit transaction: ${comment}`)
              await processDeposit(comment, txHash, amount)
              processedCount++
            }
          }
        } catch (error) {
          console.error(`Error processing transaction:`, error)
        }
      }
    }
    
    console.log(`Processed ${processedCount} verified deposits`)
    return new Response(JSON.stringify({
      success: true,  
      processed_deposits: processedCount,
      checked_transactions: pendingDeposits?.length || 0,
      api_used: 'app_level'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error checking deposits:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function processDeposit(depositComment: string, txHash: string, amount: string) {
  try {
    // Find pending deposit with this comment
    const { data: pendingDeposit, error: depositError } = await supabase
      .from('deposits')
      .select('*, users(*)')
      .eq('deposit_comment', depositComment)
      .eq('status', 'pending')
      .single()

    if (depositError || !pendingDeposit) {
      console.log(`No pending deposit found for comment: ${depositComment}`)
      return
    }

    console.log(`Processing ${pendingDeposit.deposit_type} deposit: ${depositComment}`)

    // Handle different deposit types
    if (pendingDeposit.deposit_type === 'TON') {
      // Verify TON amount matches (with some tolerance)
      const expectedAmount = parseFloat(pendingDeposit.ton_amount)
      const actualAmount = parseFloat(amount)
      const tolerance = 0.001 // 0.001 TON tolerance

      if (Math.abs(expectedAmount - actualAmount) > tolerance) {
        console.log(`TON amount mismatch: expected ${expectedAmount}, got ${actualAmount}`)
        return
      }
    } else if (pendingDeposit.deposit_type === 'Bimcoin') {
      // For Bimcoin deposits, we need to verify jetton transfers
      // The amount verification is different for jetton transfers
      console.log(`Processing Bimcoin deposit: ${pendingDeposit.bim_amount} BIM from ${pendingDeposit.ton_amount} Bimcoin`)
    }

    // Update deposit status with transaction hash
    const { error: updateError } = await supabase
      .from('deposits')
      .update({
        deposit_hash: txHash,
        status: 'confirmed',
        processed_at: new Date().toISOString()
      })
      .eq('id', pendingDeposit.id)

    if (updateError) {
      console.error(`Failed to update deposit: ${updateError.message}`)
      return
    }

    // Update user's BIM balance and total deposited
    const tonAmount = pendingDeposit.deposit_type === 'TON' ? parseFloat(pendingDeposit.ton_amount) : 0
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        bim_balance: (parseFloat(pendingDeposit.users.bim_balance) + parseFloat(pendingDeposit.bim_amount)).toString(),
        total_deposited: (parseFloat(pendingDeposit.users.total_deposited) + tonAmount).toString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', pendingDeposit.user_id)

    if (userUpdateError) {
      console.error(`Failed to update user balance: ${userUpdateError.message}`)
      return
    }

    // Handle referral rewards if applicable
    if (pendingDeposit.users.referred_by) {
      await handleReferralReward(pendingDeposit)
    }

    console.log(`Successfully processed ${pendingDeposit.deposit_type} deposit: ${depositComment} for ${pendingDeposit.bim_amount} BIM`)
    
  } catch (error) {
    console.error(`Error processing deposit ${depositComment}:`, error)
  }
}

// Helper function to handle referral rewards
async function handleReferralReward(deposit: any) {
  try {
    const { data: referralConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'referral_rate')
      .single()

    if (referralConfig) {
      const referralRate = parseFloat(referralConfig.value)
      const referralReward = parseFloat(deposit.bim_amount) * referralRate

      // Check if this is the first deposit for referral
      const { count: depositCount } = await supabase
        .from('deposits')
        .select('*', { count: 'exact' })
        .eq('user_id', deposit.user_id)
        .eq('status', 'confirmed')

      if (depositCount === 1) {
        // Create referral record
        await supabase
          .from('referrals')
          .insert({
            referrer_id: deposit.users.referred_by,
            referee_id: deposit.user_id,
            first_deposit_id: deposit.id,
            reward_amount: referralReward.toString(),
            status: 'completed',
            completed_at: new Date().toISOString()
          })

        // Update referrer's balance
        const { data: referrer } = await supabase
          .from('users')
          .select('bim_balance, total_earned_from_referrals')
          .eq('id', deposit.users.referred_by)
          .single()

        if (referrer) {
          await supabase
            .from('users')
            .update({
              bim_balance: (parseFloat(referrer.bim_balance) + referralReward).toString(),
              total_earned_from_referrals: (parseFloat(referrer.total_earned_from_referrals) + referralReward).toString()
            })
            .eq('id', deposit.users.referred_by)
        }
      }
    }
  } catch (error) {
    console.error('Error handling referral reward:', error)
  }
}

async function checkBurns() {
  console.log('Checking for burn transactions...')

  try {
    // This would check for burn notifications from jetton wallets
    // For now, return a placeholder response
    return new Response(JSON.stringify({
      success: true,
      message: 'Burn checking not fully implemented yet'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error checking burns:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function processMint(req: Request) {
  const { user_wallet, bim_amount, deposit_id } = await req.json()

  console.log(`Processing mint: ${bim_amount} BIM for ${user_wallet}`)

  try {
    // This is where we would integrate with TON blockchain to mint jettons
    // For now, we'll simulate the minting process and update user balances

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', user_wallet)
      .single()

    if (userError) throw userError

    // Update user BIM balance
    const newBalance = (parseFloat(user.bim_balance) + parseFloat(bim_amount)).toString()
    const newTotalDeposited = (parseFloat(user.total_deposited) + parseFloat(bim_amount)).toString()

    const { error: updateError } = await supabase
      .from('users')
      .update({
        bim_balance: newBalance,
        total_deposited: newTotalDeposited,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    // Update deposit with mint hash (simulated)
    const simulatedMintHash = `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { error: depositUpdateError } = await supabase
      .from('deposits')
      .update({
        jetton_mint_hash: simulatedMintHash
      })
      .eq('id', deposit_id)

    if (depositUpdateError) throw depositUpdateError

    console.log(`Minted ${bim_amount} BIM for user ${user_wallet}, new balance: ${newBalance}`)

    return new Response(JSON.stringify({
      success: true,
      mint_hash: simulatedMintHash,
      new_balance: newBalance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing mint:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getBalance(params: URLSearchParams) {
  const walletAddress = params.get('wallet_address')
  
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Get TON balance using TON Center API with API key  
    const response = await fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${walletAddress}&api_key=${TON_CENTER_API_KEY}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    let tonBalance = '0'
    if (response.ok) {
      const data = await response.json()
      console.log(`TON Balance API Response:`, data)
      tonBalance = data.result && data.result.balance ? (parseInt(data.result.balance) / 1000000000).toString() : '0'
    } else {
      console.error(`TON Center API error: ${response.status}`)
    }

    // Get user's internal BIM/OBA balances from database
    const { data: user } = await supabase
      .from('users')
      .select('bim_balance, oba_balance')
      .eq('wallet_address', walletAddress)
      .maybeSingle()

    // Get real Bimcoin jetton balance directly from user's main wallet
    let realBimcoinBalance = '0'
    try {
      if (MINTER_ADDRESS) {
        console.log('Fetching Bimcoin jetton balance from main wallet...')
        
        // Check jetton balance directly from main wallet using TonAPI
        const jettonBalanceResponse = await fetch(`https://tonapi.io/v2/accounts/${walletAddress}/jettons/${MINTER_ADDRESS}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (jettonBalanceResponse.ok) {
          const jettonBalanceData = await jettonBalanceResponse.json()
          console.log('TonAPI jetton balance response:', jettonBalanceData)
          
          if (jettonBalanceData.balance) {
            // Convert from nano-jettons to jettons (divide by 1,000,000,000)
            realBimcoinBalance = (parseInt(jettonBalanceData.balance) / 1000000000).toString()
            console.log(`Real Bimcoin balance: ${realBimcoinBalance}`)
          }
        } else {
          console.log(`TonAPI jetton balance failed: ${jettonBalanceResponse.status}`)
          // Fallback: try TON Center API if TonAPI fails
          const tonCenterResponse = await fetch(`https://toncenter.com/api/v2/getTokenData?address=${walletAddress}&jetton=${MINTER_ADDRESS}&api_key=${TON_CENTER_API_KEY}`)
          
          if (tonCenterResponse.ok) {
            const tonCenterData = await tonCenterResponse.json()
            console.log('TON Center jetton balance response:', tonCenterData)
            
            if (tonCenterData.ok && tonCenterData.result && tonCenterData.result.balance) {
              realBimcoinBalance = (parseInt(tonCenterData.result.balance) / 1000000000).toString()
              console.log(`Real Bimcoin balance from TON Center: ${realBimcoinBalance}`)
            }
          }
        }
      }
    } catch (jettonError) {
      console.log(`Failed to fetch real Bimcoin balance: ${jettonError.message}`)
      // Continue with 0 balance if jetton balance fetch fails
    }

    return new Response(JSON.stringify({
      ton_balance: tonBalance,
      bim_balance: user?.bim_balance || '0',  // Internal app balance
      oba_balance: user?.oba_balance || '0',  // Internal app balance
      real_bimcoin_balance: realBimcoinBalance  // Real on-chain jetton balance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting balance:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}