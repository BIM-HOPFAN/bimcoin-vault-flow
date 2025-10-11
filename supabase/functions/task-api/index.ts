import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyWalletAuth } from '../_shared/auth-verification.ts'
import { verifyAdminAuth } from '../_shared/admin-verification.ts'
import { validateTaskData, validateTaskUpdateData, validateVerificationData } from '../_shared/task-validation.ts'

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
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const path = pathSegments[pathSegments.length - 1]
    const secondLastPath = pathSegments[pathSegments.length - 2]

    // Admin routes - require wallet authentication and admin verification
    if (secondLastPath === 'admin') {
      // Verify wallet authentication first
      const { walletAddress, errorResponse: authError } = verifyWalletAuth(req)
      if (authError) return authError

      // Verify admin authorization
      const { isAdmin, errorResponse: adminError } = await verifyAdminAuth(walletAddress!, supabase)
      if (adminError) return adminError

      switch (req.method) {
        case 'GET':
          if (path === 'tasks') {
            return await getAdminTasks()
          }
          break
        case 'POST':
          if (path === 'tasks') {
            return await createTask(req)
          }
          break
        case 'PUT':
          return await updateTask(req, path)
        case 'DELETE':
          return await deleteTask(path)
      }
    }

    // Regular user routes
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
          return await completeTaskWithVerification(req)
        } else if (path === 'verify') {
          return await verifyTaskCompletion(req)
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
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
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

// Admin Functions
async function getAdminTasks() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return new Response(JSON.stringify({ 
    success: true, 
    data: tasks 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function createTask(req: Request) {
  try {
    const rawData = await req.json()
    
    // Validate and sanitize input
    const taskData = validateTaskData(rawData)
  
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description,
        reward_amount: taskData.reward_amount,
        task_type: taskData.task_type,
        external_url: taskData.external_url || null,
        is_active: taskData.is_active,
        daily_limit: taskData.daily_limit,
        verification_type: taskData.verification_type,
        verification_data: taskData.verification_data,
        completion_timeout: taskData.completion_timeout
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ 
      success: true, 
      data: task 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (validationError) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: validationError instanceof Error ? validationError.message : 'Validation failed' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function updateTask(req: Request, taskId: string) {
  try {
    const rawData = await req.json()
    
    // Validate and sanitize input
    const updateData = validateTaskUpdateData(rawData)
  
    const { data: task, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ 
      success: true, 
      data: task 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (validationError) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: validationError instanceof Error ? validationError.message : 'Validation failed' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function deleteTask(taskId: string) {
  const { error } = await supabase
    .from('tasks')
    .update({ is_active: false })
    .eq('id', taskId)

  if (error) throw error

  return new Response(JSON.stringify({ 
    success: true 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Enhanced task completion with verification
async function completeTaskWithVerification(req: Request) {
  const { wallet_address, task_id, verification_data } = await req.json()

  // Validate verification data if provided
  if (verification_data && Object.keys(verification_data).length > 0) {
    try {
      validateVerificationData(verification_data)
    } catch (validationError) {
      return new Response(
        JSON.stringify({ 
          error: validationError instanceof Error ? validationError.message : 'Invalid verification data' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

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

  // Perform verification based on task type
  const verificationResult = await performTaskVerification(user, task, verification_data)
  
  // Log verification attempt
  await supabase
    .from('task_verification_logs')
    .insert({
      user_id: user.id,
      task_id: task_id,
      verification_type: task.verification_type,
      verification_attempt: verification_data || {},
      success: verificationResult.success,
      error_message: 'error' in verificationResult ? verificationResult.error : null
    })

  if (!verificationResult.success) {
    return new Response(JSON.stringify({ 
      error: 'error' in verificationResult ? verificationResult.error : 'Task verification failed' 
    }), {
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
      verification_status: 'verified',
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      reward_earned: task.reward_amount.toString(),
      verification_data: verification_data || {}
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
    new_oba_balance: newObaBalance,
    verification_status: 'verified'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Verification system
async function performTaskVerification(user: any, task: any, verificationData: any) {
  switch (task.verification_type) {
    case 'manual':
      return { success: true }
    
    case 'url_visit':
      return await verifyUrlVisit(task, verificationData)
    
    case 'social_follow':
      return await verifySocialFollow(task, verificationData)
    
    case 'deposit_check':
      return await verifyDeposit(user, task, verificationData)
    
    case 'time_based':
      return await verifyTimeBased(task, verificationData)
    
    default:
      return { success: false, error: 'Unknown verification type' }
  }
}

async function verifyUrlVisit(task: any, verificationData: any) {
  // For URL visit, we could track referrers or implement a time-based check
  // This is a simplified version
  if (verificationData?.visited_url === task.external_url) {
    return { success: true }
  }
  return { success: false, error: 'URL visit not verified' }
}

async function verifySocialFollow(task: any, verificationData: any) {
  // This would integrate with social media APIs to check if user followed
  // For now, return success (would need actual API integration)
  return { success: true }
}

async function verifyDeposit(user: any, task: any, verificationData: any) {
  // Check if user has made a deposit recently
  const { data: deposits } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  return { 
    success: deposits && deposits.length > 0,
    error: deposits?.length === 0 ? 'No recent deposits found' : undefined
  }
}

async function verifyTimeBased(task: any, verificationData: any) {
  // Check if enough time has passed or specific time criteria met
  const startTime = verificationData?.start_time
  if (!startTime) {
    return { success: false, error: 'Start time not provided' }
  }
  
  const elapsed = Date.now() - new Date(startTime).getTime()
  const requiredTime = (task.completion_timeout || 300) * 1000 // Convert to milliseconds
  
  return { 
    success: elapsed >= requiredTime,
    error: elapsed < requiredTime ? `Need to wait ${Math.ceil((requiredTime - elapsed) / 1000)} more seconds` : undefined
  }
}

async function verifyTaskCompletion(req: Request) {
  const { wallet_address, task_id, verification_data } = await req.json()
  
  // Get user and task
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single()

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', task_id)
    .single()

  if (!user || !task) {
    return new Response(JSON.stringify({ error: 'User or task not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const verificationResult = await performTaskVerification(user, task, verification_data)
  
  return new Response(JSON.stringify({
    success: verificationResult.success,
    error: 'error' in verificationResult ? verificationResult.error : undefined,
    verification_type: task.verification_type
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}