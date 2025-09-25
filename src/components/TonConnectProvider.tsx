import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  console.log('TonConnectProvider: Initializing without manifest URL');
  
  return (
    <TonConnectUIProvider 
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/BIMCoinBot'
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;