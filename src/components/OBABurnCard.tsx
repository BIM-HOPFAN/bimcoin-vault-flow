import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flame, ArrowRightLeft, Coins } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';
import { formatLargeNumber } from '@/lib/utils';

interface OBABurnCardProps {
  obaBalance: number;
  bimBalance: number;
  onBalanceUpdate?: () => void;
}

const OBABurnCard = ({ obaBalance, bimBalance, onBalanceUpdate }: OBABurnCardProps) => {
  const [burnAmount, setBurnAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const address = useTonAddress();
  const { toast } = useToast();

  const exchangeRate = 200; // 200 OBA = 1 BIM
  const bimReceived = parseFloat(burnAmount) / exchangeRate || 0;

  const handleBurnOBA = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to burn OBA",
        variant: "destructive",
      });
      return;
    }

    const obaAmount = parseFloat(burnAmount);
    if (!obaAmount || obaAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid OBA amount to burn",
        variant: "destructive",
      });
      return;
    }

    if (obaAmount > obaBalance) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${obaBalance.toFixed(4)} OBA available`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await bimCoinAPI.burnOBA(address, obaAmount);
      
      if (result.success) {
        toast({
          title: "OBA burned successfully",
          description: `Burned ${obaAmount} OBA and received ${result.bim_received} BIM`,
          variant: "default",
        });
        setBurnAmount('');
        onBalanceUpdate?.();
      } else {
        throw new Error(result.error || 'Failed to burn OBA');
      }
    } catch (error) {
      console.error('Failed to burn OBA:', error);
      toast({
        title: "Failed to burn OBA",
        description: error instanceof Error ? error.message : "There was an error burning OBA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setBurnAmount(obaBalance.toString());
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Burn OBA for BIM
        </CardTitle>
        <CardDescription>
          Exchange your mined OBA tokens for BIM at a rate of 200 OBA = 1 BIM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Balances */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">OBA Balance</div>
            <div className="text-lg font-bold text-secondary">
              {formatLargeNumber(obaBalance, 4)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">BIM Balance</div>
            <div className="text-lg font-bold text-primary">
              {formatLargeNumber(bimBalance, 4)}
            </div>
          </div>
        </div>

        {/* Burn Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="burnAmount">OBA Amount to Burn</Label>
            <div className="flex gap-2">
              <Input
                id="burnAmount"
                type="number"
                placeholder="0.0000"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                min="0"
                max={obaBalance}
                step="0.0001"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleMaxClick}
                disabled={!address || obaBalance <= 0}
                className="px-4"
              >
                Max
              </Button>
            </div>
          </div>

          {/* Exchange Preview */}
          {burnAmount && parseFloat(burnAmount) > 0 && (
            <div className="flex items-center justify-center gap-2 p-3 bg-accent/50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">You burn</div>
                <div className="font-semibold">{formatLargeNumber(parseFloat(burnAmount), 4)} OBA</div>
              </div>
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground">You receive</div>
                <div className="font-semibold text-primary">{formatLargeNumber(bimReceived, 4)} BIM</div>
              </div>
            </div>
          )}

          {/* Exchange Rate Info */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Coins className="w-4 h-4" />
            <span>Exchange Rate: 200 OBA = 1 BIM</span>
          </div>

          {/* Burn Button */}
          <Button
            onClick={handleBurnOBA}
            disabled={!address || !burnAmount || parseFloat(burnAmount) <= 0 || loading || parseFloat(burnAmount) > obaBalance}
            className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
            size="lg"
          >
            {loading ? "Burning..." : !address ? "Connect Wallet" : "Burn OBA for BIM"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OBABurnCard;