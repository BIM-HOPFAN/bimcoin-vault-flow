-- Drop the redundant general trigger that fires on any update
DROP TRIGGER IF EXISTS deposits_balance_update ON public.deposits;

-- Keep only the specific triggers with proper conditions
-- trigger_update_user_deposit_balance: fires on UPDATE when status changes to 'confirmed' 
-- trigger_update_user_deposit_balance_insert: fires on INSERT when status is already 'confirmed'