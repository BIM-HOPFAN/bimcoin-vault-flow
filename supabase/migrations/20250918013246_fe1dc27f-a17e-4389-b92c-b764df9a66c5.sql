-- Add BIMCoin master contract address configuration
INSERT INTO config (key, value, description) VALUES 
('jetton_minter_address', 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp2_Pt', 'BIMCoin jetton master contract address on TON blockchain')
ON CONFLICT (key) DO UPDATE SET 
value = EXCLUDED.value,
description = EXCLUDED.description,
updated_at = now();