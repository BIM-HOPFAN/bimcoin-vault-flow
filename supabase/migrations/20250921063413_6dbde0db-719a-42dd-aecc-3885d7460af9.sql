-- First, update existing records from 'BIMCoin' to 'Bimcoin'
UPDATE public.deposits 
SET deposit_type = 'Bimcoin' 
WHERE deposit_type = 'BIMCoin';

-- Drop the old constraint
ALTER TABLE public.deposits 
DROP CONSTRAINT IF EXISTS valid_deposit_type;

-- Add the new constraint with 'Bimcoin'
ALTER TABLE public.deposits 
ADD CONSTRAINT valid_deposit_type 
CHECK (deposit_type IN ('TON', 'Bimcoin'));