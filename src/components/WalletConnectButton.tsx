import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { diagnoseTonConnect } from '@/utils/tonConnectDiagnostics';

const WalletConnectButton = () => {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  // Run diagnostics on mount
  useEffect(() => {
    diagnoseTonConnect();
  }, []);

  // Listen for connection status changes
  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange(
      (wallet) => {
        if (wallet) {
          console.log('Wallet connected:', wallet);
        } else {
          console.log('Wallet disconnected');
        }
      },
      (error) => {
        console.error('Status change error:', error);
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

  // Log when rendering to ensure component mounts
  console.log('WalletConnectButton rendered, address:', address);

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