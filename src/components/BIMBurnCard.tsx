import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { Flame, ArrowRight } from 'lucide-react';
import { bimCoinAPI } from '@/lib/api';

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
  const address = useTonAddress();
  const { toast } = useToast();

  const handleBurnBIM = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to burn BIM",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(burnAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid BIM amount to burn",
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
      const result = await bimCoinAPI.burnBIM(address, amount);
      
      if (result.success) {
        toast({
          title: "BIM burned successfully!",
          description: `Burned ${result.bim_burned} BIM and received ${result.ton_received} TON`,
          variant: "default",
        });
        setBurnAmount('');
        onBalanceUpdate?.();
      } else {
        toast({
          title: "Burn failed",
          description: result.error || "Failed to burn BIM tokens",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Burn BIM error:', error);
      toast({
        title: "Error",
        description: "An error occurred while burning BIM tokens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setBurnAmount(bimBalance.toString());
  };

  const tonReceived = parseFloat(burnAmount) / 200 || 0;

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Burn BIM for TON
        </CardTitle>
        <CardDescription>
          Burn your BIM tokens to receive TON directly to your wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="burn-amount">BIM Amount to Burn</Label>
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
          <span className="text-sm text-muted-foreground">200 BIM = 1 TON</span>
        </div>

        {burnAmount && tonReceived > 0 && (
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="font-medium">{parseFloat(burnAmount).toFixed(6)} BIM</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-primary">{tonReceived.toFixed(6)} TON</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleBurnBIM}
          disabled={loading || !burnAmount || parseFloat(burnAmount) <= 0}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Burning BIM...
            </>
          ) : (
            <>
              <Flame className="w-4 h-4 mr-2" />
              Burn BIM for TON
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};