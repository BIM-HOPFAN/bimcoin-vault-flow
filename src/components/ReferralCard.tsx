import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Copy, Share, Gift } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';

const ReferralCard = () => {
  const [referralCount, setReferralCount] = useState(0);
  const [earnedFromReferrals, setEarnedFromReferrals] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [userStats, setUserStats] = useState<any>(null);
  const address = useTonAddress();
  const { toast } = useToast();

  const referralLink = address && referralCode
    ? `${window.location.origin}?ref=${referralCode}`
    : 'Connect wallet to get referral link';

  // Fetch user stats including referral data
  const fetchUserStats = async () => {
    if (!address) return;
    
    try {
      const stats = await bimCoinAPI.getUserStats(address);
      if (stats.success && stats.data) {
        setUserStats(stats.data);
        setReferralCount(stats.data.referral_count || 0);
        setEarnedFromReferrals(parseFloat(stats.data.total_earned_from_referrals || '0'));
      }
      
      // Get user profile for referral code
      const profile = await bimCoinAPI.getUserProfile(address);
      if (profile.success && profile.data) {
        setReferralCode(profile.data.referral_code || '');
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  useEffect(() => {
    if (address) {
      fetchUserStats();
    } else {
      setReferralCount(0);
      setEarnedFromReferrals(0);
      setReferralCode('');
      setUserStats(null);
    }
  }, [address]);

  const copyReferralLink = () => {
    if (address) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Referral link copied",
        description: "Share this link to earn 2% OBA on valid deposits!",
        variant: "default",
      });
    }
  };

  const shareReferralLink = () => {
    if (address && navigator.share) {
      navigator.share({
        title: 'Join BIMCoin',
        text: 'Start earning OBA tokens with BIMCoin!',
        url: referralLink,
      });
    } else {
      copyReferralLink();
    }
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-success" />
          Referral Program
        </CardTitle>
        <CardDescription>
          Earn 2% OBA on every valid deposit from your referrals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Users className="w-4 h-4 text-success" />
              <span className="text-sm font-medium">Referrals</span>
            </div>
            <div className="text-2xl font-bold text-success">{referralCount}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Gift className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium">Earned OBA</span>
            </div>
            <div className="text-2xl font-bold text-warning">
              {earnedFromReferrals.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="referral-link">Your Referral Link</Label>
          <div className="flex gap-2">
            <Input
              id="referral-link"
              value={referralLink}
              readOnly
              className="bg-muted/50 border-border/50 text-sm"
            />
            <Button
              size="sm"
              onClick={copyReferralLink}
              disabled={!address}
              variant="outline"
              className="border-success/20 hover:border-success/40"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-1 mb-1">
              <Gift className="w-3 h-3" />
              <span>How it works:</span>
            </div>
            <ul className="text-xs space-y-1 ml-4">
              <li>• Share your referral link with friends</li>
              <li>• They make their first valid deposit (≥1 TON)</li>
              <li>• You earn 2% OBA bonus on their deposit amount</li>
              <li>• Rewards are credited within 365 days</li>
            </ul>
          </div>
        </div>

        <Button 
          onClick={shareReferralLink}
          disabled={!address}
          className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
        >
          <Share className="w-4 h-4 mr-2" />
          Share Referral Link
        </Button>
      </CardContent>
    </Card>
  );
};

export default ReferralCard;