-- Create enum types for better type safety
CREATE TYPE public.deposit_status AS ENUM ('pending', 'confirmed', 'failed');
CREATE TYPE public.mining_status AS ENUM ('active', 'completed', 'claimed');
CREATE TYPE public.task_status AS ENUM ('available', 'completed', 'claimed');
CREATE TYPE public.referral_status AS ENUM ('pending', 'completed');

-- Create users table for user profiles and balances
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    bim_balance DECIMAL(28,9) DEFAULT 0 NOT NULL,
    oba_balance DECIMAL(28,9) DEFAULT 0 NOT NULL,
    total_deposited DECIMAL(28,9) DEFAULT 0 NOT NULL,
    total_mined DECIMAL(28,9) DEFAULT 0 NOT NULL,
    total_earned_from_tasks DECIMAL(28,9) DEFAULT 0 NOT NULL,
    total_earned_from_referrals DECIMAL(28,9) DEFAULT 0 NOT NULL,
    referral_code TEXT UNIQUE DEFAULT SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8),
    referred_by UUID REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create deposits table to track TON deposits and BIM minting
CREATE TABLE public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ton_amount DECIMAL(18,9) NOT NULL,
    bim_amount DECIMAL(28,9) NOT NULL,
    deposit_hash TEXT,
    deposit_comment TEXT NOT NULL,
    jetton_mint_hash TEXT,
    status public.deposit_status DEFAULT 'pending',
    oba_reward DECIMAL(28,9) DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create mining sessions table for OBA mining tracking
CREATE TABLE public.mining_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    oba_earned DECIMAL(28,9) DEFAULT 0,
    status public.mining_status DEFAULT 'active',
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tasks table for daily tasks
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_amount DECIMAL(28,9) NOT NULL,
    task_type TEXT NOT NULL,
    external_url TEXT,
    is_active BOOLEAN DEFAULT true,
    daily_limit INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user tasks table to track task completions
CREATE TABLE public.user_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    status public.task_status DEFAULT 'available',
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    reward_earned DECIMAL(28,9) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, task_id, DATE(created_at))
);

-- Create referrals table to track referral rewards
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    first_deposit_id UUID REFERENCES public.deposits(id),
    reward_amount DECIMAL(28,9) DEFAULT 0,
    status public.referral_status DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(referrer_id, referee_id)
);

-- Create burns table to track jetton burns and TON payouts
CREATE TABLE public.burns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bim_amount DECIMAL(28,9) NOT NULL,
    ton_amount DECIMAL(18,9) NOT NULL,
    jetton_burn_hash TEXT NOT NULL,
    ton_payout_hash TEXT,
    payout_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create configuration table for dynamic settings
CREATE TABLE public.config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default configuration values
INSERT INTO public.config (key, value, description) VALUES
('bim_per_ton', '1000', 'BIM tokens minted per TON deposited'),
('burn_rate_bim_per_ton', '1000', 'BIM tokens required to burn for 1 TON'),
('mining_rate_per_second', '0.000578704', 'OBA tokens earned per second (50% per day)'),
('task_rate_per_day', '0.03', 'Task reward rate (3% OBA per day)'),
('referral_rate', '0.02', 'Referral reward rate (2% OBA on first deposit)'),
('activity_window_days', '365', 'Days for activity window'),
('system_paused', 'false', 'Global system pause switch');

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.burns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users (users can only see/modify their own data)
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Create RLS policies for deposits 
CREATE POLICY "Users can view own deposits" ON public.deposits FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'));
CREATE POLICY "System can manage deposits" ON public.deposits FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create RLS policies for mining sessions
CREATE POLICY "Users can view own mining sessions" ON public.mining_sessions FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'));
CREATE POLICY "System can manage mining sessions" ON public.mining_sessions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create RLS policies for tasks (public read, system write)
CREATE POLICY "Anyone can view active tasks" ON public.tasks FOR SELECT USING (is_active = true);
CREATE POLICY "System can manage tasks" ON public.tasks FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create RLS policies for user tasks
CREATE POLICY "Users can view own task completions" ON public.user_tasks FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'));
CREATE POLICY "System can manage user tasks" ON public.user_tasks FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create RLS policies for referrals
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (referrer_id IN (SELECT id FROM public.users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address') OR referee_id IN (SELECT id FROM public.users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'));
CREATE POLICY "System can manage referrals" ON public.referrals FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create RLS policies for burns
CREATE POLICY "Users can view own burns" ON public.burns FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'));
CREATE POLICY "System can manage burns" ON public.burns FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create RLS policies for config (public read, system write)
CREATE POLICY "Anyone can view config" ON public.config FOR SELECT USING (true);
CREATE POLICY "System can manage config" ON public.config FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_users_wallet_address ON public.users(wallet_address);
CREATE INDEX idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX idx_deposits_status ON public.deposits(status);
CREATE INDEX idx_deposits_comment ON public.deposits(deposit_comment);
CREATE INDEX idx_mining_sessions_user_id ON public.mining_sessions(user_id);
CREATE INDEX idx_mining_sessions_status ON public.mining_sessions(status);
CREATE INDEX idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_burns_user_id ON public.burns(user_id);
CREATE INDEX idx_burns_payout_processed ON public.burns(payout_processed);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON public.config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default tasks
INSERT INTO public.tasks (title, description, reward_amount, task_type, external_url) VALUES
('Join Telegram', 'Join our official Telegram channel', 10, 'social', 'https://t.me/bimcoin'),
('Follow Twitter', 'Follow us on Twitter for updates', 10, 'social', 'https://twitter.com/bimcoin'),
('Share on Social', 'Share BIMCoin on your social media', 5, 'social', NULL),
('Daily Check-in', 'Check in daily to earn OBA', 2, 'daily', NULL);