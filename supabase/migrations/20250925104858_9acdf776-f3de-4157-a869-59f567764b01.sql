-- Fix the deposit status mismatch in the trigger function
-- The edge functions use 'confirmed' but the trigger expects 'completed'

CREATE OR REPLACE FUNCTION public.update_user_deposit_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
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
$function$;