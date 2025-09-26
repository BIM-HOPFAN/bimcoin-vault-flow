// Telegram Mini App Integration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        themeParams: {
          bg_color: string;
          text_color: string;
          hint_color: string;
          link_color: string;
          button_color: string;
          button_text_color: string;
        };
      };
    };
  }
}

export const useTelegramWebApp = () => {
  const tg = window.Telegram?.WebApp;
  
  const initTelegram = () => {
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Apply Telegram theme
      const themeParams = tg.themeParams;
      if (themeParams) {
        document.documentElement.style.setProperty('--tg-bg-color', themeParams.bg_color);
        document.documentElement.style.setProperty('--tg-text-color', themeParams.text_color);
        document.documentElement.style.setProperty('--tg-button-color', themeParams.button_color);
      }
    }
  };

  const getUserData = () => {
    return tg?.initDataUnsafe?.user || null;
  };

  const showMainButton = (text: string, onClick: () => void) => {
    if (tg?.MainButton) {
      tg.MainButton.text = text;
      tg.MainButton.onClick(onClick);
      tg.MainButton.show();
    }
  };

  const hideMainButton = () => {
    tg?.MainButton.hide();
  };

  const closeMiniApp = () => {
    tg?.close();
  };

  return {
    initTelegram,
    getUserData,
    showMainButton,
    hideMainButton,
    closeMiniApp,
    isAvailable: !!tg
  };
};