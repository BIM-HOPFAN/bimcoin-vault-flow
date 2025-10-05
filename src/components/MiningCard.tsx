import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pickaxe, Gem, Clock } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';
import { formatLargeNumber } from '@/lib/utils';

const MiningCard = () => {
  const [mining, setMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState(0);
  const [earnedOBA, setEarnedOBA] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [miningSession, setMiningSession] = useState<any>(null);
  const address = useTonAddress();
  const { toast } = useToast();

  // Fetch mining status from API
  const fetchMiningStatus = async () => {
    if (!address) return;
    
    try {
      const status = await bimCoinAPI.getMiningStatus(address);
      if (status.active_mining) {
        const session = status.active_mining;
        setMiningSession(session);
        
        if (session.status === 'active') {
          setMining(true);
          const startTime = new Date(session.start_time).getTime();
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          const totalDuration = 24 * 60 * 60; // 24 hours
          const progress = Math.min((elapsed / totalDuration) * 100, 100);
          
          setMiningProgress(progress);
          setEarnedOBA(status.current_earnings || 0);
          setTimeRemaining(Math.max(0, totalDuration - elapsed));
        } else {
          setMining(false);
          setMiningProgress(0);
          setEarnedOBA(0);
          setTimeRemaining(0);
        }
      } else {
        setMining(false);
        setMiningProgress(0);
        setEarnedOBA(0);
        setTimeRemaining(0);
      }
    } catch (error) {
      console.error('Failed to fetch mining status:', error);
    }
  };

  // Update mining progress in real time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let apiInterval: NodeJS.Timeout;
    
    if (mining && miningSession) {
      // Update UI every second
      interval = setInterval(() => {
        const startTime = new Date(miningSession.start_time).getTime();
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const totalDuration = 24 * 60 * 60; // 24 hours
        const progress = Math.min((elapsed / totalDuration) * 100, 100);
        
        if (progress >= 100) {
          setMining(false);
          setMiningProgress(100);
          setTimeRemaining(0);
        } else {
          setMiningProgress(progress);
          setTimeRemaining(totalDuration - elapsed);
        }
      }, 1000);

      // Update earnings from API every 30 seconds
      apiInterval = setInterval(() => {
        fetchMiningStatus();
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (apiInterval) clearInterval(apiInterval);
    };
  }, [mining, miningSession]);

  // Fetch status when wallet connects
  useEffect(() => {
    if (address) {
      fetchMiningStatus();
    } else {
      setMining(false);
      setMiningProgress(0);
      setEarnedOBA(0);
      setTimeRemaining(0);
      setMiningSession(null);
    }
  }, [address]);

  const startMining = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to start mining",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await bimCoinAPI.startMining(address);
      if (result.success) {
        await fetchMiningStatus(); // Refresh status
        toast({
          title: "Mining started",
          description: "You're now mining OBA tokens!",
          variant: "default",
        });
      } else if (result.error === 'User not found') {
        // Auto-register user and try again
        console.log('User not found, registering...');
        await bimCoinAPI.registerUser(address);
        const retryResult = await bimCoinAPI.startMining(address);
        if (retryResult.success) {
          await fetchMiningStatus();
          toast({
            title: "Mining started",
            description: "You're now mining OBA tokens!",
            variant: "default",
          });
        } else {
          throw new Error(retryResult.error || 'Failed to start mining after registration');
        }
      } else {
        throw new Error(result.error || 'Failed to start mining');
      }
    } catch (error) {
      console.error('Failed to start mining:', error);
      toast({
        title: "Failed to start mining",
        description: error instanceof Error ? error.message : "There was an error starting mining",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    console.log('🎯 Claim button clicked');
    console.log('📍 Wallet address:', address);
    console.log('💎 Earned OBA:', earnedOBA);
    
    if (!address || earnedOBA === 0) {
      console.log('❌ Cannot claim - no address or no earnings');
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Calling bimCoinAPI.claimMining with address:', address);
      const result = await bimCoinAPI.claimMining(address);
      console.log('📨 Result from API:', result);
      
      if (result.success) {
        toast({
          title: "Rewards claimed",
          description: `You claimed ${earnedOBA.toFixed(4)} OBA tokens`,
          variant: "default",
        });
        await fetchMiningStatus(); // Refresh status
      } else {
        throw new Error(result.error || 'Failed to claim rewards');
      }
    } catch (error) {
      console.error('Failed to claim rewards:', error);
      toast({
        title: "Failed to claim rewards",
        description: error instanceof Error ? error.message : "There was an error claiming rewards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pickaxe className="w-5 h-5 text-secondary" />
          OBA Mining
        </CardTitle>
        <CardDescription>
          Mine OBA tokens at 50% per day of your active BIM deposits (valid for 365 days). Start mining to earn passive rewards!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Mining Progress</span>
            <span>{miningProgress.toFixed(1)}%</span>
          </div>
          <Progress value={miningProgress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Gem className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium">Earned OBA</span>
            </div>
            <div className="text-lg font-bold text-secondary">
              {formatLargeNumber(earnedOBA, 4)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Time Left</span>
            </div>
            <div className="text-lg font-bold">
              {mining && timeRemaining > 0 ? formatTime(timeRemaining) : "00:00:00"}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={startMining}
            disabled={mining || !address || loading}
            className="flex-1 bg-gradient-secondary text-secondary-foreground hover:opacity-90"
          >
            {loading ? "Loading..." : mining ? "Mining..." : "Start Mining"}
          </Button>
          
          <Button 
            onClick={claimRewards}
            disabled={earnedOBA === 0 || loading}
            variant="outline"
            className="flex-1 border-secondary/20 hover:border-secondary/40"
          >
            {loading ? "Claiming..." : "Claim Rewards"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MiningCard;