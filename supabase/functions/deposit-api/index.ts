import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Validation schemas
const createIntentSchema = {
  wallet_address: { required: true, pattern: /^[0-9A-Za-z_-]{48}$|^EQ[0-9A-Za-z_-]{46}$/ },
  deposit_amount: { required: true, min: 0.01, max: 1000 },
  deposit_type: { required: true, enum: ['TON', 'Bimcoin'] }
}

const processDepositSchema = {
  deposit_hash: { required: true, pattern: /^[0-9a-fA-F]{64}$/ },
  deposit_comment: { required: true, pattern: /^BIM:DEPOSIT:[0-9a-f-]{36}$/ }
}

// Enhanced logging
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logEntry = { timestamp, level, message, ...(data && { data }) }
  console.log(JSON.stringify(logEntry))
}

// Rate limiting function
function checkRateLimit(ip: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `${ip}_${Math.floor(now / windowMs)}`
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  const record = rateLimitStore.get(key)!
  if (record.count >= limit) {
    return false
  }
  
  record.count++
  return true
}

// Input validation function
function validateInput(data: any, schema: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field]
    const fieldRules = rules as any
    
    if (fieldRules.required && (!value || value === '')) {
      errors.push(`${field} is required`)
      continue
    }
    
    if (value && fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors.push(`${field} has invalid format`)
    }
    
    if (value && fieldRules.min && parseFloat(value) < fieldRules.min) {
      errors.push(`${field} must be at least ${fieldRules.min}`)
    }
    
    if (value && fieldRules.max && parseFloat(value) > fieldRules.max) {
      errors.push(`${field} must be at most ${fieldRules.max}`)
    }
    
    if (value && fieldRules.enum && !fieldRules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${fieldRules.enum.join(', ')}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()
  const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  
  log('info', 'Request received', { requestId, method: req.method, path: new URL(req.url).pathname, clientIp })
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    log('warn', 'Rate limit exceeded', { clientIp, requestId })
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    switch (req.method) {
      case 'POST':
        if (path === 'create-intent') {
          return await createDepositIntent(req, requestId)
        } else if (path === 'process') {
          return await processDeposit(req, requestId)
        }
        break

      case 'GET':
        if (path === 'history') {
          return await getDepositHistory(url.searchParams, requestId)
        } else if (path === 'status') {
          return await getDepositStatus(url.searchParams, requestId)
        } else if (path === 'health') {
          return await healthCheck()
        }
        break

      default:
        log('warn', 'Method not allowed', { method: req.method, requestId })
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { 
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    log('error', 'Unhandled error in deposit-api', { error: (error as Error).message, requestId })
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      requestId 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function createDepositIntent(req: Request, requestId: string) {
  try {
    const body = await req.json()
    const { wallet_address, deposit_amount, deposit_type = 'TON' } = body

    // Validate input
    const validation = validateInput(body, createIntentSchema)
    if (!validation.valid) {
      log('warn', 'Invalid input for create deposit intent', { errors: validation.errors, requestId })
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        details: validation.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    log('info', 'Creating deposit intent', { wallet_address, deposit_amount, deposit_type, requestId })

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

      if (createError) {
        log('error', 'Failed to create user', { error: createError.message, requestId })
        throw createError
      }
      user = newUser
    } else if (userError) {
      log('error', 'Failed to get user', { error: userError.message, requestId })
      throw userError
    }

    // Get exchange rate based on deposit type
    let bimAmount: number;
    if (deposit_type === 'TON') {
      const { data: config, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'bim_per_ton')
        .single()

      if (configError) {
        log('error', 'Failed to get BIM per TON rate', { error: configError.message, requestId })
        throw configError
      }
      const bimPerTon = parseFloat(config.value)
      bimAmount = parseFloat(deposit_amount) * bimPerTon
    } else {
      // Bimcoin deposits: 1 Bimcoin = 1 internal BIM
      const { data: config, error: configError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'bim_per_bimcoin')
        .single()

      if (configError) {
        log('error', 'Failed to get BIM per Bimcoin rate', { error: configError.message, requestId })
        throw configError
      }
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

    if (depositError) {
      log('error', 'Failed to create deposit record', { error: depositError.message, requestId })
      throw depositError
    }

    // Get treasury address from config
    const { data: treasuryConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'treasury_address')
      .single()
    
    const treasuryAddress = treasuryConfig?.value || Deno.env.get('TREASURY_ADDRESS')

    // Get minter address for Bimcoin deposits  
    const minterAddress = deposit_type === 'Bimcoin' ? (Deno.env.get('MINTER_ADDRESS') || await getMinterAddressFromConfig()) : null;

    log('info', 'Deposit intent created successfully', { 
      depositId: deposit.id, 
      bimAmount, 
      treasuryAddress,
      requestId 
    })

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

  } catch (error) {
    log('error', 'Error in createDepositIntent', { error: (error as Error).message, requestId })
    return new Response(JSON.stringify({ 
      error: 'Failed to create deposit intent',
      details: (error as Error).message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function processDeposit(req: Request, requestId: string) {
  try {
    const body = await req.json()
    const { deposit_hash, deposit_comment } = body

    // Validate input
    const validation = validateInput(body, processDepositSchema)
    if (!validation.valid) {
      log('warn', 'Invalid input for process deposit', { errors: validation.errors, requestId })
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        details: validation.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    log('info', 'Processing deposit', { deposit_hash, deposit_comment, requestId })

    // Find deposit by comment
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .select('*, users(*)')
      .eq('deposit_comment', deposit_comment)
      .eq('status', 'pending')
      .single()

    if (depositError) {
      log('warn', 'Deposit not found or already processed', { deposit_comment, requestId })
      return new Response(JSON.stringify({ error: 'Deposit not found or already processed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update deposit with hash and mark as confirmed
    const { error: updateError } = await supabase
      .from('deposits')
      .update({
        deposit_hash,
        status: 'confirmed',
        processed_at: new Date().toISOString()
      })
      .eq('id', deposit.id)

    if (updateError) {
      log('error', 'Failed to update deposit', { error: updateError.message, requestId })
      throw updateError
    }

    // Update user last activity (balances are updated by database trigger)
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        last_activity_at: new Date().toISOString()
      })
      .eq('id', deposit.user_id)

    if (userUpdateError) {
      log('error', 'Failed to update user activity', { error: userUpdateError.message, requestId })
    }

    // Handle referral rewards if applicable
    await handleReferralReward(deposit, requestId)

    log('info', 'Deposit processed successfully', { 
      depositId: deposit.id, 
      bimAmount: deposit.bim_amount, 
      requestId 
    })

    return new Response(JSON.stringify({
      success: true,
      bim_minted: deposit.bim_amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    log('error', 'Error in processDeposit', { error: (error as Error).message, requestId })
    return new Response(JSON.stringify({ 
      error: 'Failed to process deposit',
      details: (error as Error).message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Helper function to handle referral rewards
async function handleReferralReward(deposit: any, requestId: string) {
  try {
    if (!deposit.users.referred_by) {
      return
    }

    log('info', 'Processing referral reward', { 
      depositId: deposit.id, 
      referrerId: deposit.users.referred_by, 
      requestId 
    })

    // Check if this is the first deposit for referral
    const { count: depositCount } = await supabase
      .from('deposits')
      .select('*', { count: 'exact' })
      .eq('user_id', deposit.user_id)
      .eq('status', 'confirmed')

    if (depositCount !== 1) {
      log('info', 'Not first deposit, skipping referral reward', { depositCount, requestId })
      return
    }

    // Check if referrer already had a successful referral today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { count: todayReferralCount } = await supabase
      .from('referrals')
      .select('*', { count: 'exact' })
      .eq('referrer_id', deposit.users.referred_by)
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString())

    if ((todayReferralCount || 0) > 0) {
      log('info', 'Referrer already had referral today, skipping', { todayReferralCount, requestId })
      return
    }

    const { data: referralConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'referral_rate')
      .single()

    if (!referralConfig) {
      log('warn', 'Referral rate config not found', { requestId })
      return
    }

    const referralRate = parseFloat(referralConfig.value)
    
    // Get referrer's active BIM deposits using the database function
    const { data: referrerActiveBim } = await supabase
      .rpc('get_active_deposit_bim', { user_uuid: deposit.users.referred_by })

    if (!referrerActiveBim || referrerActiveBim <= 0) {
      log('info', 'Referrer has no active BIM deposits, skipping reward', { 
        referrerActiveBim, 
        requestId 
      })
      return
    }

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

      log('info', 'Referral reward processed successfully', { 
        referralReward, 
        referrerId: deposit.users.referred_by, 
        requestId 
      })
    }

  } catch (error) {
    log('error', 'Error handling referral reward', { 
      error: (error as Error).message, 
      depositId: deposit.id,
      requestId 
    })
  }
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

async function getDepositHistory(params: URLSearchParams, requestId: string) {
  try {
    const walletAddress = params.get('wallet_address')
    const limit = parseInt(params.get('limit') || '10')
    
    if (!walletAddress) {
      log('warn', 'Missing wallet address for deposit history', { requestId })
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

    if (error) {
      log('error', 'Failed to get deposit history', { error: error.message, requestId })
      throw error
    }

    log('info', 'Deposit history retrieved', { walletAddress, count: deposits.length, requestId })

    return new Response(JSON.stringify({ deposits }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    log('error', 'Error in getDepositHistory', { error: (error as Error).message, requestId })
    return new Response(JSON.stringify({ 
      error: 'Failed to get deposit history',
      details: (error as Error).message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getDepositStatus(params: URLSearchParams, requestId: string) {
  try {
    const depositId = params.get('deposit_id')
    
    if (!depositId) {
      log('warn', 'Missing deposit ID for status check', { requestId })
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
      log('warn', 'Deposit not found', { depositId, requestId })
      return new Response(JSON.stringify({ error: 'Deposit not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    log('info', 'Deposit status retrieved', { depositId, status: deposit.status, requestId })

    return new Response(JSON.stringify({ deposit }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    log('error', 'Error in getDepositStatus', { error: (error as Error).message, requestId })
    return new Response(JSON.stringify({ 
      error: 'Failed to get deposit status',
      details: (error as Error).message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function healthCheck() {
  const startTime = Date.now()
  const checks = []

  // Database connectivity check
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1)
    checks.push({
      service: 'database',
      status: error ? 'unhealthy' : 'healthy',
      responseTime: Date.now() - startTime,
      error: error?.message
    })
  } catch (error) {
    checks.push({
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: (error as Error).message
    })
  }

  const allHealthy = checks.every(check => check.status === 'healthy')
  const totalResponseTime = Date.now() - startTime

  return new Response(JSON.stringify({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    totalResponseTime,
    checks
  }), {
    status: allHealthy ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}