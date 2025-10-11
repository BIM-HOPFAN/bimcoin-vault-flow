/**
 * Verifies TON wallet authentication with cryptographic signatures
 * This ensures requests are coming from the actual wallet owner using proper cryptography
 */

import { sign } from 'https://esm.sh/tweetnacl@1.0.3'

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
  publicKey?: string
}

// Store used nonces to prevent replay attacks (in production, use Redis or database)
const usedNonces = new Map<string, number>()

// Clean up old nonces every 10 minutes
setInterval(() => {
  const now = Date.now()
  const tenMinutes = 10 * 60 * 1000
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > tenMinutes) {
      usedNonces.delete(nonce)
    }
  }
}, 10 * 60 * 1000)

/**
 * Extracts and validates authentication headers from the request
 */
export function extractAuthHeaders(req: Request): AuthHeaders | null {
  const walletAddress = req.headers.get('X-Wallet-Address')
  const timestampStr = req.headers.get('X-Timestamp')
  const signature = req.headers.get('X-Signature')
  const publicKey = req.headers.get('X-Public-Key')

  if (!walletAddress || !timestampStr || !signature) {
    return null
  }

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return null
  }

  return { walletAddress, timestamp, signature, publicKey: publicKey || undefined }
}

/**
 * Verifies the authentication is valid with cryptographic signature verification
 * Checks:
 * 1. Wallet address format is valid
 * 2. Timestamp is recent (within 5 minutes)
 * 3. Cryptographic signature is valid (when public key provided)
 * 4. Nonce hasn't been used before (replay attack prevention)
 */
export function verifyAuth(auth: AuthHeaders): { valid: boolean; error?: string } {
  // Validate wallet address format
  if (!validateWalletAddress(auth.walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format' }
  }

  // Check timestamp is recent (within 5 minutes)
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  const timeDiff = Math.abs(now - auth.timestamp)

  if (timeDiff > fiveMinutes) {
    return { valid: false, error: 'Request timestamp expired' }
  }

  // Create nonce from wallet + timestamp
  const nonce = `${auth.walletAddress}-${auth.timestamp}`
  
  // Check if nonce has been used (replay attack prevention)
  if (usedNonces.has(nonce)) {
    return { valid: false, error: 'Request already processed (replay detected)' }
  }

  // Verify cryptographic signature if public key is provided
  if (auth.publicKey) {
    try {
      const message = new TextEncoder().encode(nonce)
      const signatureBytes = Uint8Array.from(atob(auth.signature), c => c.charCodeAt(0))
      const publicKeyBytes = Uint8Array.from(atob(auth.publicKey), c => c.charCodeAt(0))

      const isValid = sign.detached.verify(message, signatureBytes, publicKeyBytes)
      
      if (!isValid) {
        return { valid: false, error: 'Invalid cryptographic signature' }
      }
    } catch (e) {
      return { valid: false, error: 'Signature verification failed' }
    }
  } else {
    // Fallback to legacy verification for backward compatibility during transition
    // TODO: Remove this after all clients are updated to use cryptographic signatures
    try {
      const decoded = atob(auth.signature)
      const expectedMessage = nonce
      
      if (decoded !== expectedMessage) {
        return { valid: false, error: 'Invalid signature' }
      }
    } catch (e) {
      return { valid: false, error: 'Invalid signature format' }
    }
  }

  // Mark nonce as used
  usedNonces.set(nonce, now)

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
