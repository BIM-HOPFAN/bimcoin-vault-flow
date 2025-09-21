import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

const WalletConnectButton = () => {
  const address = useTonAddress();

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <Button 
        variant="outline" 
        className="enhanced-card border-primary/20 hover:border-primary/40"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {formatAddress(address)}
      </Button>
    );
  }

  return <TonConnectButton />;
};

export default WalletConnectButton;