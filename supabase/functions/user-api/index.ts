import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
          return await registerUser(req)
        } else if (path === 'activity') {
          return await updateActivity(req)
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
    return new Response(JSON.stringify({ error: error.message }), {
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

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return new Response(JSON.stringify({ user }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function registerUser(req: Request) {
  const { wallet_address, referral_code } = await req.json()

  if (!wallet_address) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
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

async function updateActivity(req: Request) {
  const { wallet_address } = await req.json()

  if (!wallet_address) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
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
    .from('users')
    .select('wallet_address, bim_balance, oba_balance, total_deposited')
    .eq('is_active', true)
    .order('bim_balance', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return new Response(JSON.stringify({ leaderboard }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}