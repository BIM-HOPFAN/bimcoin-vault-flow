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
        if (path === 'start') {
          return await startMining(req)
        } else if (path === 'claim') {
          return await claimMining(req)
        }
        break

      case 'GET':
        if (path === 'status') {
          return await getMiningStatus(url.searchParams)
        } else if (path === 'history') {
          return await getMiningHistory(url.searchParams)
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
    console.error('Error in mining-api function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function startMining(req: Request) {
  const { wallet_address } = await req.json()

  if (!wallet_address) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single()

  if (userError) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check if user has active mining session
  const { data: activeMining } = await supabase
    .from('mining_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (activeMining) {
    return new Response(JSON.stringify({ 
      error: 'Mining session already active',
      active_session: activeMining 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Start new mining session
  const { data: miningSession, error: miningError } = await supabase
    .from('mining_sessions')
    .insert({
      user_id: user.id,
      start_time: new Date().toISOString(),
      status: 'active'
    })
    .select()
    .single()

  if (miningError) throw miningError

  // Update user activity
  await supabase
    .from('users')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', user.id)

  return new Response(JSON.stringify({
    success: true,
    mining_session: miningSession
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function claimMining(req: Request) {
  const { wallet_address } = await req.json()

  if (!wallet_address) {
    return new Response(JSON.stringify({ error: 'Wallet address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get user and active mining session
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single()

  if (userError) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: activeMining, error: miningError } = await supabase
    .from('mining_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (miningError || !activeMining) {
    return new Response(JSON.stringify({ error: 'No active mining session' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Calculate mining rewards
  const { data: miningConfig } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'mining_rate_per_second')
    .single()

  if (!miningConfig) {
    return new Response(JSON.stringify({ error: 'Mining rate not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const miningRatePerSecond = parseFloat(miningConfig.value)
  const startTime = new Date(activeMining.start_time).getTime()
  const endTime = Date.now()
  const durationSeconds = Math.floor((endTime - startTime) / 1000)
  const obaEarned = durationSeconds * miningRatePerSecond

  // Update mining session
  const { error: updateMiningError } = await supabase
    .from('mining_sessions')
    .update({
      end_time: new Date().toISOString(),
      duration_seconds: durationSeconds,
      oba_earned: obaEarned.toString(),
      status: 'claimed',
      claimed_at: new Date().toISOString()
    })
    .eq('id', activeMining.id)

  if (updateMiningError) throw updateMiningError

  // Update user OBA balance and stats
  const { error: userUpdateError } = await supabase
    .from('users')
    .update({
      oba_balance: (parseFloat(user.oba_balance) + obaEarned).toString(),
      total_mined: (parseFloat(user.total_mined) + obaEarned).toString(),
      last_activity_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (userUpdateError) throw userUpdateError

  return new Response(JSON.stringify({
    success: true,
    oba_earned: obaEarned,
    duration_seconds: durationSeconds
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function getMiningStatus(params: URLSearchParams) {
  const walletAddress = params.get('wallet_address')
  
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
    return new Response(JSON.stringify({ active_mining: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: activeMining } = await supabase
    .from('mining_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  let currentEarnings = 0
  if (activeMining) {
    const { data: miningConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'mining_rate_per_second')
      .single()

    if (miningConfig) {
      const miningRatePerSecond = parseFloat(miningConfig.value)
      const startTime = new Date(activeMining.start_time).getTime()
      const currentTime = Date.now()
      const durationSeconds = Math.floor((currentTime - startTime) / 1000)
      currentEarnings = durationSeconds * miningRatePerSecond
    }
  }

  return new Response(JSON.stringify({
    active_mining: activeMining,
    current_earnings: currentEarnings
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function getMiningHistory(params: URLSearchParams) {
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
    return new Response(JSON.stringify({ sessions: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: sessions, error } = await supabase
    .from('mining_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return new Response(JSON.stringify({ sessions }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}