import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import { config } from './config/wagmi';
import { AppProvider } from './context/AppContext';

import Noise from './components/ui/Noise';
import RootLayout from './components/layout/RootLayout';
import LandingPage from './pages/LandingPage';
import YieldShieldPage from './pages/YieldShieldPage';
import MarketsPage from './pages/MarketsPage';
import MarketDetailPage from './pages/MarketDetailPage';
import VaultPage from './pages/VaultPage';
import PortfolioPage from './pages/PortfolioPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AgentsPage from './pages/AgentsPage';

const queryClient = new QueryClient();

const customTheme = lightTheme({
  accentColor: '#A78BFA',
  accentColorForeground: '#07070C',
  borderRadius: 'none',
  fontStack: 'system',
});

// Override for white + electric blue scheme
customTheme.colors.modalBackground        = '#14141F';
customTheme.colors.profileForeground      = '#1C1C29'; // was #001A66 (dark navy) — fixed
customTheme.colors.modalText              = '#E8E8F0';
customTheme.colors.modalTextSecondary     = '#A78BFA';
customTheme.colors.modalBorder            = '#262640';
customTheme.colors.actionButtonBorder     = '#A78BFA';
customTheme.colors.actionButtonBorderMobile = '#A78BFA';
customTheme.colors.actionButtonSecondaryBackground = '#1C1C29';
customTheme.colors.closeButton            = '#A78BFA';
customTheme.colors.closeButtonBackground  = '#1C1C29';
customTheme.colors.menuItemBackground     = '#1C1C29';
customTheme.fonts.body = "'Geist', ui-sans-serif, system-ui, sans-serif";

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          <AppProvider>
            <BrowserRouter>
              <div style={{ position: 'relative', minHeight: '100vh' }}>
                <Noise
                  patternAlpha={12}
                  patternRefreshInterval={3}
                  style={{ position: 'fixed', inset: 0, zIndex: 0 }}
                />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/app" element={<RootLayout />}>
                      <Route index element={<Navigate to="/app/shield" replace />} />
                      <Route path="shield" element={<YieldShieldPage />} />
                      <Route path="markets" element={<MarketsPage />} />
                      <Route path="trade/:id" element={<MarketDetailPage />} />
                      <Route path="vault" element={<VaultPage />} />
                      <Route path="portfolio" element={<PortfolioPage />} />
                      <Route path="leaderboard" element={<LeaderboardPage />} />
                      <Route path="agents" element={<AgentsPage />} />
                    </Route>
                  </Routes>
                </div>
              </div>
            </BrowserRouter>
          </AppProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
