-- Add source tracking for BIM amounts
ALTER TABLE users ADD COLUMN deposit_bim_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN earned_bim_balance numeric NOT NULL DEFAULT 0;

-- Add source type to deposits to track direct deposits vs conversions
ALTER TABLE deposits ADD COLUMN source_type text NOT NULL DEFAULT 'direct_deposit';

-- Add penalty tracking to burns
ALTER TABLE burns ADD COLUMN penalty_amount numeric DEFAULT 0;
ALTER TABLE burns ADD COLUMN burn_type text NOT NULL DEFAULT 'earned_bim';

-- Update existing data: migrate current BIM balances to deposit_bim_balance 
-- (assuming current balances are from deposits)
UPDATE users SET deposit_bim_balance = bim_balance WHERE bim_balance > 0;

-- Create function to calculate active deposit BIM (within 365 days)
CREATE OR REPLACE FUNCTION get_active_deposit_bim(user_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    one_year_ago timestamp with time zone;
    total_deposits numeric := 0;
    total_burned numeric := 0;
    result_balance numeric := 0;
BEGIN
    one_year_ago := NOW() - INTERVAL '365 days';
    
    -- Get total BIM from direct deposits in last 365 days
    SELECT COALESCE(SUM(bim_amount), 0) 
    INTO total_deposits
    FROM deposits 
    WHERE user_id = user_uuid 
    AND status = 'completed' 
    AND source_type = 'direct_deposit'
    AND created_at >= one_year_ago;
    
    -- Get total burned from deposit BIM
    SELECT COALESCE(SUM(bim_amount), 0)
    INTO total_burned
    FROM burns
    WHERE user_id = user_uuid
    AND burn_type = 'deposit_bim'
    AND created_at >= one_year_ago;
    
    result_balance := total_deposits - total_burned;
    
    RETURN GREATEST(result_balance, 0);
END;
$$;

-- Create trigger to update balances when deposits are processed
CREATE OR REPLACE FUNCTION update_user_deposit_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.source_type = 'direct_deposit' THEN
            -- Update deposit BIM balance
            UPDATE users 
            SET deposit_bim_balance = deposit_bim_balance + NEW.bim_amount,
                bim_balance = bim_balance + NEW.bim_amount
            WHERE id = NEW.user_id;
        ELSIF NEW.source_type = 'oba_conversion' THEN
            -- Update earned BIM balance
            UPDATE users 
            SET earned_bim_balance = earned_bim_balance + NEW.bim_amount,
                bim_balance = bim_balance + NEW.bim_amount
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER deposits_balance_update
    AFTER UPDATE ON deposits
    FOR EACH ROW
    EXECUTE FUNCTION update_user_deposit_balance();

-- Create trigger to update balances when burns are processed
CREATE OR REPLACE FUNCTION update_user_burn_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.payout_processed = true AND OLD.payout_processed != true THEN
        IF NEW.burn_type = 'deposit_bim' THEN
            -- Update deposit BIM balance (including penalty)
            UPDATE users 
            SET deposit_bim_balance = deposit_bim_balance - NEW.bim_amount,
                bim_balance = bim_balance - NEW.bim_amount
            WHERE id = NEW.user_id;
        ELSIF NEW.burn_type = 'earned_bim' THEN
            -- Update earned BIM balance
            UPDATE users 
            SET earned_bim_balance = earned_bim_balance - NEW.bim_amount,
                bim_balance = bim_balance - NEW.bim_amount
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER burns_balance_update
    AFTER UPDATE ON burns
    FOR EACH ROW
    EXECUTE FUNCTION update_user_burn_balance();