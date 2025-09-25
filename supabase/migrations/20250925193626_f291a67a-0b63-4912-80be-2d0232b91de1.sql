-- Configure the treasury address for deposits
INSERT INTO config (key, value, description) 
VALUES ('treasury_address', 'UQDrH_ApfAz2W98MiU9tO3IlNj4szE1oaD1fkgPqz28fxfWk', 'The treasury wallet address for receiving deposits')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();