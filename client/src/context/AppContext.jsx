import { createContext, useContext, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { HUSDC_ADDRESS } from '../config/contracts';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({
    address,
    token: HUSDC_ADDRESS && HUSDC_ADDRESS !== 'YOUR_ADDRESS' ? HUSDC_ADDRESS : undefined,
    enabled: isConnected,
  });

  const value = useMemo(
    () => ({
      address,
      isConnected,
      balance: balanceData?.formatted ?? '0',
      balanceRaw: balanceData?.value ?? 0n,
      apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    }),
    [address, isConnected, balanceData]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
