import { useState } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  usePublicClient,
} from 'wagmi';
import { parseUnits } from 'viem';
import { USDY_ADDRESS, USDY_ABI, USDY_DECIMALS, CHAIN_ID } from '../config/contracts';

// Amount of test USDY minted to the user per click (faucet cap is 1,000,000).
const FAUCET_AMOUNT = '10000';

/**
 * Mints test USDY to the user's wallet via the on-chain faucet, then registers
 * the token in the wallet (MetaMask et al.) via EIP-747 so the balance shows up.
 *
 * - Switches to the AEGIS chain (Mantle) first so the faucet tx + token row land
 *   on the chain where USDY actually lives.
 * - Calls MockRWAToken.faucet(to, amount) so the user receives real on-chain
 *   USDY they can deposit into a shield (gas paid in MNT).
 * - Then wallet_watchAsset so the token + balance appear in the wallet UI.
 */
export default function AddTokenButton({
  className = '',
  label = 'Get test USDY',
  variant = 'default', // 'default' | 'compact'
}) {
  const { address, connector, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
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

      // Mint test USDY to the connected wallet via the on-chain faucet.
      if (!address) throw new Error('Connect a wallet first');
      const amount = parseUnits(FAUCET_AMOUNT, USDY_DECIMALS);
      const faucetHash = await writeContractAsync({
        address: USDY_ADDRESS,
        abi: USDY_ABI,
        functionName: 'faucet',
        args: [address, amount],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: faucetHash, timeout: 60_000 });
      }

      // Register the token so the wallet shows the new balance.
      const params = {
        type: 'ERC20',
        options: {
          address: USDY_ADDRESS,
          symbol: 'USDY',
          decimals: USDY_DECIMALS,
        },
      };
      if (tokenImage) params.options.image = tokenImage;

      // Best-effort: the mint already succeeded, so a dismissed watch prompt
      // is not an error — the user has the USDY either way.
      try {
        await provider.request({ method: 'wallet_watchAsset', params });
      } catch (_) {}
      setState('added');
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
    state === 'adding' ? 'Minting…' :
    state === 'added' ? `✓ ${Number(FAUCET_AMOUNT).toLocaleString()} USDY sent` :
    state === 'error' ? 'Retry' :
    label;

  return (
    <button
      type="button"
      onClick={add}
      disabled={state === 'adding'}
      className={baseCls + ' ' + className}
      title={err || `Mints ${Number(FAUCET_AMOUNT).toLocaleString()} test USDY (on Mantle) to your connected wallet`}
    >
      {state === 'adding' && <span className="shield-loader w-3 h-3" />}
      {display}
    </button>
  );
}
