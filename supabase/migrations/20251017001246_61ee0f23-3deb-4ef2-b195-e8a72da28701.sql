-- Create withdrawal status enum
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'completed', 'rejected');

-- Create withdrawals table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  bim_amount NUMERIC NOT NULL,
  withdrawal_type TEXT NOT NULL CHECK (withdrawal_type IN ('ton', 'jetton')),
  status withdrawal_status NOT NULL DEFAULT 'pending',
  
  -- Calculated amounts
  ton_amount NUMERIC,
  jetton_amount NUMERIC,
  penalty_amount NUMERIC DEFAULT 0,
  total_bim_deducted NUMERIC NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  
  -- Admin tracking
  approved_by UUID REFERENCES public.users(id),
  
  -- Transaction details
  tx_hash TEXT,
  rejection_reason TEXT
);

-- Enable RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can view their own withdrawal requests
CREATE POLICY "Users can view own withdrawals"
ON public.withdrawals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = withdrawals.user_id 
    AND users.wallet_address = current_setting('app.current_wallet', true)
  )
);

-- Service role can manage all withdrawals
CREATE POLICY "Service role full access to withdrawals"
ON public.withdrawals
FOR ALL
USING (true)
WITH CHECK (true);

-- Admins can view and manage all withdrawals
CREATE POLICY "Admins can manage all withdrawals"
ON public.withdrawals
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Create index for faster queries
CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- Update timestamp trigger
CREATE TRIGGER update_withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();