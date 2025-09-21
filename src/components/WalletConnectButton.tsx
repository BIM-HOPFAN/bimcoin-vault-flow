import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useEffect } from 'react';

const WalletConnectButton = () => {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();

  useEffect(() => {
    // Add connection error handling
    const unsubscribe = tonConnectUI.onStatusChange((walletInfo) => {
      if (walletInfo) {
        console.log('Wallet connected:', walletInfo);
      } else {
        console.log('Wallet disconnected');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [tonConnectUI]);

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  if (address) {
    return (
      <Button 
        variant="outline" 
        className="enhanced-card border-primary/20 hover:border-primary/40"
        onClick={handleDisconnect}
      >
        <Wallet className="w-4 h-4 mr-2" />
        {formatAddress(address)}
      </Button>
    );
  }

  return (
    <div className="ton-connect-wrapper">
      <TonConnectButton className="ton-connect-button" />
    </div>
  );
};

export default WalletConnectButton;