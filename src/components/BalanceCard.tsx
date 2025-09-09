import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';

interface Balances {
  ton: number;
  bim: number;
  oba: number;
}

const BalanceCard = () => {
  const [balances, setBalances] = useState<Balances>({ ton: 0, bim: 0, oba: 0 });
  const [loading, setLoading] = useState(false);
  const address = useTonAddress();
  const { toast } = useToast();

  // Simulate balance fetching
  const fetchBalances = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock balances - in real app, fetch from blockchain/backend
      setBalances({
        ton: 5.23,
        bim: 1250.75,
        oba: 45.32
      });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      toast({
        title: "Failed to fetch balances",
        description: "There was an error getting your wallet balances",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchBalances();
    } else {
      setBalances({ ton: 0, bim: 0, oba: 0 });
    }
  }, [address]);

  const handleBurnBIM = () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to burn BIM",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Burn functionality",
      description: "Burn BIM tokens to receive TON (feature in development)",
      variant: "default",
    });
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Portfolio Balance
        </CardTitle>
        <CardDescription>
          Your current token balances and portfolio value
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* TON Balance */}
          <div className="text-center space-y-1">
            <div className="text-sm text-muted-foreground">TON</div>
            <div className="text-lg font-bold text-primary">
              {address ? balances.ton.toFixed(2) : '0.00'}
            </div>
          </div>

          {/* BIM Balance */}
          <div className="text-center space-y-1">
            <div className="text-sm text-muted-foreground">BIM</div>
            <div className="text-lg font-bold text-secondary">
              {address ? balances.bim.toFixed(2) : '0.00'}
            </div>
          </div>

          {/* OBA Balance */}
          <div className="text-center space-y-1">
            <div className="text-sm text-muted-foreground">OBA</div>
            <div className="text-lg font-bold text-warning">
              {address ? balances.oba.toFixed(2) : '0.00'}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Portfolio Value</span>
            <div className="flex items-center gap-1 text-success text-sm">
              <TrendingUp className="w-3 h-3" />
              <span>+12.5%</span>
            </div>
          </div>
          <div className="text-2xl font-bold">
            ${address ? ((balances.ton * 2.5) + (balances.bim * 0.0025) + (balances.oba * 0.1)).toFixed(2) : '0.00'}
          </div>
          <div className="text-sm text-muted-foreground">≈ {address ? (balances.ton + (balances.bim * 0.001) + (balances.oba * 0.04)).toFixed(2) : '0.00'} TON</div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={fetchBalances}
            disabled={loading || !address}
            variant="outline"
            size="sm"
            className="flex-1 border-border/50 hover:border-primary/30"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button 
            onClick={handleBurnBIM}
            disabled={!address || balances.bim === 0}
            size="sm"
            className="flex-1 bg-gradient-secondary text-secondary-foreground hover:opacity-90"
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Burn BIM
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceCard;