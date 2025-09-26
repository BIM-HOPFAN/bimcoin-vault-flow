-- Fix mining_sessions table security - restrict access to user's own mining data
-- Drop the overly permissive policy that allows anyone to read all mining sessions
DROP POLICY IF EXISTS "System can manage all mining sessions" ON public.mining_sessions;

-- Allow users to view only their own mining sessions
CREATE POLICY "Users can view own mining sessions" 
ON public.mining_sessions 
FOR SELECT 
USING (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Allow service role to manage all mining sessions (for backend processing)
CREATE POLICY "Service role can manage mining sessions" 
ON public.mining_sessions 
FOR ALL 
USING (auth.role() = 'service_role');

-- Allow users to create their own mining sessions (though this is typically done by backend)
CREATE POLICY "Users can create own mining sessions" 
ON public.mining_sessions 
FOR INSERT 
WITH CHECK (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Allow users to update their own mining sessions (for claiming, etc.)
CREATE POLICY "Users can update own mining sessions" 
ON public.mining_sessions 
FOR UPDATE 
USING (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));