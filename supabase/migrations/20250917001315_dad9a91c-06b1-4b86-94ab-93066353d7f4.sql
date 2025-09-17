-- Add deposit_type column to deposits table to support both TON and BIMCoin deposits
ALTER TABLE public.deposits 
ADD COLUMN deposit_type text NOT NULL DEFAULT 'TON';

-- Add check constraint to ensure only valid deposit types
ALTER TABLE public.deposits 
ADD CONSTRAINT valid_deposit_type CHECK (deposit_type IN ('TON', 'BIMCoin'));

-- Update config to add BIMCoin exchange rate (1 BIMCoin = 1 internal BIM)
INSERT INTO public.config (key, value, description) 
VALUES ('bim_per_bimcoin', '1', 'How many internal BIM tokens are minted per BIMCoin deposited')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;