import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';

interface Balances {
  ton: number;
  bim: number;
  oba: number;
}

interface BalanceCardProps {
  onBalancesUpdate?: (balances: { oba: number; bim: number }) => void;
}

const BalanceCard = ({ onBalancesUpdate }: BalanceCardProps) => {
  const [balances, setBalances] = useState<Balances>({ ton: 0, bim: 0, oba: 0 });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tonPrice, setTonPrice] = useState(2.5); // Default to $2.5, will fetch real price
  const address = useTonAddress();
  const { toast } = useToast();

  // Initialize user when wallet connects
  const initializeUser = async (walletAddress: string) => {
    try {
      // Try to get existing user profile
      let userProfile = await bimCoinAPI.getUserProfile(walletAddress);
      
      if (!userProfile.success) {
        // Check for referral code in localStorage
        const referralCode = localStorage.getItem('referralCode');
        
        // Register new user if doesn't exist
        console.log('Registering new user:', walletAddress, 'with referral:', referralCode);
        const registerResult = await bimCoinAPI.registerUser(walletAddress, referralCode || undefined);
        if (registerResult.success) {
          userProfile = await bimCoinAPI.getUserProfile(walletAddress);
          // Clear referral code after successful registration
          if (referralCode) {
            localStorage.removeItem('referralCode');
          }
        }
      }
      
      if (userProfile.user) {
        setUser(userProfile.user);
        console.log('User initialized:', userProfile.user);
      }
    } catch (error) {
      console.error('Failed to initialize user:', error);
    }
  };

  // Fetch real TON price from CoinGecko API
  const fetchTonPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
      const data = await response.json();
      const price = data['the-open-network']?.usd;
      if (price) {
        setTonPrice(price);
        console.log('TON price fetched:', price);
      }
    } catch (error) {
      console.log('Failed to fetch TON price, using default:', error);
    }
  };

  // Fetch balances - always get BIM/OBA from user profile, optionally get TON from API
  const fetchBalances = async () => {
    if (!address) return;
    
    setLoading(true);
    console.log('Fetching balances for address:', address);
    
    try {
      // Always fetch user profile first for BIM/OBA balances
      console.log('Fetching user profile...');
      const userProfile = await bimCoinAPI.getUserProfile(address);
      
      if (userProfile.user) {
        console.log('User profile data:', userProfile.user);
        setUser(userProfile.user);
        
        // Set BIM/OBA balances from database
        const newBalances = {
          ton: 0, // Will try to get this separately
          bim: parseFloat(userProfile.user.bim_balance || '0'),
          oba: parseFloat(userProfile.user.oba_balance || '0')
        };
        
        // Try to get TON balance from API
        try {
          console.log('Fetching TON balance...');
          const balanceData = await bimCoinAPI.getBalance(address);
          if (balanceData.success && balanceData.ton_balance) {
            newBalances.ton = parseFloat(balanceData.ton_balance);
            console.log('TON balance fetched:', newBalances.ton);
          } else {
            console.log('TON balance API failed, using 0');
          }
        } catch (tonError) {
          console.log('TON balance fetch error:', tonError);
        }
        
        setBalances(newBalances);
        console.log('Final balances set:', newBalances);
        
        // Notify parent component of balance changes
        onBalancesUpdate?.({
          oba: newBalances.oba,
          bim: newBalances.bim
        });
        
      } else {
        console.error('Failed to fetch user profile:', userProfile);
        toast({
          title: "Failed to fetch profile",
          description: "Could not load your account data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in fetchBalances:', error);
      toast({
        title: "Failed to fetch balances",
        description: "There was an error getting your wallet balances",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Trigger deposit check to process pending deposits
  const triggerDepositCheck = async () => {
    try {
      console.log('Checking for pending deposits...');
      const response = await fetch('https://xyskyvwxbpnlveamxwlb.supabase.co/functions/v1/ton-watcher/check-deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      console.log('Deposit check result:', result);
      
      if (result.processed_deposits > 0) {
        toast({
          title: "Deposits Processed",
          description: `Successfully processed ${result.processed_deposits} deposit(s)! Your BIM balance has been updated.`,
        });
        // Refresh balances after processing deposits
        setTimeout(() => fetchBalances(), 2000);
      } else {
        toast({
          title: "No Deposits to Process",
          description: "No pending deposits found or they are too recent (wait 2 minutes after depositing).",
        });
      }
    } catch (error) {
      console.error('Error checking deposits:', error);
      toast({
        title: "Error Processing Deposits",
        description: "There was an error processing your deposits. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Fetch TON price on component mount
    fetchTonPrice();
    
    if (address) {
      initializeUser(address);
      fetchBalances();
      // Check for pending deposits that might need processing
      setTimeout(() => triggerDepositCheck(), 3000);
    } else {
      setBalances({ ton: 0, bim: 0, oba: 0 });
      setUser(null);
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
            ${address ? ((balances.ton * tonPrice) + (balances.bim * tonPrice * 0.005) + (balances.oba * tonPrice * 0.005 * 0.005)).toFixed(2) : '0.00'}
          </div>
          <div className="text-sm text-muted-foreground">≈ {address ? (balances.ton + (balances.bim * 0.005) + (balances.oba * 0.005 * 0.005)).toFixed(4) : '0.00'} TON</div>
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
            onClick={triggerDepositCheck}
            disabled={!address}
            variant="outline"
            size="sm"
            className="flex-1 border-border/50 hover:border-primary/30"
          >
            Process Deposits
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