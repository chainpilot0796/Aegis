import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { USDY_ADDRESS, USDY_DECIMALS, CHAIN_ID } from '../config/contracts';

/**
 * Adds the USDY token to the user's wallet (MetaMask et al.) via EIP-747.
 *
 * - Sends a tokenImage URL pointing at the dapp's own /aegis-mark.svg so MetaMask
 *   shows the project logo on the asset row.
 * - If the wallet is on a different chain than the configured AEGIS chain, asks
 *   the wallet to switch first; the token row only resolves a balance on the
 *   chain where USDY actually lives.
 * - Falls back gracefully if the wallet doesn't support wallet_watchAsset.
 */
export default function AddTokenButton({
  className = '',
  label = 'Add USDY to wallet',
  variant = 'default', // 'default' | 'compact'
}) {
  const { connector, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [state, setState] = useState('idle'); // idle | adding | added | error
  const [err, setErr] = useState('');

  const tokenImage =
    typeof window !== 'undefined'
      ? `${window.location.origin}/aegis-mark.svg`
      : null;

  const add = async () => {
    if (!USDY_ADDRESS) {
      setErr('USDY address not configured');
      setState('error');
      return;
    }
    setState('adding');
    setErr('');
    try {
      let provider = null;
      try {
        if (connector?.getProvider) provider = await connector.getProvider();
      } catch (_) {}
      if (!provider && typeof window !== 'undefined') provider = window.ethereum;
      if (!provider?.request) throw new Error('No EIP-1193 wallet provider available');

      // Best-effort: switch to the dapp's configured chain first so the token
      // row resolves a balance immediately.
      if (currentChainId && CHAIN_ID && currentChainId !== CHAIN_ID) {
        try {
          if (switchChainAsync) {
            await switchChainAsync({ chainId: CHAIN_ID });
          } else {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
            });
          }
        } catch (switchErr) {
          // Non-fatal — user may have rejected. Continue and let MetaMask
          // surface "add on wrong chain" naturally.
        }
      }

      const params = {
        type: 'ERC20',
        options: {
          address: USDY_ADDRESS,
          symbol: 'USDY',
          decimals: USDY_DECIMALS,
        },
      };
      if (tokenImage) params.options.image = tokenImage;

      const result = await provider.request({
        method: 'wallet_watchAsset',
        params,
      });
      setState(result ? 'added' : 'idle');
    } catch (e) {
      setErr(e?.shortMessage || e?.message || 'Failed to add token');
      setState('error');
    }
  };

  if (!isConnected) return null;

  const compact = variant === 'compact';
  const baseCls = compact
    ? 'inline-flex items-center gap-1 rounded-md border border-[var(--t-border)] bg-transparent px-2 py-1 text-[10px] font-medium text-[var(--t-text-muted)] hover:border-[var(--t-violet)] hover:text-[var(--t-violet)] transition-colors disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-panel)] px-3 py-1.5 text-xs font-medium text-[var(--t-text)] hover:border-[var(--t-violet)] hover:text-[var(--t-violet)] transition-colors disabled:opacity-50';

  const display =
    state === 'added' ? '✓ USDY added' :
    state === 'error' ? 'Retry add' :
    label;

  return (
    <button
      type="button"
      onClick={add}
      disabled={state === 'adding'}
      className={baseCls + ' ' + className}
      title={err || 'Adds USDY (on Mantle) to MetaMask / your connected wallet'}
    >
      {state === 'adding' && <span className="shield-loader w-3 h-3" />}
      {display}
    </button>
  );
}
