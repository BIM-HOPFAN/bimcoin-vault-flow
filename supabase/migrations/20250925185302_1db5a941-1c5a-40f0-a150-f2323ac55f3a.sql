-- Create trigger to update user balances when deposit status changes to confirmed
CREATE OR REPLACE TRIGGER trigger_update_user_deposit_balance
  AFTER UPDATE ON deposits
  FOR EACH ROW 
  WHEN (NEW.status = 'confirmed' AND OLD.status != 'confirmed')
  EXECUTE FUNCTION update_user_deposit_balance();

-- Also create trigger for new confirmed deposits (inserts)  
CREATE OR REPLACE TRIGGER trigger_update_user_deposit_balance_insert
  AFTER INSERT ON deposits
  FOR EACH ROW 
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION update_user_deposit_balance();

-- Manually update balances for existing confirmed deposits that weren't processed
UPDATE users SET 
  deposit_bim_balance = COALESCE((
    SELECT SUM(d.bim_amount) 
    FROM deposits d 
    WHERE d.user_id = users.id 
    AND d.status = 'confirmed' 
    AND d.source_type = 'direct_deposit'
  ), 0),
  earned_bim_balance = COALESCE((
    SELECT SUM(d.bim_amount) 
    FROM deposits d 
    WHERE d.user_id = users.id 
    AND d.status = 'confirmed' 
    AND d.source_type = 'oba_conversion'
  ), 0),
  bim_balance = COALESCE((
    SELECT SUM(d.bim_amount) 
    FROM deposits d 
    WHERE d.user_id = users.id 
    AND d.status = 'confirmed'
  ), 0)
WHERE id IN (
  SELECT DISTINCT user_id FROM deposits WHERE status = 'confirmed'
);