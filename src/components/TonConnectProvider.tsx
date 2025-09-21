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
      walletsListConfiguration={{
        includeWallets: [
          {
            appName: "tonkeeper",
            name: "Tonkeeper",
            imageUrl: "https://tonkeeper.com/assets/tonconnect-icon.png",
            aboutUrl: "https://tonkeeper.com",
            universalLink: "https://app.tonkeeper.com/ton-connect",
            bridgeUrl: "https://bridge.tonapi.io/bridge",
            platforms: ["ios", "android", "chrome", "firefox"]
          },
          {
            appName: "mytonwallet",
            name: "MyTonWallet", 
            imageUrl: "https://static.mytonwallet.io/icon-256.png",
            aboutUrl: "https://mytonwallet.io",
            universalLink: "https://connect.mytonwallet.org",
            bridgeUrl: "https://tonconnectbridge.mytonwallet.org/bridge/",
            platforms: ["ios", "android", "chrome", "firefox", "safari"]
          }
        ]
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
};

export default TonConnectProvider;