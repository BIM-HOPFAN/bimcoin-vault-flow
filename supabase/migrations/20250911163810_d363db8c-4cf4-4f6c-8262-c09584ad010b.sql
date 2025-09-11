-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create RLS policies for users table
CREATE POLICY "Public access for user registration" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read access for users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (wallet_address = current_setting('app.current_wallet', true));

-- Create RLS policies for deposits table
CREATE POLICY "System can manage all deposits" ON public.deposits FOR ALL USING (true);

-- Create RLS policies for mining sessions table  
CREATE POLICY "System can manage all mining sessions" ON public.mining_sessions FOR ALL USING (true);

-- Create RLS policies for user tasks table
CREATE POLICY "System can manage all user tasks" ON public.user_tasks FOR ALL USING (true);

-- Create RLS policies for referrals table
CREATE POLICY "System can manage all referrals" ON public.referrals FOR ALL USING (true);

-- Create RLS policies for burns table
CREATE POLICY "System can manage all burns" ON public.burns FOR ALL USING (true);