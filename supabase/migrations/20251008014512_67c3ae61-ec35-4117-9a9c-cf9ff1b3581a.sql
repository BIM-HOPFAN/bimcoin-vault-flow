-- Fix RLS policies to properly allow service role access
-- The previous migration had incorrect service role check

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Service role maintains full access" ON public.users;
DROP POLICY IF EXISTS "Users can register themselves" ON public.users;

-- Create a simple policy that allows service role full access
-- Service role is used by edge functions to access data on behalf of users
CREATE POLICY "Service role has full access to users"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- For now, authenticated users get no direct access since all operations
-- go through edge functions that verify wallet ownership
-- Future: Add policies if we implement Supabase Auth alongside TON Connect