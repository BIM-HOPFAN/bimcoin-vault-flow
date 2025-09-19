-- Remove the fake placeholder minter address from config
DELETE FROM config 
WHERE key = 'jetton_minter_address' 
AND value = 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp2_Pt';