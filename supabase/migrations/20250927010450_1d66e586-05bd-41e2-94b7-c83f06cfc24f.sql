-- Fix referral system RLS policies to prevent data manipulation
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "System can manage all referrals" ON public.referrals;

-- Create secure RLS policies for referrals table
-- Users can only view referrals where they are involved (either referrer or referee)
CREATE POLICY "Users can view their own referrals" 
ON public.referrals 
FOR SELECT 
USING (
  referrer_id IN (
    SELECT id FROM users 
    WHERE wallet_address = current_setting('app.current_wallet', true)
  ) 
  OR 
  referee_id IN (
    SELECT id FROM users 
    WHERE wallet_address = current_setting('app.current_wallet', true)
  )
);

-- Only service role can create referrals (backend functions only)
CREATE POLICY "Service role can create referrals" 
ON public.referrals 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Only service role can update referrals (backend functions only)
CREATE POLICY "Service role can update referrals" 
ON public.referrals 
FOR UPDATE 
TO service_role
USING (true)
WITH CHECK (true);

-- Only service role can delete referrals (backend functions only)
CREATE POLICY "Service role can delete referrals" 
ON public.referrals 
FOR DELETE 
TO service_role
USING (true);