-- Update the deposit_type check constraint to use 'Bimcoin' instead of 'BIMCoin'
ALTER TABLE public.deposits 
DROP CONSTRAINT IF EXISTS valid_deposit_type;

ALTER TABLE public.deposits 
ADD CONSTRAINT valid_deposit_type 
CHECK (deposit_type IN ('TON', 'Bimcoin'));