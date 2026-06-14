import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletGate({ children }) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="t-panel p-8 text-center max-w-md">
          <div className="text-[var(--t-text-muted)] text-xs mb-4">
            You need to connect a wallet to use this page.
          </div>
          <h2 className="text-lg font-bold text-[var(--t-text)] mb-2">
            Connect your wallet
          </h2>
          <p className="text-[var(--t-text-muted)] text-xs mb-6">
            Use MetaMask, Coinbase Wallet, or any supported wallet to sign in. No sign‑up required.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => {
              if (!mounted) return null;
              return (
                <button
                  onClick={openConnectModal}
                  className="t-btn t-btn-primary hedge-pulse"
                >
                  Connect wallet
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
        <p className="text-[0.55rem] text-[var(--t-text-dim)]">
          Works with MetaMask, Coinbase Wallet, and other compatible wallets.
        </p>
      </div>
    );
  }

  return children;
}
