-- Configure the Bimcoin jetton master contract address
INSERT INTO config (key, value, description) 
VALUES ('jetton_minter_address', 'EQB0ePLIUc02kwXNA7ulK-vlotIxIqrEfD0tBC53Bmz6DCRO', 'The Bimcoin jetton master contract address')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();