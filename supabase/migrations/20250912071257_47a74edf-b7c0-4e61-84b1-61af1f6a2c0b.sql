-- Update the BIM per TON exchange rate to 200
UPDATE config 
SET value = '200', 
    updated_at = now() 
WHERE key = 'bim_per_ton';