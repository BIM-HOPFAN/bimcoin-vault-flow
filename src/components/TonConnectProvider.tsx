import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

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