-- Add RLS policy for deposits table to restrict user access to their own records
-- Users can only view deposits associated with their wallet address

CREATE POLICY "Users can view their own deposits"
ON public.deposits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = deposits.user_id
    AND users.wallet_address = current_setting('app.current_wallet'::text, true)
  )
);

-- Add comment explaining the security model
COMMENT ON POLICY "Users can view their own deposits" ON public.deposits IS 
'Restricts SELECT access so users can only view deposits linked to their wallet address via the users table';