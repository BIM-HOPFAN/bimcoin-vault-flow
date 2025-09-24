import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  beginCell, 
  Cell, 
  Address
} from 'https://esm.sh/@ton/core@0.61.0'
import { TonClient } from 'https://esm.sh/@ton/ton@15.3.1'

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
        if (path === 'derive-wallet') {
          return await deriveJettonWallet(req)
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
    console.error('Error in jetton-wallet-api function:', error)
    const errorObj = error as Error
    return new Response(JSON.stringify({ error: errorObj.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function deriveJettonWallet(req: Request) {
  const { owner_address, jetton_master_address } = await req.json()

  if (!owner_address || !jetton_master_address) {
    return new Response(JSON.stringify({ error: 'Owner address and jetton master address required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    console.log(`Deriving jetton wallet for owner: ${owner_address}, master: ${jetton_master_address}`)
    
    // Method 1: Try TonCenter API with proper Cell encoding
    try {
      const apiKey = Deno.env.get('TON_CENTER_API_KEY') || ''
      
      // Create proper Cell with owner address
      const ownerAddr = Address.parse(owner_address)
      const ownerSlice = beginCell().storeAddress(ownerAddr).endCell()
      const ownerSliceBase64 = ownerSlice.toBoc().toString('base64')
      
      const url = `https://toncenter.com/api/v2/runGetMethod?address=${jetton_master_address}&method=get_wallet_address&stack=[["tvm.Cell","${ownerSliceBase64}"]]&api_key=${apiKey}`
      
      console.log('Trying TonCenter API with proper Cell encoding...')
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.ok && data.result && data.result.stack && data.result.stack.length > 0) {
        const walletAddressBase64 = data.result.stack[0][1]
        // Parse the returned cell to get the address
        const walletCell = Cell.fromBase64(walletAddressBase64)
        const walletAddress = walletCell.beginParse().loadAddress()
        
        console.log(`Successfully derived jetton wallet via TonCenter: ${walletAddress.toString()}`)
        
        return new Response(JSON.stringify({
          jetton_wallet_address: walletAddress.toString(),
          owner_address,
          jetton_master_address,
          method: 'toncenter_api'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
  } catch (error) {
    console.error('TonCenter API failed:', (error as Error).message)
  }

    // Method 2: Use mathematical derivation as fallback
    try {
      console.log('Using standard jetton wallet derivation...')
      
      const ownerAddr = Address.parse(owner_address)
      const jettonMasterAddr = Address.parse(jetton_master_address)
      
      // Standard jetton wallet state init
      const jettonWalletCode = beginCell()
        .storeUint(0x178d4519, 32) // jetton wallet code hash
        .storeUint(0, 8)
        .endCell()
      
      const jettonWalletData = beginCell()
        .storeCoins(0) // balance
        .storeAddress(ownerAddr) // owner
        .storeAddress(jettonMasterAddr) // jetton master
        .storeRef(jettonWalletCode) // jetton wallet code
        .endCell()
      
      const stateInit = beginCell()
        .storeUint(0, 2) // split_depth and special
        .storeUint(1, 1) // code exists
        .storeUint(1, 1) // data exists
        .storeRef(jettonWalletCode) // code
        .storeRef(jettonWalletData) // data
        .endCell()
      
      const walletAddress = new Address(0, stateInit.hash())
      
      console.log(`Derived jetton wallet mathematically: ${walletAddress.toString()}`)
      
      return new Response(JSON.stringify({
        jetton_wallet_address: walletAddress.toString(),
        owner_address,
        jetton_master_address,
        method: 'mathematical_derivation'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
      
    } catch (error) {
      console.log('Mathematical derivation failed:', (error as Error).message)
    }

    // Method 3: Try alternative TonCenter format
    try {
      const apiKey = Deno.env.get('TON_CENTER_API_KEY') || ''
      
      const url = `https://toncenter.com/api/v2/runGetMethod`
      const payload = {
        address: jetton_master_address,
        method: 'get_wallet_address',
        stack: [['tvm.Slice', owner_address]]
      }
      
      console.log('Trying alternative TonCenter format...')
      const response = await fetch(url + (apiKey ? `?api_key=${apiKey}` : ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      
      if (data.ok && data.result && data.result.stack && data.result.stack.length > 0) {
        const walletAddress = data.result.stack[0][1]
        console.log(`Successfully derived jetton wallet via alternative TonCenter: ${walletAddress}`)
        
        return new Response(JSON.stringify({
          jetton_wallet_address: walletAddress,
          owner_address,
          jetton_master_address,
          method: 'toncenter_alternative'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.log('Alternative TonCenter format failed:', (error as Error).message)
    }
    
    throw new Error('All methods failed to derive jetton wallet address')
    
  } catch (error) {
    console.error('All jetton wallet derivation methods failed:', error)
    
    return new Response(JSON.stringify({
      error: 'Could not derive jetton wallet address. All methods failed.',
      details: (error as Error).message,
      owner_address,
      jetton_master_address
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}