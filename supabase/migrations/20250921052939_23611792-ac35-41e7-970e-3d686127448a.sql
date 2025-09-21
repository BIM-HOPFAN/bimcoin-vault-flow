-- Fix RLS policies for config table to allow admin operations
-- Drop existing restrictive policy if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'config' AND policyname = 'Admin only can manage config') THEN
        DROP POLICY "Admin only can manage config" ON public.config;
    END IF;
END $$;

-- Allow authenticated users to insert/update config (needed for admin operations)
CREATE POLICY "Allow config management for authenticated users" 
ON public.config 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');