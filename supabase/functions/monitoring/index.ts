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
      case 'GET':
        if (path === 'health') {
          return await healthCheck()
        } else if (path === 'metrics') {
          return await getMetrics()
        } else if (path === 'system-status') {
          return await getSystemStatus()
        }
        break

      default:
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
    console.error('Error in monitoring function:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      status: 'unhealthy'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

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

  // TON API connectivity check
  try {
    const tonStartTime = Date.now()
    const apiKey = Deno.env.get('TON_CENTER_API_KEY')
    const response = await fetch(`https://toncenter.com/api/v2/getMasterchainInfo${apiKey ? `?api_key=${apiKey}` : ''}`)
    const tonResponseTime = Date.now() - tonStartTime
    
    checks.push({
      service: 'ton_api',
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTime: tonResponseTime,
      statusCode: response.status
    })
  } catch (error) {
    checks.push({
      service: 'ton_api',
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

async function getMetrics() {
  try {
    // Get recent activity metrics
    const { data: recentDeposits } = await supabase
      .from('deposits')
      .select('count')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const { data: pendingDeposits } = await supabase
      .from('deposits')
      .select('count')
      .eq('status', 'pending')

    const { data: activeUsers } = await supabase
      .from('users')
      .select('count')
      .gte('last_activity_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const { data: totalUsers } = await supabase
      .from('users')
      .select('count')

    const { data: recentBurns } = await supabase
      .from('burns')
      .select('count')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: {
        deposits_24h: recentDeposits?.length || 0,
        pending_deposits: pendingDeposits?.length || 0,
        active_users_24h: activeUsers?.length || 0,
        total_users: totalUsers?.length || 0,
        burns_24h: recentBurns?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting metrics:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to get metrics',
      details: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getSystemStatus() {
  try {
    // Check for system issues
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Check for stuck pending deposits
    const { data: stuckDeposits } = await supabase
      .from('deposits')
      .select('id, created_at')
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo.toISOString())

    // Check for failed deposits in last hour
    const { data: recentFailures } = await supabase
      .from('deposits')
      .select('id, created_at')
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo.toISOString())

    const issues = []
    
    if (stuckDeposits && stuckDeposits.length > 0) {
      issues.push({
        type: 'stuck_deposits',
        count: stuckDeposits.length,
        severity: 'warning',
        message: `${stuckDeposits.length} deposits have been pending for over 1 hour`
      })
    }

    if (recentFailures && recentFailures.length > 5) {
      issues.push({
        type: 'high_failure_rate',
        count: recentFailures.length,
        severity: 'critical',
        message: `High failure rate: ${recentFailures.length} failed deposits in the last hour`
      })
    }

    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      status: issues.length === 0 ? 'operational' : 'degraded',
      issues,
      uptime: {
        // This would typically come from a monitoring service
        percentage: 99.9,
        last_incident: null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting system status:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to get system status',
      details: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}