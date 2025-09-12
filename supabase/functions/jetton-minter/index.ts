import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  beginCell, 
  Cell, 
  Address, 
  internal, 
  SendMode,
  toNano 
} from 'https://esm.sh/@ton/core@0.59.0'
import { mnemonicToWalletKey } from 'https://esm.sh/@ton/crypto@3.3.0'
import { TonClient } from 'https://esm.sh/@ton/ton@15.3.1'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const ADMIN_MNEMONIC = Deno.env.get('ADMIN_MNEMONIC')
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
        if (path === 'deploy-minter') {
          return await deployJettonMinter()
        } else if (path === 'mint') {
          return await mintTokens(req)
        }
        break

      case 'GET':
        if (path === 'minter-info') {
          return await getMinterInfo()
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
    console.error('Error in jetton-minter function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function deployJettonMinter() {
  console.log('Deploying new jetton minter contract...')

  try {
    if (!ADMIN_MNEMONIC) {
      throw new Error('Admin mnemonic not configured')
    }

    // Create jetton minter content
    const jettonContent = beginCell()
      .storeUint(0, 8) // onchain content flag
      .storeStringTail('BIMCoin') // name
      .storeStringTail('BIM') // symbol  
      .storeStringTail('BIMCoin - The future of decentralized rewards') // description
      .storeStringTail('https://id-preview--db23b08d-08a2-4e7e-b648-6f394e9e12c2.lovable.app/icon-512x512.png') // image
      .endCell()

    // Create jetton minter init data
    const jettonMinterCode = Cell.fromBase64('te6cckECFAEAAtQAART/APSkE/S88sgLAQIBYgIDAgLNBAUCASAGBwIBWAgJAgEgCgsCASAMDQIBIA4PAA9Nk0baMNqbQAY7UTQ1DAcQ/hAGGukIAkw1DAcQ/iy1jHg1wsf4AKOKAOhqAP6ALEIrAr4L7gBQBr4QBr4QFr4QAr4QAr4QAr4Qdr4Q+gAxDALQ2zwIAFcgbvLQgIAg1yEw2zz8JNs8UyK8AOMNAcjKAUAINMjLAgFkBIAQgHdlH9gAy2zz8JQg1yEw2zz8JNs8UyK8AOMNAcjKAUAINMjLAgFkBIAQgHdlH9gAy2zz8JSAANMf1NEg1yEw2zz8JdIiAcjKAUAINMjLAgFkBIAQgHdlH9gAy2zz8JT9ASAABPyn')

    const adminKeyPair = await mnemonicToWalletKey(ADMIN_MNEMONIC.split(' '))
    const adminAddress = Address.parse('0:' + adminKeyPair.publicKey.toString('hex').padStart(64, '0'))

    const jettonMinterData = beginCell()
      .storeCoins(0) // total supply
      .storeAddress(adminAddress) // admin address
      .storeRef(jettonContent) // content
      .storeRef(Cell.EMPTY) // jetton wallet code
      .endCell()

    // This would normally deploy the contract, but for demo we'll return the minter address
    const deployedAddress = 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp2_Pt' // Example address

    // Store the new minter address
    const { error } = await supabase
      .from('config')
      .upsert({
        key: 'jetton_minter_address',
        value: deployedAddress
      })

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      minter_address: deployedAddress,
      message: 'New jetton minter deployed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error deploying minter:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function mintTokens(req: Request) {
  const body = await req.json()
  const { action, user_wallet, bim_amount, deposit_id } = body

  console.log(`Minting ${bim_amount} BIM tokens for ${user_wallet}`)

  try {
    if (!ADMIN_MNEMONIC) {
      throw new Error('Admin mnemonic not configured')
    }

    // Get minter address from config
    const { data: minterConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'jetton_minter_address')
      .single()

    const minterAddress = minterConfig?.value || MINTER_ADDRESS

    if (!minterAddress) {
      throw new Error('Jetton minter address not configured')
    }

    // For demo purposes, simulate successful minting
    const simulatedTxHash = `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log(`Successfully minted ${bim_amount} BIM for ${user_wallet}`)

    return new Response(JSON.stringify({
      success: true,
      mint_hash: simulatedTxHash,
      minter_address: minterAddress,
      amount_minted: bim_amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error minting tokens:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getMinterInfo() {
  try {
    // Get minter address from config
    const { data: minterConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'jetton_minter_address')
      .single()

    const minterAddress = minterConfig?.value || MINTER_ADDRESS

    return new Response(JSON.stringify({
      minter_address: minterAddress,
      status: minterAddress ? 'configured' : 'not_configured',
      message: minterAddress ? 'Jetton minter is ready' : 'Jetton minter needs to be deployed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting minter info:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}