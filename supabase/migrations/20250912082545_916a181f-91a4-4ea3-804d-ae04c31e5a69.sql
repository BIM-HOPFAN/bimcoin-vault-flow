-- Reset user BIM balance to only count confirmed deposits
UPDATE users 
SET 
  bim_balance = (
    SELECT COALESCE(SUM(d.bim_amount), 0)
    FROM deposits d 
    WHERE d.user_id = users.id 
    AND d.status = 'confirmed'
    AND d.deposit_hash IS NOT NULL
  ),
  total_deposited = (
    SELECT COALESCE(SUM(d.ton_amount), 0)
    FROM deposits d 
    WHERE d.user_id = users.id 
    AND d.status = 'confirmed'
    AND d.deposit_hash IS NOT NULL
  )
WHERE wallet_address = 'UQCv2zOQoWzM8HI5jnNs8KJQngGNHfwnJ4n7DH8gT3wAt_Yk';