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
    // Check if the session has expired (more than 24 hours)
    const startTime = new Date(activeMining.start_time).getTime()
    const now = Date.now()
    const elapsed = (now - startTime) / 1000
    const totalDuration = 24 * 60 * 60 // 24 hours

    if (elapsed >= totalDuration) {
      // Calculate final earnings for expired session
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      
      const { data: expiredSessionDeposits } = await supabase
        .from('deposits')
        .select('bim_amount')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', oneYearAgo.toISOString())

      const totalActiveBIM = expiredSessionDeposits?.reduce((sum, deposit) => 
        sum + parseFloat(deposit.bim_amount || '0'), 0
      ) || 0

      const finalEarnings = totalActiveBIM * 0.5 // 50% of active BIM deposits

      // Mark expired session as completed and award earnings
      await supabase
        .from('mining_sessions')
        .update({
          status: 'claimed',
          end_time: new Date().toISOString(),
          duration_seconds: Math.floor(elapsed),
          oba_earned: finalEarnings.toString(),
          claimed_at: new Date().toISOString()
        })
        .eq('id', activeMining.id)

      // Update user's OBA balance and total mined
      await supabase
        .from('users')
        .update({
          oba_balance: (parseFloat(user.oba_balance) + finalEarnings).toString(),
          total_mined: (parseFloat(user.total_mined) + finalEarnings).toString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      console.log(`Auto-completed expired mining session for user ${user.id}, earned: ${finalEarnings} OBA`)
    } else {
      return new Response(JSON.stringify({ 
        error: 'Mining session already active',
        active_session: activeMining 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Check if user has active BIM deposits (365 days)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  
  const { data: activeDeposits, error: depositsError } = await supabase
    .from('deposits')
    .select('bim_amount')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', oneYearAgo.toISOString())

  if (depositsError) {
    console.error('Error fetching deposits:', depositsError)
    return new Response(JSON.stringify({ error: 'Failed to fetch deposits' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const totalActiveBIM = activeDeposits?.reduce((sum, deposit) => 
    sum + parseFloat(deposit.bim_amount || '0'), 0
  ) || 0

  if (totalActiveBIM === 0) {
    return new Response(JSON.stringify({ error: 'No active BIM deposits found. You need BIM deposits from the last 365 days to start mining.' }), {
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

  // Calculate mining rewards based on active BIM deposits (365 days)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  
  const { data: activeDeposits, error: depositsError } = await supabase
    .from('deposits')
    .select('bim_amount')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', oneYearAgo.toISOString())

  if (depositsError) {
    console.error('Error fetching deposits:', depositsError)
    return new Response(JSON.stringify({ error: 'Failed to fetch deposits' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Calculate total active BIM deposits
  const totalActiveBIM = activeDeposits?.reduce((sum, deposit) => 
    sum + parseFloat(deposit.bim_amount || '0'), 0
  ) || 0

  if (totalActiveBIM === 0) {
    return new Response(JSON.stringify({ error: 'No active deposits for mining' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Calculate 50% per day mining rate: (totalBIM * 0.5) / 86400 seconds
  const miningRatePerSecond = (totalActiveBIM * 0.5) / 86400
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
  let totalActiveBIM = 0
  
  if (activeMining) {
    // Calculate active BIM deposits (365 days)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    const { data: activeDeposits } = await supabase
      .from('deposits')
      .select('bim_amount')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', oneYearAgo.toISOString())

    totalActiveBIM = activeDeposits?.reduce((sum, deposit) => 
      sum + parseFloat(deposit.bim_amount || '0'), 0
    ) || 0

    if (totalActiveBIM > 0) {
      // Calculate 50% per day mining rate: (totalBIM * 0.5) / 86400 seconds
      const miningRatePerSecond = (totalActiveBIM * 0.5) / 86400
      const startTime = new Date(activeMining.start_time).getTime()
      const currentTime = Date.now()
      const durationSeconds = Math.floor((currentTime - startTime) / 1000)
      currentEarnings = durationSeconds * miningRatePerSecond
    }
  }

  return new Response(JSON.stringify({
    active_mining: activeMining,
    current_earnings: currentEarnings,
    total_active_bim: totalActiveBIM
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