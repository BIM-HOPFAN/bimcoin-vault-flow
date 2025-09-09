import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pickaxe, Gem, Clock } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';

const MiningCard = () => {
  const [mining, setMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState(0);
  const [earnedOBA, setEarnedOBA] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const address = useTonAddress();
  const { toast } = useToast();

  // Simulate mining progress (50% OBA per day)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (mining) {
      interval = setInterval(() => {
        setMiningProgress(prev => {
          const newProgress = prev + (100 / (24 * 60 * 60)); // Progress per second for 24h cycle
          if (newProgress >= 100) {
            setMining(false);
            return 100;
          }
          return newProgress;
        });
        
        setEarnedOBA(prev => prev + (50 / (24 * 60 * 60))); // 50 OBA per day
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mining]);

  const startMining = () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to start mining",
        variant: "destructive",
      });
      return;
    }

    setMining(true);
    setMiningProgress(0);
    setEarnedOBA(0);
    setTimeRemaining(24 * 60 * 60); // 24 hours in seconds
    
    toast({
      title: "Mining started",
      description: "You're now mining OBA tokens!",
      variant: "default",
    });
  };

  const claimRewards = () => {
    if (earnedOBA > 0) {
      toast({
        title: "Rewards claimed",
        description: `You claimed ${earnedOBA.toFixed(4)} OBA tokens`,
        variant: "default",
      });
      setEarnedOBA(0);
      setMiningProgress(0);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
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
          Mine OBA tokens at 50% per day. Start mining to earn passive rewards!
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
              {earnedOBA.toFixed(4)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Time Left</span>
            </div>
            <div className="text-lg font-bold">
              {mining ? formatTime(timeRemaining) : "00:00:00"}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={startMining}
            disabled={mining || !address}
            className="flex-1 bg-gradient-secondary text-secondary-foreground hover:opacity-90"
          >
            {mining ? "Mining..." : "Start Mining"}
          </Button>
          
          <Button 
            onClick={claimRewards}
            disabled={earnedOBA === 0}
            variant="outline"
            className="flex-1 border-secondary/20 hover:border-secondary/40"
          >
            Claim Rewards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MiningCard;