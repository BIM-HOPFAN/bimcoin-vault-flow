-- Add initial admin user
INSERT INTO public.admin_users (wallet_address) 
VALUES ('UQCv2zOQoWzM8HI5jnNs8KJQngGNHfwnJ4n7DH8gT3wAt_Yk')
ON CONFLICT (wallet_address) DO NOTHING;