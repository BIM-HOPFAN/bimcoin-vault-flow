import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownCircle, Coins } from 'lucide-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';
import { beginCell, Address } from '@ton/core';

// Helper function to create jetton transfer payload
const createJettonTransferPayload = (jettonWalletAddress: string, amount: bigint, destination: string, comment: string) => {
  const destinationAddress = Address.parse(destination);
  
  const transferBody = beginCell()
    .storeUint(0xf8a7ea5, 32) // jetton transfer op code
    .storeUint(0, 64) // query id
    .storeCoins(amount) // jetton amount
    .storeAddress(destinationAddress) // destination
    .storeAddress(destinationAddress) // response destination
    .storeBit(0) // custom payload
    .storeCoins(1) // forward ton amount
    .storeBit(1) // forward payload
    .storeRef(beginCell().storeUint(0, 32).storeStringTail(comment).endCell()) // comment
    .endCell();

  return transferBody.toBoc().toString('base64');
};

// Helper function to create comment payload for TON deposits
const createCommentPayload = (comment: string) => {
  const cell = beginCell()
    .storeUint(0, 32) // op code for text comment
    .storeStringTail(comment) // the comment text
    .endCell();
  return cell.toBoc().toString('base64');
};

const DepositCard = () => {
  const [amount, setAmount] = useState('');
  const [depositType, setDepositType] = useState<'TON' | 'BIMCoin'>('TON');
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
        description: `Please enter a valid ${depositType} amount`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const depositAmount = parseFloat(amount);
      
      // Register user if not exists and create deposit intent
      await bimCoinAPI.registerUser(address);
      const intentResult = await bimCoinAPI.createDepositIntent(address, depositAmount, depositType);
      
      if (intentResult.error) {
        throw new Error(intentResult.error);
      }

      let transaction;

      if (depositType === 'TON') {
        // Create TON transaction with comment payload
        transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
          messages: [
            {
              address: intentResult.treasury_address,
              amount: (depositAmount * 1e9).toString(), // Convert to nanoTONs
              payload: createCommentPayload(intentResult.deposit_comment),
            },
          ],
        };
      } else {
        // Create BIMCoin jetton transfer transaction
        // For jetton transfers, we need to know the BIMCoin master contract address
        const BIMCOIN_MASTER_ADDRESS = "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA"; // Replace with actual BIMCoin master contract
        
        // Calculate the user's jetton wallet address for BIMCoin
        // This is a simplified approach - in production, you'd query the jetton master contract
        const jettonAmount = BigInt(Math.floor(depositAmount * 1e9)); // Convert to jetton decimals
        
        transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
          messages: [
            {
              address: BIMCOIN_MASTER_ADDRESS, // Send to jetton master for now
              amount: "50000000", // 0.05 TON for fees
              payload: createCommentPayload(`BIMCoin deposit: ${intentResult.deposit_comment}`),
            },
          ],
        };
        
        toast({
          title: "BIMCoin Deposit Info",
          description: "BIMCoin jetton transfer initiated. Please ensure you have BIMCoin tokens in your wallet.",
          variant: "default",
        });
      }

      const txResult = await tonConnectUI.sendTransaction(transaction);
      
      // Wait a bit for transaction to be mined, then check for deposits
      setTimeout(async () => {
        try {
          await bimCoinAPI.checkDeposits();
        } catch (error) {
          console.log('Deposit check error:', error);
        }
      }, 10000); // Wait 10 seconds
      
      toast({
        title: "Deposit initiated",
        description: `Depositing ${amount} ${depositType}. You will receive ${intentResult.bim_amount} BIM tokens.`,
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
          Deposit {depositType}
        </CardTitle>
        <CardDescription>
          Deposit {depositType === 'TON' ? 'TON' : 'BIMCoin tokens'} to mint internal BIM and start earning rewards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deposit-type">Deposit Type</Label>
          <Select value={depositType} onValueChange={(value: 'TON' | 'BIMCoin') => setDepositType(value)}>
            <SelectTrigger className="bg-muted/50 border-border/50 focus:border-primary/50">
              <SelectValue placeholder="Select deposit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TON">TON</SelectItem>
              <SelectItem value="BIMCoin">BIMCoin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deposit-amount">Amount ({depositType})</Label>
          <Input
            id="deposit-amount"
            type="number"
            placeholder={`Enter ${depositType} amount`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.1"
            className="bg-muted/50 border-border/50 focus:border-primary/50"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="w-4 h-4" />
          <span>
            {depositType === 'TON' ? '1 TON = 200 BIM' : '1 BIMCoin = 1 BIM'}
          </span>
        </div>

        <Button 
          onClick={handleDeposit}
          disabled={!address || loading || !amount}
          className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
        >
          {loading ? "Processing..." : `Deposit ${depositType}`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DepositCard;