-- Retroactively mint BIM tokens for existing confirmed deposits that haven't been minted yet
UPDATE deposits 
SET jetton_mint_hash = 'retroactive_mint_' || id::text
WHERE status = 'confirmed' 
  AND jetton_mint_hash IS NULL 
  AND user_id = (SELECT id FROM users WHERE wallet_address = 'UQCv2zOQoWzM8HI5jnNs8KJQngGNHfwnJ4n7DH8gT3wAt_Yk');