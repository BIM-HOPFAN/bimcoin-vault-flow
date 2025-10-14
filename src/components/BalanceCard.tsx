import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, RefreshCw, TrendingDown } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';
import { formatLargeNumber } from '@/lib/utils';

interface Balances {
  ton: number;
  bim: number;
  oba: number;
  realBimcoin: number;
}

interface BalanceCardProps {
  onBalancesUpdate?: (balances: { oba: number; bim: number }) => void;
}

const BalanceCard = ({ onBalancesUpdate }: BalanceCardProps) => {
  const [balances, setBalances] = useState<Balances>({ ton: 0, bim: 0, oba: 0, realBimcoin: 0 });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tonPrice, setTonPrice] = useState(2.5); // Default to $2.5, will fetch real price
  const [portfolioChange, setPortfolioChange] = useState<{ percentage: number; isPositive: boolean } | null>(null);
  const address = useTonAddress();
  const { toast } = useToast();

  // Initialize user when wallet connects
  const initializeUser = async (walletAddress: string) => {
    try {
      // Try to get existing user profile
      let userProfile = await bimCoinAPI.getUserProfile(walletAddress);
      
      if (!userProfile.data) {
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
      
      if (userProfile.data) {
        setUser(userProfile.data);
        console.log('User initialized:', userProfile.data);
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

  // Calculate portfolio value in USD
  const calculatePortfolioValue = (balanceData: Balances, price: number) => {
    return (balanceData.ton * price) + 
           (balanceData.bim * price * 0.005) + 
           (balanceData.realBimcoin * price * 0.005) +
           (balanceData.oba * price * 0.005 * 0.005);
  };

  // Calculate and store portfolio change
  const updatePortfolioChange = (newBalances: Balances, price: number) => {
    const currentValue = calculatePortfolioValue(newBalances, price);
    
    // Get stored value from 24 hours ago
    const storageKey = `portfolio_history_${address}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const history = JSON.parse(stored);
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        // Find the closest snapshot to 24 hours ago
        const oldestSnapshot = history
          .filter((s: any) => s.timestamp <= oneDayAgo)
          .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
        
        if (oldestSnapshot) {
          const oldValue = oldestSnapshot.value;
          const change = ((currentValue - oldValue) / oldValue) * 100;
          setPortfolioChange({
            percentage: Math.abs(change),
            isPositive: change >= 0
          });
        } else {
          // Not enough history yet
          setPortfolioChange(null);
        }
        
        // Add current snapshot and clean up old data (keep last 7 days)
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        const updatedHistory = [
          ...history.filter((s: any) => s.timestamp > sevenDaysAgo),
          { timestamp: now, value: currentValue }
        ];
        
        localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
      } catch (err) {
        console.error('Error processing portfolio history:', err);
        // Initialize new history
        localStorage.setItem(storageKey, JSON.stringify([
          { timestamp: Date.now(), value: currentValue }
        ]));
      }
    } else {
      // Initialize portfolio history
      localStorage.setItem(storageKey, JSON.stringify([
        { timestamp: Date.now(), value: currentValue }
      ]));
      setPortfolioChange(null);
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
      
      if (userProfile.data) {
        console.log('User profile data:', userProfile.data);
        setUser(userProfile.data);
        
        // Set BIM/OBA balances from database
        const newBalances = {
          ton: 0, // Will try to get this separately
          bim: parseFloat(userProfile.data.bim_balance || '0'),
          oba: parseFloat(userProfile.data.oba_balance || '0'),
          realBimcoin: 0 // Will get from API
        };
        
        // Try to get TON balance and real Bimcoin balance from API
        try {
          console.log('Fetching balances from blockchain...');
          const balanceData = await bimCoinAPI.getBalance(address);
          if (balanceData.success) {
            if (balanceData.ton_balance) {
              newBalances.ton = parseFloat(balanceData.ton_balance);
              console.log('TON balance fetched:', newBalances.ton);
            }
            if (balanceData.real_bimcoin_balance) {
              newBalances.realBimcoin = parseFloat(balanceData.real_bimcoin_balance);
              console.log('Real Bimcoin balance fetched:', newBalances.realBimcoin);
            }
          } else {
            console.log('Balance API failed, using defaults');
          }
        } catch (balanceError) {
          console.log('Balance fetch error:', balanceError);
        }
        
        setBalances(newBalances);
        console.log('Final balances set:', newBalances);
        
        // Calculate and update portfolio change
        updatePortfolioChange(newBalances, tonPrice);
        
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
      const response = await fetch('https://xyskyvwxbpnlveamxwlb.supabase.co/functions/v1/ton-watcher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'check-deposits' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Deposit check result:', result);
      
      if (result.success) {
        if (result.processed_deposits > 0) {
          toast({
            title: "Deposits Processed Successfully!",
            description: `Processed ${result.processed_deposits} deposit(s). Your BIM balance has been updated.`,
          });
          // Refresh balances after processing deposits
          setTimeout(() => fetchBalances(), 1000);
        }
        // Don't show "No New Deposits" message for automatic checks
      } else {
        toast({
          title: "Processing Failed",
          description: result.error || "Failed to process deposits.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking deposits:', error);
      toast({
        title: "Network Error",
        description: "Could not connect to deposit processing service. Please try again.",
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
      setBalances({ ton: 0, bim: 0, oba: 0, realBimcoin: 0 });
      setUser(null);
    }
  }, [address]);


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
        <div className="grid grid-cols-4 gap-3">
          {/* TON Balance */}
          <div className="text-center space-y-1">
            <div className="text-sm text-muted-foreground">TON</div>
            <div className="text-lg font-bold text-primary">
              {address ? formatLargeNumber(balances.ton) : '0.00'}
            </div>
          </div>

          {/* BIM Balance (Internal) */}
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">BIM (App)</div>
            <div className="text-lg font-bold text-secondary">
              {address ? formatLargeNumber(balances.bim) : '0.00'}
            </div>
          </div>

          {/* Real Bimcoin Balance */}
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">Bimcoin</div>
            <div className="text-lg font-bold text-green-400">
              {address ? formatLargeNumber(balances.realBimcoin, 0) : '0'}
            </div>
          </div>

          {/* OBA Balance */}
          <div className="text-center space-y-1">
            <div className="text-sm text-muted-foreground">OBA</div>
            <div className="text-lg font-bold text-warning">
              {address ? formatLargeNumber(balances.oba) : '0.00'}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Portfolio Value</span>
            {portfolioChange && (
              <div className={`flex items-center gap-1 text-sm ${portfolioChange.isPositive ? 'text-success' : 'text-destructive'}`}>
                <TrendingUp className={`w-3 h-3 ${!portfolioChange.isPositive ? 'rotate-180' : ''}`} />
                <span>{portfolioChange.isPositive ? '+' : '-'}{portfolioChange.percentage.toFixed(2)}%</span>
              </div>
            )}
          </div>
          <div className="text-2xl font-bold">
            ${address ? formatLargeNumber(calculatePortfolioValue(balances, tonPrice)) : '0.00'}
          </div>
          <div className="text-sm text-muted-foreground">≈ {address ? formatLargeNumber(balances.ton + (balances.bim * 0.005) + (balances.oba * 0.005 * 0.005), 4) : '0.00'} TON</div>
          {portfolioChange === null && address && (
            <div className="text-xs text-muted-foreground mt-1">
              24h change will appear after 24 hours
            </div>
          )}
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
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceCard;