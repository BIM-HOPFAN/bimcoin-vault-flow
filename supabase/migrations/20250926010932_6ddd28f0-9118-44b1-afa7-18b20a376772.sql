-- Fix config table security - restrict modifications to admin users only
-- Create admin users table to manage admin access
CREATE TABLE public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid DEFAULT auth.uid()
);

-- Enable RLS on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only allow admins to manage other admins
CREATE POLICY "Admins can manage admin users" 
ON public.admin_users 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Create security definer function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE wallet_address = current_setting('app.current_wallet'::text, true)
  );
$$;

-- Drop existing config policies and create secure ones
DROP POLICY IF EXISTS "Allow config management for authenticated users" ON public.config;
DROP POLICY IF EXISTS "Anyone can view config" ON public.config;

-- Allow anyone to read config (needed for edge functions and app functionality)
CREATE POLICY "Anyone can view config" 
ON public.config 
FOR SELECT 
USING (true);

-- Only allow admin users to modify config
CREATE POLICY "Only admins can modify config" 
ON public.config 
FOR ALL 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Fix burns table - restrict access to user's own records only
DROP POLICY IF EXISTS "System can manage all burns" ON public.burns;

-- Allow users to view their own burn records
CREATE POLICY "Users can view own burns" 
ON public.burns 
FOR SELECT 
USING (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Allow service role to manage burns (for processing)
CREATE POLICY "Service role can manage burns" 
ON public.burns 
FOR ALL 
USING (auth.role() = 'service_role');

-- Allow users to create their own burn requests
CREATE POLICY "Users can create own burns" 
ON public.burns 
FOR INSERT 
WITH CHECK (user_id IN (
  SELECT id FROM public.users 
  WHERE wallet_address = current_setting('app.current_wallet'::text, true)
));

-- Insert initial admin user (replace with actual admin wallet address)
-- This should be updated with the actual admin wallet address
INSERT INTO public.admin_users (wallet_address) 
VALUES ('ADMIN_WALLET_ADDRESS_TO_BE_UPDATED')
ON CONFLICT (wallet_address) DO NOTHING;