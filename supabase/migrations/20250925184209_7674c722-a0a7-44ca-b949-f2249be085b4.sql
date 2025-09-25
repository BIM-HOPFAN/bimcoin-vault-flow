-- Add test deposit data for development testing
INSERT INTO deposits (user_id, ton_amount, bim_amount, status, source_type, deposit_comment) 
SELECT 
    id,
    100.0,
    100.0, 
    'confirmed',
    'direct_deposit',
    'TEST:DEPOSIT:' || gen_random_uuid()
FROM users 
WHERE wallet_address IS NOT NULL
ON CONFLICT DO NOTHING