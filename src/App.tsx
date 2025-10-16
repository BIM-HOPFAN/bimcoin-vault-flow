import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TonConnectProvider from "./components/TonConnectProvider";
import { useTelegramWebApp } from "./utils/telegram";
import Index from "./pages/Index";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Whitepaper from "./pages/Whitepaper";
import NotFound from "./pages/NotFound";

const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const TelegramInit = ({ children }: { children: React.ReactNode }) => {
  const { initTelegram, isAvailable } = useTelegramWebApp();

  useEffect(() => {
    if (isAvailable) {
      initTelegram();
      console.log('Telegram Mini App initialized');
    }
  }, [isAvailable, initTelegram]);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TonConnectProvider>
      <TelegramInit>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <Routes>
              <Route path="/" element={<Index />} />
              <Route 
                path="/admin" 
                element={
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Admin...</div>}>
                    <Admin />
                  </Suspense>
                } 
              />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/whitepaper" element={<Whitepaper />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TelegramInit>
    </TonConnectProvider>
  </QueryClientProvider>
);

export default App;
