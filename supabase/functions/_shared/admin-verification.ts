/**
 * Admin authorization verification
 * Ensures only authorized admin wallets can perform admin operations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-timestamp, x-signature',
}

/**
 * Verifies if a wallet address is an admin
 * Returns admin status and error response if unauthorized
 */
export async function verifyAdminAuth(
  walletAddress: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ isAdmin: boolean; errorResponse: Response | null }> {
  try {
    // Set the current wallet in the session for RLS policies
    await supabase.rpc('set', { 
      key: 'app.current_wallet', 
      value: walletAddress 
    }).catch(() => {
      // Fallback if set function doesn't exist
      console.log('Setting app.current_wallet via session')
    })

    // Check if wallet is in admin_users table
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('wallet_address')
      .eq('wallet_address', walletAddress)
      .maybeSingle()

    if (error) {
      console.error('Admin verification error:', error)
      return {
        isAdmin: false,
        errorResponse: new Response(
          JSON.stringify({ error: 'Admin verification failed' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    if (!adminUser) {
      return {
        isAdmin: false,
        errorResponse: new Response(
          JSON.stringify({ error: 'Unauthorized: Admin access required' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    return {
      isAdmin: true,
      errorResponse: null
    }
  } catch (error) {
    console.error('Admin verification exception:', error)
    return {
      isAdmin: false,
      errorResponse: new Response(
        JSON.stringify({ error: 'Admin verification failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }
}
