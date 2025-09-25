import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  console.log('TonConnectProvider: Initializing with basic config');
  
  return (
    <TonConnectUIProvider>
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;