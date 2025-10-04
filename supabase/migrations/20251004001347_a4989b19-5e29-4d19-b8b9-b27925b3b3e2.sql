-- Security Fix: Restrict Direct Client Access to Sensitive Data
-- Simplified approach to avoid deadlocks

-- =====================================================
-- 1. USERS TABLE: Restrict to service_role only
-- =====================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Public access for user registration" ON public.users;

CREATE POLICY "Service role full access to users"
ON public.users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 2. DEPOSITS TABLE: Restrict to service_role only
-- =====================================================
DROP POLICY IF EXISTS "Users can view own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users can create own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Service role can manage deposits" ON public.deposits;

CREATE POLICY "Service role full access to deposits"
ON public.deposits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 3. MINING_SESSIONS TABLE: Restrict to service_role only
-- =====================================================
DROP POLICY IF EXISTS "Users can view own mining sessions" ON public.mining_sessions;
DROP POLICY IF EXISTS "Users can create own mining sessions" ON public.mining_sessions;
DROP POLICY IF EXISTS "Users can update own mining sessions" ON public.mining_sessions;
DROP POLICY IF EXISTS "Service role can manage mining sessions" ON public.mining_sessions;

CREATE POLICY "Service role full access to mining sessions"
ON public.mining_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 4. BURNS TABLE: Restrict to service_role only
-- =====================================================
DROP POLICY IF EXISTS "Users can view own burns" ON public.burns;
DROP POLICY IF EXISTS "Users can create own burns" ON public.burns;
DROP POLICY IF EXISTS "Service role can manage burns" ON public.burns;

CREATE POLICY "Service role full access to burns"
ON public.burns FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 5. REFERRALS TABLE: Keep only service role access
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;