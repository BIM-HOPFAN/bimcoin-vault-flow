import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useEffect } from 'react';

const WalletConnectButton = () => {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    if (tonConnectUI) {
      const handleConnect = (wallet: any) => {
        console.log('Wallet connected:', wallet);
      };

      const handleDisconnect = () => {
        console.log('Wallet disconnected');
      };

      const handleError = (error: any) => {
        console.log('Wallet connection error:', error);
      };

      tonConnectUI.onStatusChange(handleConnect);
      
      return () => {
        // Note: TonConnect doesn't provide specific cleanup methods
      };
    }
  }, [tonConnectUI]);

  if (address) {
    return (
      <Button 
        variant="outline" 
        className="enhanced-card border-primary/20 hover:border-primary/40"
        onClick={() => {
          console.log('Disconnecting wallet...');
          tonConnectUI.disconnect();
        }}
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