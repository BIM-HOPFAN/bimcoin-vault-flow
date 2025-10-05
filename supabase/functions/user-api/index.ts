import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyWalletAuth, validateWalletAddress } from '../_shared/auth-verification.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface User {
  wallet_address: string
  bim_balance: string
  oba_balance: string
  total_deposited: string
  total_mined: string
  total_earned_from_tasks: string
  total_earned_from_referrals: string
  referral_code: string
  referred_by?: string
  is_active: boolean
  last_activity_at: string
  created_at: string
  updated_at: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    switch (req.method) {
      case 'GET':
        if (path === 'profile') {
          return await getUserProfile(url.searchParams)
        } else if (path === 'stats') {
          return await getUserStats(url.searchParams)
        } else if (path === 'leaderboard') {
          return await getLeaderboard(url.searchParams)
        }
        break

      case 'POST':
        if (path === 'register') {
          // Verify wallet authentication for register
          const { walletAddress: authWallet, errorResponse } = verifyWalletAuth(req)
          if (errorResponse) return errorResponse
          return await registerUser(req, authWallet!)
        } else if (path === 'activity') {
          // Verify wallet authentication for activity update
          const { walletAddress: authWallet, errorResponse } = verifyWalletAuth(req)
          if (errorResponse) return errorResponse
          return await updateActivity(req, authWallet!)
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
    console.error('Error in user-api function:', error)
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getUserProfile(params: URLSearchParams) {
  const walletAddress = params.get('wallet_address')
  
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!validateWalletAddress(walletAddress)) {
    return new Response(JSON.stringify({ error: 'Invalid wallet address format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: user, error } = await supabase
    .rpc('get_user_by_wallet', { wallet_addr: walletAddress })

  if (error) {
    throw error
  }

  // Return first user if array is returned, or null if no user found
  const userData = Array.isArray(user) ? (user.length > 0 ? user[0] : null) : user

  return new Response(JSON.stringify({ user: userData }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function registerUser(req: Request, authenticatedWallet: string) {
  const { wallet_address, referral_code } = await req.json()

  // Verify the wallet in the body matches the authenticated wallet
  if (wallet_address !== authenticatedWallet) {
    return new Response(JSON.stringify({ error: 'Wallet address mismatch' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!wallet_address) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!validateWalletAddress(wallet_address)) {
    return new Response(JSON.stringify({ error: 'Invalid wallet address format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single()

  if (existingUser) {
    return new Response(JSON.stringify({ user: existingUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  let referredBy = null

  // Handle referral code if provided
  if (referral_code) {
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referral_code)
      .single()

    if (referrer) {
      referredBy = referrer.id
    }
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      wallet_address,
      referred_by: referredBy
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return new Response(JSON.stringify({ user: newUser }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function updateActivity(req: Request, authenticatedWallet: string) {
  const { wallet_address } = await req.json()

  // Verify the wallet in the body matches the authenticated wallet
  if (wallet_address !== authenticatedWallet) {
    return new Response(JSON.stringify({ error: 'Wallet address mismatch' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!wallet_address) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!validateWalletAddress(wallet_address)) {
    return new Response(JSON.stringify({ error: 'Invalid wallet address format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data, error } = await supabase
    .from('users')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('wallet_address', wallet_address)
    .select()
    .single()

  if (error) {
    throw error
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function getUserStats(params: URLSearchParams) {
  const walletAddress = params.get('wallet_address')
  
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!validateWalletAddress(walletAddress)) {
    return new Response(JSON.stringify({ error: 'Invalid wallet address format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, total_deposited, total_mined, total_earned_from_tasks, total_earned_from_referrals')
    .eq('wallet_address', walletAddress)
    .single()

  if (userError) {
    throw userError
  }

  // Get referral count
  const { count: referralCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact' })
    .eq('referrer_id', user.id)
    .eq('status', 'completed')

  // Get active mining session
  const { data: activeMining } = await supabase
    .from('mining_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const stats = {
    total_deposited: user.total_deposited,
    total_mined: user.total_mined,
    total_earned_from_tasks: user.total_earned_from_tasks,
    total_earned_from_referrals: user.total_earned_from_referrals,
    referral_count: referralCount || 0,
    active_mining: !!activeMining
  }

  return new Response(JSON.stringify({ stats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function getLeaderboard(params: URLSearchParams) {
  const limit = parseInt(params.get('limit') || '10')
  
  const { data: leaderboard, error } = await supabase
    .rpc('get_public_leaderboard', { limit_count: limit })

  if (error) {
    throw error
  }

  return new Response(JSON.stringify({ leaderboard }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}