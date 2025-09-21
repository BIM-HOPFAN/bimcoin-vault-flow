import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  return (
    <TonConnectUIProvider 
      manifestUrl="https://db23b08d-08a2-4e7e-b648-6f394e9e12c2.lovableproject.com/tonconnect-manifest.json"
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;