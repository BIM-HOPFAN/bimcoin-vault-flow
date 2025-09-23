-- Fix security warnings by setting proper search paths for functions
CREATE OR REPLACE FUNCTION get_active_deposit_bim(user_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION update_user_deposit_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION update_user_burn_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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