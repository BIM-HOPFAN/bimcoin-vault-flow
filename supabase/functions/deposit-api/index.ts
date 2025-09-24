import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

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
        if (path === 'create-intent') {
          return await createDepositIntent(req)
        } else if (path === 'process') {
          return await processDeposit(req)
        }
        break

      case 'GET':
        if (path === 'history') {
          return await getDepositHistory(url.searchParams)
        } else if (path === 'status') {
          return await getDepositStatus(url.searchParams)
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
    console.error('Error in deposit-api function:', error)
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function createDepositIntent(req: Request) {
  const { wallet_address, deposit_amount, deposit_type = 'TON' } = await req.json()

  if (!wallet_address || !deposit_amount) {
    return new Response(JSON.stringify({ error: 'Wallet address and deposit amount required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!['TON', 'Bimcoin'].includes(deposit_type)) {
    return new Response(JSON.stringify({ error: 'Invalid deposit type. Must be TON or Bimcoin' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get or create user
  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single()

  if (userError && userError.code === 'PGRST116') {
    // User doesn't exist, create one
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ wallet_address })
      .select()
      .single()

    if (createError) throw createError
    user = newUser
  } else if (userError) {
    throw userError
  }

  // Get exchange rate based on deposit type
  let bimAmount;
  if (deposit_type === 'TON') {
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'bim_per_ton')
      .single()

    if (configError) throw configError
    const bimPerTon = parseFloat(config.value)
    bimAmount = parseFloat(deposit_amount) * bimPerTon
  } else {
    // Bimcoin deposits: 1 Bimcoin = 1 internal BIM
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'bim_per_bimcoin')
      .single()

    if (configError) throw configError
    const bimPerBimcoin = parseFloat(config.value)
    bimAmount = parseFloat(deposit_amount) * bimPerBimcoin
  }

  // Generate deposit comment
  const depositId = crypto.randomUUID()
  const depositComment = `BIM:DEPOSIT:${depositId}`

  // Create deposit record
  const { data: deposit, error: depositError } = await supabase
    .from('deposits')
    .insert({
      user_id: user.id,
      ton_amount: deposit_type === 'TON' ? deposit_amount.toString() : '0',
      bim_amount: bimAmount.toString(),
      deposit_comment: depositComment,
      deposit_type: deposit_type,
      status: 'pending'
    })
    .select()
    .single()

  if (depositError) throw depositError

  // Get treasury address from config
  const treasuryAddress = Deno.env.get('TREASURY_ADDRESS')

  // Get minter address for Bimcoin deposits  
  const minterAddress = deposit_type === 'Bimcoin' ? (Deno.env.get('MINTER_ADDRESS') || await getMinterAddressFromConfig()) : null;

  return new Response(JSON.stringify({
    deposit_id: deposit.id,
    treasury_address: treasuryAddress,
    minter_address: minterAddress,
    deposit_amount: deposit_amount,
    deposit_type: deposit_type,
    bim_amount: bimAmount,
    deposit_comment: depositComment,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function processDeposit(req: Request) {
  const { deposit_hash, deposit_comment } = await req.json()

  if (!deposit_hash || !deposit_comment) {
    return new Response(JSON.stringify({ error: 'Deposit hash and comment required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Find deposit by comment
  const { data: deposit, error: depositError } = await supabase
    .from('deposits')
    .select('*, users(*)')
    .eq('deposit_comment', deposit_comment)
    .eq('status', 'pending')
    .single()

  if (depositError) {
    return new Response(JSON.stringify({ error: 'Deposit not found or already processed' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Update deposit with hash and mark as confirmed
    const { error: updateError } = await supabase
      .from('deposits')
      .update({
        deposit_hash,
        status: 'confirmed',
        processed_at: new Date().toISOString()
      })
      .eq('id', deposit.id)

    if (updateError) throw updateError

    // Update user balances and stats
    const depositAmount = deposit.deposit_type === 'TON' ? parseFloat(deposit.ton_amount) : 0;
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        bim_balance: (parseFloat(deposit.users.bim_balance) + parseFloat(deposit.bim_amount)).toString(),
        total_deposited: (parseFloat(deposit.users.total_deposited) + depositAmount).toString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', deposit.user_id)

    if (userUpdateError) throw userUpdateError

    // Check for referral reward
    if (deposit.users.referred_by) {
      // Check if this is the first deposit for referral
      const { count: depositCount } = await supabase
        .from('deposits')
        .select('*', { count: 'exact' })
        .eq('user_id', deposit.user_id)
        .eq('status', 'confirmed')

      if (depositCount === 1) {
        // Check if referrer already had a successful referral today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const { count: todayReferralCount } = await supabase
          .from('referrals')
          .select('*', { count: 'exact' })
          .eq('referrer_id', deposit.users.referred_by)
          .eq('status', 'completed')
          .gte('completed_at', today.toISOString())

        if (todayReferralCount === 0) {
          const { data: referralConfig } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'referral_rate')
            .single()

          if (referralConfig) {
            const referralRate = parseFloat(referralConfig.value)
            
            // Get referrer's active BIM deposits using the database function
            const { data: referrerActiveBim } = await supabase
              .rpc('get_active_deposit_bim', { user_uuid: deposit.users.referred_by })

            if (referrerActiveBim && referrerActiveBim > 0) {
              const referralReward = referrerActiveBim * referralRate

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

              // Update referrer's OBA balance
              const { data: referrer } = await supabase
                .from('users')
                .select('oba_balance, total_earned_from_referrals')
                .eq('id', deposit.users.referred_by)
                .single()

              if (referrer) {
                await supabase
                  .from('users')
                  .update({
                    oba_balance: (parseFloat(referrer.oba_balance) + referralReward).toString(),
                    total_earned_from_referrals: (parseFloat(referrer.total_earned_from_referrals) + referralReward).toString()
                  })
                  .eq('id', deposit.users.referred_by)
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      bim_minted: deposit.bim_amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    // Mark deposit as failed
    await supabase
      .from('deposits')
      .update({ status: 'failed' })
      .eq('id', deposit.id)

    throw error
  }
}

async function getDepositHistory(params: URLSearchParams) {
  const walletAddress = params.get('wallet_address')
  const limit = parseInt(params.get('limit') || '10')
  
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single()

  if (!user) {
    return new Response(JSON.stringify({ deposits: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: deposits, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return new Response(JSON.stringify({ deposits }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function getDepositStatus(params: URLSearchParams) {
  const depositId = params.get('deposit_id')
  
  if (!depositId) {
    return new Response(JSON.stringify({ error: 'Deposit ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: deposit, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('id', depositId)
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: 'Deposit not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ deposit }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Helper function to get minter address from config
async function getMinterAddressFromConfig() {
  try {
    const { data: config } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'jetton_minter_address')
      .single()
    
    return config?.value || null
  } catch (error) {
    console.error('Error getting minter address from config:', error)
    return null
  }
}