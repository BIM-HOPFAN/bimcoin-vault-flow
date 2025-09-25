-- Fix the get_active_deposit_bim function to use correct status value
CREATE OR REPLACE FUNCTION public.get_active_deposit_bim(user_uuid uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    one_year_ago timestamp with time zone;
    total_deposits numeric := 0;
    total_burned numeric := 0;
    result_balance numeric := 0;
BEGIN
    one_year_ago := NOW() - INTERVAL '365 days';
    
    -- Get total BIM from direct deposits in last 365 days (use 'confirmed' status)
    SELECT COALESCE(SUM(bim_amount), 0) 
    INTO total_deposits
    FROM deposits 
    WHERE user_id = user_uuid 
    AND status = 'confirmed' 
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
$function$