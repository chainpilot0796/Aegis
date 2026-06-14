import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';
import { HUSDC_ADDRESS, HUSDC_ABI, VAULT_ADDRESS, VAULT_ABI } from '../config/contracts';
import { formatPrice, formatNumber } from '../lib/utils';
import WalletGate from '../components/WalletGate';
import HelpTooltip from '../components/ui/HelpTooltip';

export default function VaultPage() {
  const { address } = useAccount();
  const { vaultStats } = useSocket();
  const api = useApi();
  const { writeContractAsync } = useWriteContract();

  const [action, setAction] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [serverStats, setServerStats] = useState(null);

  // Read on-chain USDY balance
  const { data: husdcBalance, refetch: refetchBalance } = useReadContract({
    address: HUSDC_ADDRESS,
    abi: HUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && HUSDC_ADDRESS !== 'YOUR_ADDRESS' },
  });

  const walletBalance = husdcBalance ? parseFloat(formatUnits(husdcBalance, 6)) : 0;

  // Fetch user info and vault stats from backend
  const fetchData = useCallback(() => {
    if (!address) return;
    api.get(`/api/user/${address}`).then((res) => {
      setUserInfo(res.user || res);
    }).catch(() => {});
    api.get('/api/vault/stats').then((res) => {
      setServerStats(res.stats || res);
    }).catch(() => {});
  }, [address]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = {
    totalLpDeposits: serverStats?.totalLpDeposits ?? vaultStats?.totalLpDeposits ?? 0,
    totalTraderDeposits: serverStats?.totalTraderDeposits ?? vaultStats?.totalTraderDeposits ?? 0,
    totalFeesCollected: serverStats?.totalFeesCollected ?? vaultStats?.totalFeesCollected ?? 0,
    utilizationRate: serverStats?.utilizationRate ?? vaultStats?.utilizationRate ?? 0,
    currentEpoch: serverStats?.currentEpoch ?? vaultStats?.currentEpoch ?? 1,
  };

  const tvl = stats.totalLpDeposits + stats.totalTraderDeposits;
  const myLpBalance = userInfo?.lpBalance ?? 0;
  const myTraderBalance = userInfo?.traderBalance ?? 0;
  const lpSharePrice = stats.totalLpDeposits > 0
    ? ((stats.totalLpDeposits + stats.totalFeesCollected) / stats.totalLpDeposits).toFixed(4)
    : '1.0000';

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!address || !amountNum || amountNum <= 0) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amountWei = parseUnits(String(amountNum), 6);

      if (action === 'deposit') {
        // Faucet if wallet balance is low
        if (walletBalance < amountNum) {
          const faucetAmount = parseUnits(String(Math.min(amountNum * 2, 1000000)), 6);
          await writeContractAsync({
            address: HUSDC_ADDRESS,
            abi: HUSDC_ABI,
            functionName: 'faucet',
            args: [address, faucetAmount],
            gas: 100000n,
          });
        }

        // Approve (max so we don't need to approve again)
        await writeContractAsync({
          address: HUSDC_ADDRESS,
          abi: HUSDC_ABI,
          functionName: 'approve',
          args: [VAULT_ADDRESS, 2n ** 256n - 1n],
          gas: 60000n,
        });

        // Deposit LP on-chain
        await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'depositLp',
          args: [amountWei],
          gas: 150000n,
        });

        // Notify backend
        await api.post('/api/vault/deposit', { address, amount: amountNum }).catch(() => {});

        setSuccess(`Deposited ${formatPrice(amountNum)} as LP`);
      } else {
        // Withdraw — request via backend
        if (myLpBalance < amountNum) {
          throw new Error(`Insufficient LP balance. You have ${formatPrice(myLpBalance)}`);
        }

        // Request withdrawal on-chain
        await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'requestLpWithdrawal',
          args: [amountWei],
          gas: 100000n,
        });

        await api.post('/api/vault/withdraw', { address, amount: amountNum }).catch(() => {});

        setSuccess(`Withdrawal of ${formatPrice(amountNum)} requested. Processed next epoch.`);
      }

      setAmount('');
      await refetchBalance();

      // Refresh data after chain service picks up events
      setTimeout(fetchData, 3000);
      setTimeout(fetchData, 7000);
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed');
    }
    setLoading(false);
  };

  return (
    <WalletGate>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="t-section text-xl font-bold uppercase tracking-[0.1em]">
            Vault
          </h1>
          <p className="text-xs text-[var(--t-text-muted)] mt-1">
            Add funds here to earn a share of trading fees from the platform.
          </p>
        </div>

        {/* Estimated vault APY */}
        <div className="rounded-xl border-2 border-[var(--t-blue)]/30 bg-[var(--t-bg-secondary)] p-4 mb-6">
          <div className="text-xs text-[var(--t-text-muted)] mb-1 flex items-center gap-1">
            Estimated annual return <HelpTooltip text="Roughly how much you could earn per year from your share of trading fees. Depends on how much people trade." />
          </div>
          <div className="text-2xl font-bold text-[var(--t-blue)]">~3–8%</div>
          <p className="text-xs text-[var(--t-text-muted)] mt-1">Trading fees + shield activity. Varies with volume.</p>
        </div>

        {/* Vault TVL Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="t-stat">
            <div className="t-stat-label flex items-center gap-1">Total deposited <HelpTooltip text="How much money everyone has added to the vault in total." /></div>
            <div className="t-stat-value text-base text-[var(--t-green)]">
              {formatPrice(tvl)}
            </div>
          </div>
          <div className="t-stat">
            <div className="t-stat-label">Provider deposits</div>
            <div className="t-stat-value text-base">
              {formatPrice(stats.totalLpDeposits)}
            </div>
          </div>
          <div className="t-stat">
            <div className="t-stat-label">Pool in use</div>
            <div className="t-stat-value text-base text-[var(--t-gold)]">
              {formatNumber(stats.utilizationRate)}%
            </div>
          </div>
          <div className="t-stat">
            <div className="t-stat-label">Fees earned (all time)</div>
            <div className="t-stat-value text-base text-[var(--t-blue)]">
              {formatPrice(stats.totalFeesCollected)}
            </div>
          </div>
        </div>

        {/* Your Position */}
        {address && (
          <div className="t-panel t-panel-green p-4 mb-6">
            <div className="t-panel-header mb-3 px-0 border-0 text-[var(--t-green)]">
              Your position
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem] mb-1">
                  Your USDC balance
                </div>
                <div className="font-bold text-sm">{formatPrice(walletBalance)}</div>
              </div>
              <div>
                <div className="text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem] mb-1">
                  Your vault deposit
                </div>
                <div className="font-bold text-sm text-[var(--t-green)]">{formatPrice(myLpBalance)}</div>
              </div>
              <div>
                <div className="text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem] mb-1">
                  Active trading pool
                </div>
                <div className="font-bold text-sm">{formatPrice(myTraderBalance)}</div>
              </div>
              <div>
                <div className="text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem] mb-1">
                  Your return so far
                </div>
                <div className="font-bold text-sm text-[var(--t-blue)]">
                  ${lpSharePrice} <span className="text-[0.6rem] font-normal">(started at $1.00)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Deposit/Withdraw Panel */}
          <div className="t-panel p-4">
            <div className="t-panel-header mb-4 px-0 border-0">
              Deposit or withdraw
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setAction('deposit'); setError(null); setSuccess(null); }}
                className={`t-btn flex-1 ${action === 'deposit' ? 't-btn-primary' : 't-btn-ghost'}`}
              >
                Add funds
              </button>
              <button
                onClick={() => { setAction('withdraw'); setError(null); setSuccess(null); }}
                className={`t-btn flex-1 ${action === 'withdraw' ? 't-btn-primary' : 't-btn-ghost'}`}
              >
                Withdraw
              </button>
            </div>

            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <label className="t-label">
                  {action === 'deposit' ? 'Amount to add' : 'Amount to withdraw'}
                </label>
                <button
                  onClick={() => setAmount(String(action === 'deposit' ? walletBalance : myLpBalance))}
                  className="text-[0.55rem] text-[var(--t-green)] uppercase tracking-[0.1em] hover:underline"
                >
                  MAX: {formatPrice(action === 'deposit' ? walletBalance : myLpBalance)}
                </button>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00 USDC"
                className="t-input text-lg"
                min="0"
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 mb-4">
              {[100, 1000, 5000, 10000].map((qa) => (
                <button
                  key={qa}
                  onClick={() => setAmount(String(qa))}
                  className={`t-btn text-[0.55rem] flex-1 ${amount === String(qa) ? 't-btn-primary' : 't-btn-ghost'}`}
                >
                  ${qa >= 1000 ? `${qa / 1000}K` : qa}
                </button>
              ))}
            </div>

            {error && (
              <div className="text-xs text-[var(--t-red)] mb-3">// {error}</div>
            )}
            {success && (
              <div className="text-xs text-[var(--t-green)] mb-3">// {success}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !parseFloat(amount)}
              className="t-btn t-btn-primary w-full py-3"
            >
              {loading
                ? 'Processing…'
                : action === 'deposit'
                  ? `Add ${parseFloat(amount) ? formatPrice(parseFloat(amount)) : ''} USDC`
                  : 'Request withdrawal'}
            </button>

            <div className="mt-3 text-[0.55rem] text-[var(--t-text-dim)]">
              {action === 'deposit'
                ? 'Deposits earn a share of trading fees. We may add test USDC if your balance is low.'
                : 'Withdrawals are processed within 7 days (next cycle).'}
            </div>
          </div>

          {/* Epoch Info */}
          <div className="t-panel p-4">
            <div className="t-panel-header mb-4 px-0 border-0">
              Vault status
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--t-text-muted)] uppercase tracking-[0.1em]">
                  Cycle
                </span>
                <span className="text-lg font-bold text-[var(--t-green)]">
                  #{stats.currentEpoch || 1}
                </span>
              </div>

              <div className="border-t border-[var(--t-border)] pt-4">
                <div className="text-[0.6rem] text-[var(--t-text-dim)] mb-3">
                  Withdrawals process weekly (7-day cycle).
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--t-text-muted)]">Status</span>
                    <span className="t-tag t-tag-green">Active ✓</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t-text-muted)]">Share value</span>
                    <span className="font-bold">${lpSharePrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t-text-muted)]">Your deposit</span>
                    <span className="font-bold text-[var(--t-green)]">{formatPrice(myLpBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t-text-muted)]">Available to withdraw</span>
                    <span className="font-bold">{formatPrice(myLpBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--t-border)] pt-4">
                <div className="text-[0.6rem] text-[var(--t-text-dim)] mb-2 font-semibold">
                  How it works
                </div>
                <div className="text-[0.65rem] text-[var(--t-text-muted)] space-y-1.5">
                  <p>1. Deposit USDC into the vault</p>
                  <p>2. Your deposit backs trades and shields on the platform</p>
                  <p>3. You earn a share of fees from every trade</p>
                  <p>4. Withdraw anytime — processed within 7 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WalletGate>
  );
}
