-- Drop the overly permissive service role policy and replace with more restrictive policies
DROP POLICY IF EXISTS "Service role full access to users" ON public.users;

-- Allow users to view only their own data based on wallet address
CREATE POLICY "Users can view own data"
ON public.users
FOR SELECT
USING (wallet_address = current_setting('app.current_wallet', true));

-- Allow users to update only their own data (for activity tracking, etc.)
CREATE POLICY "Users can update own data"
ON public.users
FOR UPDATE
USING (wallet_address = current_setting('app.current_wallet', true))
WITH CHECK (wallet_address = current_setting('app.current_wallet', true));

-- Service role retains full access for backend operations
CREATE POLICY "Service role maintains full access"
ON public.users
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Allow new user registration (INSERT) - users can only insert their own wallet
CREATE POLICY "Users can register themselves"
ON public.users
FOR INSERT
WITH CHECK (wallet_address = current_setting('app.current_wallet', true));