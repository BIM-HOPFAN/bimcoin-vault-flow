-- Update treasury address in config table to match the updated environment variable
UPDATE config 
SET value = 'UQCv2zOQoWzM8HI5jnNs8KJQngGNHfwnJ4n7DH8gT3wAt_Yk'
WHERE key = 'treasury_address';