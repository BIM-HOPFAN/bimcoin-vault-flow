-- Create trigger to automatically update user balances when burns are processed
CREATE TRIGGER update_burn_balances
AFTER INSERT OR UPDATE ON burns
FOR EACH ROW
WHEN (NEW.payout_processed = true)
EXECUTE FUNCTION update_user_burn_balance();