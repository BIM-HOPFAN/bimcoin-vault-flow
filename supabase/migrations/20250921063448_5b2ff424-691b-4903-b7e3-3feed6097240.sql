-- Drop the constraint first to allow updates
ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS valid_deposit_type;

-- Update any existing 'BIMCoin' records to 'Bimcoin'
UPDATE public.deposits 
SET deposit_type = 'Bimcoin' 
WHERE deposit_type = 'BIMCoin';

-- Now add the new constraint
ALTER TABLE public.deposits 
ADD CONSTRAINT valid_deposit_type 
CHECK (deposit_type IN ('TON', 'Bimcoin'));