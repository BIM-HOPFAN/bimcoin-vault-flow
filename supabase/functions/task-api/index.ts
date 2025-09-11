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
        if (path === 'available') {
          return await getAvailableTasks(url.searchParams)
        } else if (path === 'user-tasks') {
          return await getUserTasks(url.searchParams)
        }
        break

      case 'POST':
        if (path === 'complete') {
          return await completeTask(req)
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
    console.error('Error in task-api function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getAvailableTasks(params: URLSearchParams) {
  const walletAddress = params.get('wallet_address')

  // Get all active tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (tasksError) throw tasksError

  if (!walletAddress) {
    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get user and their completed tasks for today
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single()

  let completedTaskIds = []
  if (user) {
    const today = new Date().toISOString().split('T')[0]
    const { data: completedTasks } = await supabase
      .from('user_tasks')
      .select('task_id')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`)

    completedTaskIds = completedTasks?.map(t => t.task_id) || []
  }

  // Mark tasks as completed if user has done them today
  const tasksWithStatus = tasks.map(task => ({
    ...task,
    completed_today: completedTaskIds.includes(task.id)
  }))

  return new Response(JSON.stringify({ tasks: tasksWithStatus }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function getUserTasks(params: URLSearchParams) {
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
    return new Response(JSON.stringify({ user_tasks: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: userTasks, error } = await supabase
    .from('user_tasks')
    .select(`
      *,
      tasks (
        title,
        description,
        task_type,
        external_url
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return new Response(JSON.stringify({ user_tasks: userTasks }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function completeTask(req: Request) {
  const { wallet_address, task_id } = await req.json()

  if (!wallet_address || !task_id) {
    return new Response(JSON.stringify({ error: 'Wallet address and task ID required' }), {
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

  // Get task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', task_id)
    .eq('is_active', true)
    .single()

  if (taskError) {
    return new Response(JSON.stringify({ error: 'Task not found or inactive' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check if user has already completed this task today
  const today = new Date().toISOString().split('T')[0]
  const { data: existingUserTask } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('task_id', task_id)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)
    .single()

  if (existingUserTask) {
    return new Response(JSON.stringify({ error: 'Task already completed today' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Create user task completion record
  const { data: userTask, error: userTaskError } = await supabase
    .from('user_tasks')
    .insert({
      user_id: user.id,
      task_id: task_id,
      status: 'completed',
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
      reward_earned: task.reward_amount.toString()
    })
    .select()
    .single()

  if (userTaskError) throw userTaskError

  // Update user OBA balance and task earnings
  const newObaBalance = parseFloat(user.oba_balance) + parseFloat(task.reward_amount)
  const newTaskEarnings = parseFloat(user.total_earned_from_tasks) + parseFloat(task.reward_amount)

  const { error: userUpdateError } = await supabase
    .from('users')
    .update({
      oba_balance: newObaBalance.toString(),
      total_earned_from_tasks: newTaskEarnings.toString(),
      last_activity_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (userUpdateError) throw userUpdateError

  return new Response(JSON.stringify({
    success: true,
    reward_earned: task.reward_amount,
    new_oba_balance: newObaBalance
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}