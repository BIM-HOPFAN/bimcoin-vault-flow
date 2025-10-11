/**
 * Simple wallet authentication for development
 * Uses basic base64 encoding for wallet verification
 */

// TON wallet address validation
export function validateWalletAddress(address: string): boolean {
  const rawFormat = /^[0-9A-Za-z_-]{48}$/
  const userFriendlyFormat = /^[EU]Q[0-9A-Za-z_-]{46}$/
  return rawFormat.test(address) || userFriendlyFormat.test(address)
}

export interface AuthHeaders {
  walletAddress: string
  timestamp: number
  signature: string
}

/**
 * Extracts and validates authentication headers from the request
 */
export function extractAuthHeaders(req: Request): AuthHeaders | null {
  const walletAddress = req.headers.get('X-Wallet-Address')
  const timestampStr = req.headers.get('X-Timestamp')
  const signature = req.headers.get('X-Signature')

  if (!walletAddress || !timestampStr || !signature) {
    return null
  }

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return null
  }

  return { walletAddress, timestamp, signature }
}

/**
 * Simple verification - checks that signature matches expected format
 */
export function verifyAuth(auth: AuthHeaders): { valid: boolean; error?: string } {
  // Validate wallet address format
  if (!validateWalletAddress(auth.walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format' }
  }

  // Simple signature verification
  try {
    const decoded = atob(auth.signature)
    const expectedMessage = `${auth.walletAddress}-${auth.timestamp}`
    
    if (decoded !== expectedMessage) {
      return { valid: false, error: 'Invalid signature' }
    }
  } catch (e) {
    return { valid: false, error: 'Invalid signature format' }
  }

  return { valid: true }
}

/**
 * Middleware function to verify wallet authentication
 * Returns the wallet address if valid, or null with error response
 */
export function verifyWalletAuth(req: Request): { 
  walletAddress: string | null; 
  errorResponse: Response | null 
} {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-timestamp, x-signature',
  }

  const auth = extractAuthHeaders(req)
  
  if (!auth) {
    return {
      walletAddress: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Missing authentication headers' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  const verification = verifyAuth(auth)
  
  if (!verification.valid) {
    return {
      walletAddress: null,
      errorResponse: new Response(
        JSON.stringify({ error: verification.error }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  return {
    walletAddress: auth.walletAddress,
    errorResponse: null
  }
}
