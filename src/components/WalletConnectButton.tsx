import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

const WalletConnectButton = () => {
  return (
    <Button 
      variant="outline" 
      className="enhanced-card border-primary/20 hover:border-primary/40"
      onClick={() => console.log('Wallet connection temporarily disabled')}
    >
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet (Temporarily Disabled)
    </Button>
  );
};

export default WalletConnectButton;