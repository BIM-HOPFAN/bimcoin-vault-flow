import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode, useEffect } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

  useEffect(() => {
    console.log('TonConnect Manifest URL:', manifestUrl);
    console.log('TonConnect initializing...');
  }, [manifestUrl]);

  return (
    <TonConnectUIProvider 
      manifestUrl={manifestUrl}
      uiPreferences={{ theme: 'SYSTEM' }}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/BIMCoinBot'
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;