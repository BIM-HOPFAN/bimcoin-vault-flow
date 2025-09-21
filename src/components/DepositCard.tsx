import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDownCircle, Coins } from 'lucide-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';

const DepositCard = () => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { toast } = useToast();

  const handleDeposit = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const depositAmount = parseFloat(amount);
      
      // Register user if not exists and create deposit intent
      await bimCoinAPI.registerUser(address);
      const intentResult = await bimCoinAPI.createDepositIntent(address, depositAmount);
      
      if (intentResult.error) {
        throw new Error(intentResult.error);
      }

      // Create transaction with the generated comment and treasury address
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        messages: [
          {
            address: intentResult.treasury_address,
            amount: (depositAmount * 1e9).toString(), // Convert to nanoTONs
            payload: intentResult.deposit_comment, // Use the generated deposit comment
          },
        ],
      };

      await tonConnectUI.sendTransaction(transaction);
      
      toast({
        title: "Deposit initiated",
        description: `Depositing ${amount} TON. You will receive ${intentResult.bim_amount} BIM tokens.`,
        variant: "default",
      });
      
      setAmount('');
    } catch (error) {
      console.error('Deposit failed:', error);
      toast({
        title: "Deposit failed",
        description: error instanceof Error ? error.message : "There was an error processing your deposit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5 text-primary" />
          Deposit TON
        </CardTitle>
        <CardDescription>
          Deposit TON to mint BIMCoin and start earning rewards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deposit-amount">Amount (TON)</Label>
          <Input
            id="deposit-amount"
            type="number"
            placeholder="Enter TON amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.1"
            className="bg-muted/50 border-border/50 focus:border-primary/50"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="w-4 h-4" />
          <span>Exchange Rate: 1 TON = 1,000 BIM</span>
        </div>

        <Button 
          onClick={handleDeposit}
          disabled={!address || loading || !amount}
          className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
        >
          {loading ? "Processing..." : "Deposit TON"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DepositCard;