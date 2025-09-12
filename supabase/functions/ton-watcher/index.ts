import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function checkDeposits() {
  console.log('Checking for new deposits...')

  try {
    // Get recent transactions to treasury
    const response = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${TREASURY_ADDRESS}&limit=20&archival=false`, {
      headers: {
        'X-API-Key': TON_CENTER_API_KEY || ''
      }
    })

    if (!response.ok) {
      throw new Error(`TON Center API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.ok || !data.result) {
      throw new Error('Invalid response from TON Center API')
    }

    let processedCount = 0

    for (const tx of data.result) {
      if (tx.in_msg && tx.in_msg.message) {
        const message = tx.in_msg.message
        
        // Check if message contains deposit comment format
        if (message && typeof message === 'string' && message.startsWith('BIM:DEPOSIT:')) {
          const depositComment = message
          const txHash = tx.transaction_id.hash
          const amount = tx.in_msg.value ? (parseInt(tx.in_msg.value) / 1000000000).toString() : '0'

          console.log(`Found deposit: ${depositComment}, hash: ${txHash}, amount: ${amount} TON`)

          // Check if we already processed this transaction
          const { data: existingDeposit } = await supabase
            .from('deposits')
            .select('id')
            .eq('deposit_hash', txHash)
            .single()

          if (existingDeposit) {
            console.log(`Deposit already processed: ${txHash}`)
            continue
          }

          // Find pending deposit with this comment
          const { data: pendingDeposit, error: depositError } = await supabase
            .from('deposits')
            .select('*, users(*)')
            .eq('deposit_comment', depositComment)
            .eq('status', 'pending')
            .single()

          if (depositError || !pendingDeposit) {
            console.log(`No pending deposit found for comment: ${depositComment}`)
            continue
          }

          // Verify amount matches (with some tolerance)
          const expectedAmount = parseFloat(pendingDeposit.ton_amount)
          const actualAmount = parseFloat(amount)
          const tolerance = 0.001 // 0.001 TON tolerance

          if (Math.abs(expectedAmount - actualAmount) > tolerance) {
            console.log(`Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`)
            continue
          }

          // Update deposit status
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
            continue
          }

          // Trigger jetton minting process
          try {
            const mintResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/jetton-minter/mint`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              },
              body: JSON.stringify({
                user_wallet: pendingDeposit.users.wallet_address,
                bim_amount: pendingDeposit.bim_amount,
                deposit_id: pendingDeposit.id
              })
            })

            if (!mintResponse.ok) {
              console.error(`Jetton mint request failed: ${mintResponse.status}`)
            } else {
              console.log(`Jetton minting initiated for deposit ${pendingDeposit.id}`)
            }
          } catch (mintError) {
            console.error(`Jetton mint process error: ${mintError.message}`)
          }

          processedCount++
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed_deposits: processedCount,
      checked_transactions: data.result.length
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
    // Get TON balance
    const response = await fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${walletAddress}`, {
      headers: {
        'X-API-Key': TON_CENTER_API_KEY || ''
      }
    })

    if (!response.ok) {
      throw new Error(`TON Center API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.ok) {
      throw new Error('Invalid response from TON Center API')
    }

    const tonBalance = data.result?.balance ? (parseInt(data.result.balance) / 1000000000).toString() : '0'

    // Get user's BIM/OBA balances from database
    const { data: user } = await supabase
      .from('users')
      .select('bim_balance, oba_balance')
      .eq('wallet_address', walletAddress)
      .single()

    return new Response(JSON.stringify({
      ton_balance: tonBalance,
      bim_balance: user?.bim_balance || '0',
      oba_balance: user?.oba_balance || '0'
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