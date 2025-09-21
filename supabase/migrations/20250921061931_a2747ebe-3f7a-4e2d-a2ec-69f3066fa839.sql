-- Fix RLS policy for config table to allow authenticated users to manage config
DROP POLICY IF EXISTS "Allow config management for authenticated users" ON public.config;

-- Create proper RLS policy for authenticated users
CREATE POLICY "Allow config management for authenticated users" 
ON public.config 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);