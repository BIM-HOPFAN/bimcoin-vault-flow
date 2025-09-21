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
    return new Response(JSON.stringify({ error: error.message }), {
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
    
    // Method 1: Try TonCenter API with API key
    try {
      const apiKey = Deno.env.get('TON_CENTER_API_KEY') || ''
      const url = `https://toncenter.com/api/v2/runGetMethod?address=${jetton_master_address}&method=get_wallet_address&stack=[["tvm.Slice","${owner_address}"]]&api_key=${apiKey}`
      
      console.log('Trying TonCenter API with key...')
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.ok && data.result && data.result.stack && data.result.stack.length > 0) {
        const walletAddress = data.result.stack[0][1]
        console.log(`Successfully derived jetton wallet via TonCenter: ${walletAddress}`)
        
        return new Response(JSON.stringify({
          jetton_wallet_address: walletAddress,
          owner_address,
          jetton_master_address,
          method: 'toncenter_api'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      console.log('TonCenter API failed:', error.message)
    }

    // Method 2: Use TON client to query the jetton master contract directly
    const endpoints = [
      'https://mainnet-v4.tonhubapi.com',
      'https://toncenter.com/api/v2/jsonRPC'
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying TON client with endpoint: ${endpoint}`)
        
        const client = new TonClient({ endpoint })
        const ownerAddr = Address.parse(owner_address)
        const jettonMasterAddr = Address.parse(jetton_master_address)
        
        const result = await client.runMethod(jettonMasterAddr, 'get_wallet_address', [
          {
            type: 'slice',
            cell: beginCell().storeAddress(ownerAddr).endCell()
          }
        ])
        
        if (result.stack.length > 0 && result.stack[0].type === 'slice') {
          const walletAddress = result.stack[0].cell.beginParse().loadAddress()
          
          console.log(`Successfully derived jetton wallet via TON client: ${walletAddress.toString()}`)
          
          return new Response(JSON.stringify({
            jetton_wallet_address: walletAddress.toString(),
            owner_address,
            jetton_master_address,
            method: 'ton_client',
            api_endpoint: endpoint
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
      } catch (error) {
        console.log(`TON client endpoint ${endpoint} failed:`, error.message)
        continue
      }
    }
    
    throw new Error('All methods failed to derive jetton wallet address')
    
  } catch (error) {
    console.error('All jetton wallet derivation methods failed:', error)
    
    return new Response(JSON.stringify({
      error: 'Could not derive jetton wallet address. All methods failed.',
      details: error.message,
      owner_address,
      jetton_master_address
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}