import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  console.log('TonConnectProvider: Initializing with manifest URL');
  
  return (
    <TonConnectUIProvider 
      manifestUrl="https://db23b08d-08a2-4e7e-b648-6f394e9e12c2.lovableproject.com/tonconnect-manifest.json"
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/BIMCoinBot'
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;