-- Add new columns to tasks table for enhanced verification
ALTER TABLE public.tasks 
ADD COLUMN verification_type TEXT DEFAULT 'manual',
ADD COLUMN verification_data JSONB DEFAULT '{}',
ADD COLUMN completion_timeout INTEGER DEFAULT 300; -- 5 minutes default

-- Add verification status to user_tasks
ALTER TABLE public.user_tasks
ADD COLUMN verification_status TEXT DEFAULT 'pending',
ADD COLUMN verification_data JSONB DEFAULT '{}',
ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;

-- Create task verification logs table
CREATE TABLE public.task_verification_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    task_id UUID NOT NULL,
    verification_type TEXT NOT NULL,
    verification_attempt JSONB NOT NULL DEFAULT '{}',
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on verification logs
ALTER TABLE public.task_verification_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for system access to verification logs
CREATE POLICY "System can manage all verification logs" 
ON public.task_verification_logs 
FOR ALL 
USING (true);

-- Create admin tasks management policies
CREATE POLICY "Admins can manage tasks" 
ON public.tasks 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Add comments for documentation
COMMENT ON COLUMN public.tasks.verification_type IS 'Type of verification: manual, url_visit, social_follow, deposit_check, time_based';
COMMENT ON COLUMN public.tasks.verification_data IS 'JSON configuration for verification (URLs, social handles, etc.)';
COMMENT ON COLUMN public.tasks.completion_timeout IS 'Timeout in seconds for completion verification';

COMMENT ON TABLE public.task_verification_logs IS 'Logs all task verification attempts for audit and debugging';