import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { Flame, ArrowRight, Coins } from 'lucide-react';
import { bimCoinAPI } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BIMBurnCardProps {
  bimBalance: number;
  onBalanceUpdate?: () => void;
}

export const BIMBurnCard: React.FC<BIMBurnCardProps> = ({ 
  bimBalance, 
  onBalanceUpdate 
}) => {
  const [burnAmount, setBurnAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [burnPreview, setBurnPreview] = useState<any>(null);
  const [payoutType, setPayoutType] = useState<'ton' | 'jetton'>('ton');
  const address = useTonAddress();
  const { toast } = useToast();

  const handleWithdraw = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to withdraw",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(burnAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid BIM amount to withdraw",
        variant: "destructive",
      });
      return;
    }

    if (amount > bimBalance) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${bimBalance.toFixed(6)} BIM available`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { withdrawalAPI } = await import('@/lib/withdrawalAPI');
      const result = payoutType === 'ton' 
        ? await withdrawalAPI.withdrawTON(address, amount)
        : await withdrawalAPI.withdrawJetton(address, amount);
      
      if (result.success) {
        const payoutDescription = payoutType === 'ton' 
          ? `${result.ton_received || 0} TON` 
          : `${result.jetton_received || 0} Bimcoin`;

        const penaltyNote = result.penalty_amount && result.penalty_amount > 0
          ? ` (${result.penalty_amount} BIM penalty applied)`
          : '';
        
        toast({
          title: "Withdrawal successful!",
          description: `Withdrew ${result.bim_withdrawn} BIM and received ${payoutDescription}${penaltyNote}`,
          variant: "default",
        });
        setBurnAmount('');
        onBalanceUpdate?.();
      } else {
        toast({
          title: "Withdrawal failed",
          description: result.error || "Failed to process withdrawal",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred during withdrawal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setBurnAmount(bimBalance.toString());
  };

  // Get withdrawal preview when amount changes
  const getWithdrawalPreview = async (amount: string) => {
    if (!address || !amount || parseFloat(amount) <= 0) {
      setBurnPreview(null);
      return;
    }

    try {
      const { withdrawalAPI } = await import('@/lib/withdrawalAPI');
      const preview = await withdrawalAPI.previewWithdrawal(address, parseFloat(amount), payoutType);
      setBurnPreview(preview);
    } catch (error) {
      console.error('Failed to get withdrawal preview:', error);
      setBurnPreview(null);
    }
  };

  // Debounced preview update
  useEffect(() => {
    const timer = setTimeout(() => {
      getWithdrawalPreview(burnAmount);
    }, 500);

    return () => clearTimeout(timer);
  }, [burnAmount, address, payoutType]);

  const tonReceived = parseFloat(burnAmount) * 0.005 || 0;

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          Withdraw BIM
        </CardTitle>
        <CardDescription>
          Withdraw your BIM tokens to receive TON or Bimcoin jettons automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={payoutType} onValueChange={(value) => setPayoutType(value as 'ton' | 'jetton')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ton" className="flex items-center gap-2">
              <Flame className="w-4 h-4" />
              TON Payout
            </TabsTrigger>
            <TabsTrigger value="jetton" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Bimcoin Payout
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ton" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Receive TON directly to your wallet (Exchange: 200 BIM = 1 TON)
            </div>
          </TabsContent>
          <TabsContent value="jetton" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Receive Bimcoin jettons to your wallet (Exchange: 1 BIM = 1 Bimcoin)
            </div>
          </TabsContent>
        </Tabs>
          <div className="space-y-2">
          <Label htmlFor="burn-amount">BIM Amount to Withdraw</Label>
          <div className="flex gap-2">
            <Input
              id="burn-amount"
              type="number"
              placeholder="0.000000"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              className="flex-1"
              min="0"
              step="0.000001"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleMaxClick}
              disabled={bimBalance === 0}
            >
              Max
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Available: {bimBalance.toFixed(6)} BIM
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">Exchange Rate:</span>
          <span className="text-sm text-muted-foreground">
            {payoutType === 'ton' ? '200 BIM = 1 TON' : '1 BIM = 1 Bimcoin'}
          </span>
        </div>
        
        {burnAmount && (
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="font-medium">{parseFloat(burnAmount).toFixed(6)} BIM</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-right">
                {burnPreview ? (
                  <div className="font-medium text-primary">
                    {payoutType === 'ton' 
                      ? `${(burnPreview.ton_amount || 0).toFixed(6)} TON`
                      : `${(burnPreview.jetton_amount || parseFloat(burnAmount || '0')).toFixed(6)} Bimcoin`
                    }
                  </div>
                ) : (
                  <span className="font-medium text-primary">
                    {payoutType === 'ton' 
                      ? `${(parseFloat(burnAmount || '0') * 0.005).toFixed(6)} TON`
                      : `${parseFloat(burnAmount || '0').toFixed(6)} Bimcoin`
                    }
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleWithdraw}
          disabled={loading || !burnAmount || parseFloat(burnAmount) <= 0}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Processing Withdrawal...
            </>
          ) : (
            <>
              <Coins className="w-4 h-4 mr-2" />
              {payoutType === 'ton' ? 'Withdraw BIM for TON' : 'Withdraw BIM for Bimcoin'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};