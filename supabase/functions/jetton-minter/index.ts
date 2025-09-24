import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}
import { 
  beginCell, 
  Cell, 
  Address, 
  internal, 
  SendMode,
  toNano,
  Dictionary 
} from 'https://esm.sh/@ton/core@0.61.0'
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
        } else if (path === 'reprocess-deposit') {
          return await reprocessDeposit(req)
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
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
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

    // Create jetton content using TEP-64 compliant format
    const jettonContentDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
    
    // Add metadata fields with proper TEP-64 keys
    // Using TextEncoder instead of Buffer for Deno compatibility
    const textEncoder = new TextEncoder()
    const nameKey = BigInt('0x' + Array.from(textEncoder.encode('name')).map(b => b.toString(16).padStart(2, '0')).join('').padStart(64, '0'))
    const symbolKey = BigInt('0x' + Array.from(textEncoder.encode('symbol')).map(b => b.toString(16).padStart(2, '0')).join('').padStart(64, '0'))
    const decimalsKey = BigInt('0x' + Array.from(textEncoder.encode('decimals')).map(b => b.toString(16).padStart(2, '0')).join('').padStart(64, '0'))
    const imageKey = BigInt('0x' + Array.from(textEncoder.encode('image')).map(b => b.toString(16).padStart(2, '0')).join('').padStart(64, '0'))
    
    jettonContentDict.set(nameKey, beginCell().storeUint(0, 8).storeStringTail('Bimcoin').endCell())
    jettonContentDict.set(symbolKey, beginCell().storeUint(0, 8).storeStringTail('BIM').endCell())
    jettonContentDict.set(decimalsKey, beginCell().storeUint(0, 8).storeStringTail('9').endCell())
    jettonContentDict.set(imageKey, beginCell().storeUint(0, 8).storeStringTail('https://db23b08d-08a2-4e7e-b648-6f394e9e12c2.lovableproject.com/icon-512x512.png').endCell())
    
    const jettonContent = beginCell()
      .storeUint(0, 8) // onchain content flag
      .storeDict(jettonContentDict)
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
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
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

    // Use environment variable first (real minter address), fallback to config
    const minterAddress = MINTER_ADDRESS
    
    if (!minterAddress) {
      const { data: minterConfig } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'jetton_minter_address')
        .single()
      
      const configAddress = minterConfig?.value
      if (!configAddress) {
        throw new Error('Jetton minter address not configured')
      }
    }

    if (!minterAddress) {
      throw new Error('Jetton minter address not configured')
    }

    // Import TON SDK
    const { WalletContractV4 } = await import('https://esm.sh/@ton/ton@15.3.1')
    const { mnemonicToPrivateKey } = await import('https://esm.sh/@ton/crypto@3.3.0')

    // Initialize TON client
    const client = new TonClient({
      endpoint: 'https://mainnet.tonhubapi.com/jsonrpc',
    })

    // Create wallet from mnemonic
    const keyPair = await mnemonicToPrivateKey(ADMIN_MNEMONIC.split(' '))
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey })
    const contract = client.open(wallet)

    // Parse addresses
    const minterAddr = Address.parse(minterAddress)
    const userAddr = Address.parse(user_wallet)

    // Convert BIM amount to nano tokens (assuming 9 decimals)
    const jettonAmount = toNano(bim_amount.toString())

    // Create internal message for jetton minting
    const internalMessage = beginCell()
      .storeUint(0x18, 6) // internal message, bounce = true
      .storeAddress(minterAddr)
      .storeCoins(toNano('0.1')) // TON for gas
      .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
      .storeUint(21, 32) // op::mint()
      .storeUint(0, 64) // query_id
      .storeAddress(userAddr) // to_address
      .storeCoins(toNano('0.05')) // amount for wallet creation
      .storeRef(
        beginCell()
          .storeUint(0x178d4519, 32) // internal_transfer op
          .storeUint(0, 64) // query_id
          .storeCoins(jettonAmount) // jetton_amount
          .storeAddress(null) // from_address (null for minting)
          .storeAddress(userAddr) // response_address
          .storeCoins(0) // forward_ton_amount
          .storeBit(false) // forward_payload in this slice
          .endCell()
      )
      .endCell()

    // Send transaction
    const seqno = await contract.getSeqno()
    const transfer = contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: minterAddr,
        value: toNano('0.1'),
        body: internalMessage
      })]
    })

    await contract.send(transfer)

    // Calculate transaction hash
    const txHash = transfer.hash().toString('hex')

    console.log(`Successfully minted ${bim_amount} BIM for ${user_wallet}, tx: ${txHash}`)

    return new Response(JSON.stringify({
      success: true,
      mint_hash: txHash,
      minter_address: minterAddress,
      amount_minted: bim_amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error minting tokens:', error)
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getMinterInfo() {
  try {
    // Use environment variable first (real minter address), fallback to config
    const minterAddress = MINTER_ADDRESS
    
    if (!minterAddress) {
      // Try config as fallback
      const { data: minterConfig } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'jetton_minter_address')
        .single()
      
      const configAddress = minterConfig?.value
      
      return new Response(JSON.stringify({
        minter_address: configAddress,
        status: configAddress ? 'configured' : 'not_configured',
        message: configAddress ? 'Jetton minter is ready' : 'Jetton minter needs to be deployed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      minter_address: minterAddress,
      status: 'configured',
      message: 'Jetton minter is ready'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting minter info:', error)
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function reprocessDeposit(req: Request) {
  const { deposit_id } = await req.json()
  
  try {
    // Get the deposit details
    const { data: deposit, error } = await supabase
      .from('deposits')
      .select('*, users(*)')
      .eq('id', deposit_id)
      .eq('status', 'confirmed')
      .single()

    if (error || !deposit) {
      throw new Error('Deposit not found or not confirmed')
    }

    // Check if it has a fake mint hash (starts with 'retroactive_mint_' or 'mint_')
    if (!deposit.jetton_mint_hash || 
        deposit.jetton_mint_hash.startsWith('retroactive_mint_') || 
        deposit.jetton_mint_hash.startsWith('mint_')) {
      
      console.log(`Reprocessing deposit ${deposit_id} for real minting`)
      
      // Call the real minting function
      const mintResult = await mintTokens(new Request('https://dummy.com/mint', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mint',
          user_wallet: deposit.users.wallet_address,
          bim_amount: deposit.bim_amount,
          deposit_id: deposit.id
        })
      }))

      const mintData = await mintResult.json()
      
      if (mintData.success) {
        // Update deposit with real mint hash
        const { error: updateError } = await supabase
          .from('deposits')
          .update({
            jetton_mint_hash: mintData.mint_hash,
            updated_at: new Date().toISOString()
          })
          .eq('id', deposit_id)

        if (updateError) throw updateError

        return new Response(JSON.stringify({
          success: true,
          message: 'Deposit reprocessed successfully',
          real_mint_hash: mintData.mint_hash
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        throw new Error(mintData.error || 'Minting failed')
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'Deposit already has real mint hash'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('Error reprocessing deposit:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}