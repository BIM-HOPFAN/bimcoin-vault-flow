import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  return (
    <TonConnectUIProvider 
      manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;