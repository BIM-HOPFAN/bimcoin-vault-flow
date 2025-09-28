-- TON Blockchain Service Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(48) UNIQUE NOT NULL,
  bim_balance DECIMAL(20, 8) DEFAULT 0 NOT NULL,
  daily_ton_withdrawn DECIMAL(20, 8) DEFAULT 0 NOT NULL,
  daily_jetton_withdrawn DECIMAL(20, 8) DEFAULT 0 NOT NULL,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT positive_bim_balance CHECK (bim_balance >= 0),
  CONSTRAINT valid_wallet_address CHECK (length(wallet_address) > 0)
);

-- Onchain events table (for tracking all blockchain events)
CREATE TABLE IF NOT EXISTS onchain_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash VARCHAR(64) UNIQUE NOT NULL,
  event_type VARCHAR(20) NOT NULL, -- 'ton_deposit', 'jetton_deposit', 'ton_payout', 'jetton_payout'
  from_address VARCHAR(48),
  to_address VARCHAR(48) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  jetton_master VARCHAR(48), -- NULL for TON transactions
  processed BOOLEAN DEFAULT false,
  block_number BIGINT,
  timestamp TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('ton_deposit', 'jetton_deposit', 'ton_payout', 'jetton_payout')),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Payouts table (for tracking outgoing payments)
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  payout_type VARCHAR(10) NOT NULL, -- 'ton' or 'jetton'
  amount DECIMAL(20, 8) NOT NULL,
  bim_deducted DECIMAL(20, 8) NOT NULL,
  to_address VARCHAR(48) NOT NULL,
  jetton_master VARCHAR(48), -- NULL for TON payouts
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  tx_hash VARCHAR(64) UNIQUE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_payout_type CHECK (payout_type IN ('ton', 'jetton')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT positive_amounts CHECK (amount > 0 AND bim_deducted > 0)
);

-- Withdrawals table (for user withdrawal requests)
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  withdrawal_type VARCHAR(10) NOT NULL, -- 'ton' or 'jetton'
  amount DECIMAL(20, 8) NOT NULL,
  bim_amount DECIMAL(20, 8) NOT NULL, -- BIM to deduct
  to_address VARCHAR(48) NOT NULL,
  jetton_master VARCHAR(48), -- NULL for TON withdrawals
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'processing', 'completed', 'rejected'
  payout_id UUID REFERENCES payouts(id),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_withdrawal_type CHECK (withdrawal_type IN ('ton', 'jetton')),
  CONSTRAINT valid_withdrawal_status CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  CONSTRAINT positive_withdrawal_amounts CHECK (amount > 0 AND bim_amount > 0)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(30) NOT NULL, -- 'user', 'payout', 'withdrawal', 'balance'
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offchain balances history (for tracking balance changes)
CREATE TABLE IF NOT EXISTS offchain_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  balance_type VARCHAR(20) NOT NULL, -- 'bim'
  previous_balance DECIMAL(20, 8) NOT NULL,
  new_balance DECIMAL(20, 8) NOT NULL,
  change_amount DECIMAL(20, 8) NOT NULL,
  reason VARCHAR(50) NOT NULL, -- 'jetton_deposit', 'ton_payout', 'jetton_payout', 'admin_adjustment'
  reference_id UUID, -- Reference to payout/withdrawal/deposit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_balance_type CHECK (balance_type IN ('bim')),
  CONSTRAINT valid_change_reason CHECK (reason IN ('jetton_deposit', 'ton_payout', 'jetton_payout', 'admin_adjustment', 'manual_credit'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_onchain_events_tx_hash ON onchain_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_onchain_events_to_address ON onchain_events(to_address);
CREATE INDEX IF NOT EXISTS idx_onchain_events_processed ON onchain_events(processed);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_tx_hash ON payouts(tx_hash);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_offchain_balances_user_id ON offchain_balances(user_id);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to reset daily limits
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset daily limits if date has changed
    IF NEW.last_reset_date < CURRENT_DATE THEN
        NEW.daily_ton_withdrawn = 0;
        NEW.daily_jetton_withdrawn = 0;
        NEW.last_reset_date = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER reset_daily_limits_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION reset_daily_limits();

-- Insert default config values
INSERT INTO users (wallet_address, bim_balance) VALUES 
('TREASURY_WALLET_PLACEHOLDER', 0)
ON CONFLICT (wallet_address) DO NOTHING;