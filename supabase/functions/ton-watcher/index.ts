import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

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

  if (!TREASURY_ADDRESS) {
    console.error('Treasury address not configured')
    return new Response(JSON.stringify({ error: 'Treasury address not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  console.log(`Using treasury address: ${TREASURY_ADDRESS}`)

  // Remove automatic processing of pending deposits without transaction verification
  // Only process deposits that have actual blockchain transaction evidence

  try {
    // Get recent transactions to treasury using TON Center API with API key
    const apiUrl = `https://toncenter.com/api/v2/getTransactions?address=${TREASURY_ADDRESS}&limit=20&api_key=5d06654f912fed525feb10c1608af9dcd8e06dc5aa2eb2927e2643b1965afa78`
    console.log(`Fetching transactions from: ${apiUrl}`)
    
    const response = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`TON API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`API Response:`, data)
    
    if (!data.result) {
      console.log('No result found in response')
      return new Response(JSON.stringify({
        success: true,
        processed_deposits: 0,
        checked_transactions: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let processedCount = 0

    for (const tx of data.result) {
      // Check for incoming transactions with comments
      if (tx.in_msg && tx.in_msg.message) {
        const comment = tx.in_msg.message
        
        // Check if message contains deposit comment format
        if (comment && comment.startsWith('BIM:DEPOSIT:')) {
          const depositComment = comment
          const txHash = tx.hash
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

              // Process the deposit
              await processDeposit(depositComment, txHash, amount)
              processedCount++
            }
          }
        }
      }
    }
    return new Response(JSON.stringify({
      success: true,
      processed_deposits: processedCount,
      checked_transactions: data.result?.length || 0
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

async function processDeposit(depositComment: string, txHash: string, amount: string) {
  try {
    // Find pending deposit with this comment
    const { data: pendingDeposit, error: depositError } = await supabase
      .from('deposits')
      .select('*, users(*)')
      .eq('deposit_comment', depositComment)
      .eq('status', 'pending')
      .single()

    if (depositError || !pendingDeposit) {
      console.log(`No pending deposit found for comment: ${depositComment}`)
      return
    }

    // Verify amount matches (with some tolerance)
    const expectedAmount = parseFloat(pendingDeposit.ton_amount)
    const actualAmount = parseFloat(amount)
    const tolerance = 0.001 // 0.001 TON tolerance

    if (Math.abs(expectedAmount - actualAmount) > tolerance) {
      console.log(`Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`)
      return
    }

    // Mint actual jetton tokens
    console.log(`Minting ${pendingDeposit.bim_amount} BIM tokens for ${pendingDeposit.users.wallet_address}`)
    
    const mintResponse = await fetch('https://xyskyvwxbpnlveamxwlb.supabase.co/functions/v1/jetton-minter/mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'mint',
        user_wallet: pendingDeposit.users.wallet_address,
        bim_amount: pendingDeposit.bim_amount,
        deposit_id: pendingDeposit.id,
      })
    });

    let jettonMintHash = null;
    if (mintResponse.ok) {
      const mintData = await mintResponse.json();
      if (mintData.success) {
        jettonMintHash = mintData.mint_hash;
        console.log('Jetton minted successfully:', jettonMintHash);
      } else {
        console.error('Jetton minting failed:', mintData.error);
      }
    } else {
      console.error('Jetton minting request failed:', mintResponse.status, await mintResponse.text());
    }

    // Update deposit status with both deposit hash and mint hash
    const { error: updateError } = await supabase
      .from('deposits')
      .update({
        deposit_hash: txHash,
        jetton_mint_hash: jettonMintHash,
        status: 'confirmed',
        processed_at: new Date().toISOString()
      })
      .eq('id', pendingDeposit.id)

    if (updateError) {
      console.error(`Failed to update deposit: ${updateError.message}`)
      return
    }

    // Update user's BIM balance
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        bim_balance: parseFloat(pendingDeposit.users.bim_balance) + parseFloat(pendingDeposit.bim_amount),
        total_deposited: parseFloat(pendingDeposit.users.total_deposited) + parseFloat(pendingDeposit.ton_amount)
      })
      .eq('id', pendingDeposit.user_id)

    if (userUpdateError) {
      console.error(`Failed to update user balance: ${userUpdateError.message}`)
      return
    }

    console.log(`Successfully processed deposit: ${depositComment} for ${amount} TON`)
    
  } catch (error) {
    console.error(`Error processing deposit ${depositComment}:`, error)
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
    // Get TON balance using TON Center API with API key
    const response = await fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${walletAddress}&api_key=5d06654f912fed525feb10c1608af9dcd8e06dc5aa2eb2927e2643b1965afa78`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`TON API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Balance API Response:`, data)
    
    const tonBalance = data.result && data.result.balance ? (parseInt(data.result.balance) / 1000000000).toString() : '0'

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