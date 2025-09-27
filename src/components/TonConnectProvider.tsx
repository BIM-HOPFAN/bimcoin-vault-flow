import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

interface TonConnectProviderProps {
  children: ReactNode;
}

const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
  const manifestUrl = 'https://bimlight.lovable.app/tonconnect-manifest.json';
  
  console.log('TonConnect manifest URL:', manifestUrl);
  
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;