import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut } from 'lucide-react';
import { useEffect } from 'react';

const WalletConnectButton = () => {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange(
      (wallet) => {
        if (wallet) {
          console.log('Wallet connected:', wallet.account.address);
        } else {
          console.log('Wallet disconnected');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [tonConnectUI]);

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const handleDisconnect = async () => {
    await tonConnectUI.disconnect();
  };

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          className="enhanced-card border-primary/20 hover:border-primary/40"
        >
          <Wallet className="w-4 h-4 mr-2" />
          {formatAddress(address)}
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return <TonConnectButton />;
};

export default WalletConnectButton;