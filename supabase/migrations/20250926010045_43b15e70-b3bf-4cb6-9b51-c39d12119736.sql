-- Fix RLS policies for users table to protect sensitive financial data
-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public read access for users" ON public.users;
DROP POLICY IF EXISTS "Public leaderboard access" ON public.users;

-- Create restricted policies for users table
-- Allow users to view their own complete profile when wallet is set in session
CREATE POLICY "Users can view own profile" 
ON public.users 
FOR SELECT 
USING (wallet_address = current_setting('app.current_wallet'::text, true));

-- Fix RLS policies for deposits table to protect transaction history
-- Drop the overly permissive system policy and replace with restricted ones
DROP POLICY IF EXISTS "System can manage all deposits" ON public.deposits;

-- Allow users to view their own deposits only
CREATE POLICY "Users can view own deposits" 
ON public.deposits 
FOR SELECT 
USING (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Allow system/edge functions to manage deposits (for processing)
-- This uses service role key authentication
CREATE POLICY "Service role can manage deposits" 
ON public.deposits 
FOR ALL 
USING (auth.role() = 'service_role');

-- Allow authenticated users to insert their own deposits
CREATE POLICY "Users can create own deposits" 
ON public.deposits 
FOR INSERT 
WITH CHECK (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Create a security definer function for leaderboard access
-- This allows controlled public access to limited user data for leaderboard
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(limit_count integer DEFAULT 10)
RETURNS TABLE (
  wallet_address text,
  bim_balance numeric,
  total_deposited numeric
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT u.wallet_address, u.bim_balance, u.total_deposited
  FROM public.users u
  WHERE u.is_active = true
  ORDER BY u.bim_balance DESC
  LIMIT limit_count;
$$;

-- Create a security definer function for user profile access by wallet
-- This allows edge functions to access user data safely
CREATE OR REPLACE FUNCTION public.get_user_by_wallet(wallet_addr text)
RETURNS TABLE (
  id uuid,
  wallet_address text,
  bim_balance numeric,
  oba_balance numeric,
  deposit_bim_balance numeric,
  earned_bim_balance numeric,
  total_deposited numeric,
  total_mined numeric,
  total_earned_from_tasks numeric,
  total_earned_from_referrals numeric,
  referral_code text,
  referred_by uuid,
  is_active boolean,
  last_activity_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT 
    u.id, u.wallet_address, u.bim_balance, u.oba_balance,
    u.deposit_bim_balance, u.earned_bim_balance,
    u.total_deposited, u.total_mined, u.total_earned_from_tasks,
    u.total_earned_from_referrals, u.referral_code, u.referred_by,
    u.is_active, u.last_activity_at, u.created_at, u.updated_at
  FROM public.users u
  WHERE u.wallet_address = wallet_addr;
$$;