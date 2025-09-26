-- Fix critical security vulnerability: Restrict task management to admin users only
-- Drop the existing overprivileged policy
DROP POLICY IF EXISTS "Admins can manage tasks" ON public.tasks;

-- Create a new policy that properly restricts task management to admin users only
CREATE POLICY "Only admins can manage tasks" 
ON public.tasks 
FOR ALL 
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());