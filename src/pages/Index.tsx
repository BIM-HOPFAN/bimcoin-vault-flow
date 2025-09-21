import { useTonAddress } from '@tonconnect/ui-react';
import HeroSection from '@/components/HeroSection';
import BalanceCard from '@/components/BalanceCard';
import DepositCard from '@/components/DepositCard';
import MiningCard from '@/components/MiningCard';
import TaskCard from '@/components/TaskCard';
import ReferralCard from '@/components/ReferralCard';
import WalletConnectButton from '@/components/WalletConnectButton';
import JettonMinterManager from '@/components/JettonMinterManager';
import OBABurnCard from '@/components/OBABurnCard';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendingUp, Users, Trophy } from 'lucide-react';
import { useReferral } from '@/hooks/useReferral';
import { useEffect, useState, useCallback } from 'react';

const Index = () => {
  const address = useTonAddress();
  const { referralCode } = useReferral();
  const [balanceUpdateKey, setBalanceUpdateKey] = useState(0);
  const [userBalances, setUserBalances] = useState({ oba: 0, bim: 0 });
  
  const handleBalanceUpdate = useCallback(() => {
    setBalanceUpdateKey(prev => prev + 1);
  }, []);

  // Log referral code for debugging
  useEffect(() => {
    if (referralCode) {
      console.log('Referral code detected:', referralCode);
    }
  }, [referralCode]);

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">B</span>
            </div>
            <span className="text-xl font-bold gradient-text">BIMCoin</span>
          </div>
          
          <WalletConnectButton />
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection />

      {/* Dashboard Content */}
      {address ? (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Your BIMCoin Dashboard</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Manage your deposits, track mining progress, complete tasks, and grow your portfolio
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left column - Balance and Mining */}
              <div className="space-y-6">
                <BalanceCard 
                  key={`balance-${balanceUpdateKey}`}
                  onBalancesUpdate={setUserBalances}
                />
                <MiningCard />
              </div>

              {/* Middle column - Deposit and Tasks */}
              <div className="space-y-6">
                <DepositCard />
                <OBABurnCard 
                  obaBalance={userBalances.oba}
                  bimBalance={userBalances.bim}
                  onBalanceUpdate={handleBalanceUpdate}
                />
                <TaskCard />
              </div>

              {/* Right column - Referrals and Admin */}
              <div className="space-y-6">
                <ReferralCard />
                {/* Admin Panel - Only show for development/admin users */}
                {(address === 'EQBkKJWaEWnpczK4KwKpR0Cb9kLXfB4HMfq_CdKSYlPo1Yrs' || 
                  window.location.hostname === 'localhost' ||
                  window.location.hostname.includes('lovableproject.com')) && (
                  <JettonMinterManager />
                )}
                
                {/* Quick Stats */}
                <Card className="enhanced-card">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4 text-center">Quick Stats</h3>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="w-4 h-4 text-success" />
                        </div>
                        <div className="text-lg font-bold text-success">+24.5%</div>
                        <div className="text-xs text-muted-foreground">24h Change</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-lg font-bold">12.5K</div>
                        <div className="text-xs text-muted-foreground">Total Users</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Connect Wallet CTA */
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="enhanced-card p-8">
              <div className="mb-6">
                <Wallet className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-2xl font-bold mb-2">Connect Your TON Wallet</h3>
                <p className="text-muted-foreground">
                  Connect your TON wallet to start earning BIM and OBA tokens through deposits, mining, and tasks
                </p>
              </div>
              
              <WalletConnectButton />
              
              <div className="mt-6 pt-6 border-t border-border/50">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <Trophy className="w-5 h-5 mx-auto mb-1 text-warning" />
                    <div className="font-medium">Earn Rewards</div>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-success" />
                    <div className="font-medium">Mine OBA</div>
                  </div>
                  <div className="text-center">
                    <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <div className="font-medium">Refer Friends</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 BIMCoin. Built on The Open Network (TON)</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;