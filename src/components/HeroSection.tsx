import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';
import WalletConnectButton from './WalletConnectButton';

const HeroSection = () => {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-background">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-secondary/10 rounded-full blur-2xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50 mb-6">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">TON Blockchain DeFi Protocol</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Earn with{' '}
          <span className="gradient-text bg-gradient-primary">BIMCoin</span>
          <br />
          on TON Network
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Deposit TON, mint BIM tokens, mine OBA rewards, and participate in the future of 
          decentralized finance on The Open Network.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <WalletConnectButton />
          <Button 
            variant="outline" 
            size="lg"
            className="border-border/50 hover:border-primary/30 enhanced-card"
          >
            Learn More
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border border-border/30">
            <div className="p-2 rounded-lg bg-primary/20">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-semibold">50% Daily Mining</div>
              <div className="text-sm text-muted-foreground">Earn OBA tokens</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border border-border/30">
            <div className="p-2 rounded-lg bg-secondary/20">
              <Sparkles className="w-5 h-5 text-secondary" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Task Rewards</div>
              <div className="text-sm text-muted-foreground">3% OBA daily bonus</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border border-border/30">
            <div className="p-2 rounded-lg bg-success/20">
              <Shield className="w-5 h-5 text-success" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Secure & Transparent</div>
              <div className="text-sm text-muted-foreground">TON blockchain</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;