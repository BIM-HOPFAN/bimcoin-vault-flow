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
  const [showPenaltyWarning, setShowPenaltyWarning] = useState(false);
  const [payoutType, setPayoutType] = useState<'ton' | 'jetton'>('ton');
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
      const result = await bimCoinAPI.burnBIM(address, amount, payoutType);
      
      if (result.success) {
        const payoutDescription = payoutType === 'ton' 
          ? `${result.ton_received} TON` 
          : `${result.jettons_received} Bimcoin jettons`;
        
        toast({
          title: "BIM burned successfully!",
          description: `Burned ${result.bim_burned} BIM and received ${payoutDescription}`,
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

  // Get burn preview when amount changes
  const getBurnPreview = async (amount: string) => {
    if (!address || !amount || parseFloat(amount) <= 0) {
      setBurnPreview(null);
      setShowPenaltyWarning(false);
      return;
    }

    try {
      const preview = await bimCoinAPI.getBurnPreview(address, parseFloat(amount));
      if (preview.success && preview.preview) {
        // Ensure all required properties exist with fallback values
        const safePreview = {
          deposit_bim_balance: preview.preview.deposit_bim_balance || 0,
          earned_bim_balance: preview.preview.earned_bim_balance || 0,
          penalty_amount: preview.preview.penalty_amount || 0,
          final_ton_amount: preview.preview.final_ton_amount || 0,
          original_ton_amount: preview.preview.original_ton_amount || 0,
          ...preview.preview
        };
        setBurnPreview(safePreview);
        setShowPenaltyWarning((safePreview.penalty_amount || 0) > 0);
      } else {
        console.warn('Invalid preview response:', preview);
        setBurnPreview(null);
        setShowPenaltyWarning(false);
      }
    } catch (error) {
      console.error('Failed to get burn preview:', error);
      setBurnPreview(null);
      setShowPenaltyWarning(false);
    }
  };

  // Debounced preview update
  useEffect(() => {
    const timer = setTimeout(() => {
      getBurnPreview(burnAmount);
    }, 500);

    return () => clearTimeout(timer);
  }, [burnAmount, address]);

  const tonReceived = parseFloat(burnAmount) * 0.005 || 0;

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Burn BIM
        </CardTitle>
        <CardDescription>
          Burn your BIM tokens to receive TON or Bimcoin jettons
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
          <span className="text-sm text-muted-foreground">
            {payoutType === 'ton' ? '200 BIM = 1 TON' : '1 BIM = 1 Bimcoin'}
          </span>
        </div>
        
        {showPenaltyWarning && burnPreview && (
          <div className="space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <span className="text-sm font-medium">⚠️ Early Burn Penalty</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Deposit BIM Balance: {(burnPreview.deposit_bim_balance || 0).toFixed(4)} BIM</div>
              <div>Earned BIM Balance: {(burnPreview.earned_bim_balance || 0).toFixed(4)} BIM</div>
              <div>Penalty Amount: {(burnPreview.penalty_amount || 0).toFixed(4)} BIM (50%)</div>
            </div>
          </div>
        )}

        {burnAmount && (
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="font-medium">{parseFloat(burnAmount).toFixed(6)} BIM</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-right">
                {burnPreview ? (
                  <>
                    {showPenaltyWarning && (
                      <div className="text-sm text-muted-foreground line-through">
                        {payoutType === 'ton' 
                          ? `${(burnPreview.original_ton_amount || 0).toFixed(6)} TON` 
                          : `${parseFloat(burnAmount || '0').toFixed(6)} Bimcoin`
                        }
                      </div>
                    )}
                    <div className="font-medium text-primary">
                      {payoutType === 'ton' 
                        ? `${(burnPreview.final_ton_amount || 0).toFixed(6)} TON`
                        : `${(parseFloat(burnAmount || '0') * Math.max(0, 1 - ((burnPreview.penalty_amount || 0) / parseFloat(burnAmount || '1')))).toFixed(6)} Bimcoin`
                      }
                    </div>
                  </>
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
              {payoutType === 'ton' ? (
                <>
                  <Flame className="w-4 h-4 mr-2" />
                  Burn BIM for TON
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Burn BIM for Bimcoin
                </>
              )}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};