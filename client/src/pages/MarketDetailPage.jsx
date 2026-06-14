import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Liveline } from 'liveline';
import { useSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';
import { MARKETS } from '../data/markets';
import { formatPrice, formatMarketPrice, formatPercent } from '../lib/utils';
import { usePriceFlash } from '../hooks/usePriceFlash';
import WalletGate from '../components/WalletGate';
import MarketIcon from '../components/MarketIcon';
import AgentFeed from '../components/AgentFeed';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { HUSDC_ADDRESS, HUSDC_ABI, VAULT_ADDRESS, VAULT_ABI } from '../config/contracts';

// Map market IDs to TradingView symbols
const TV_SYMBOLS = {
  bitcoin: 'BINANCE:BTCUSDT',
  ethereum: 'BINANCE:ETHUSDT',
  solana: 'BINANCE:SOLUSDT',
  gold: 'COINBASE:PAXGUSD',
  silver: 'KAGUSD',
  usd_inr: 'FX_IDC:USDINR',
  eur_usd: 'FX:EURUSD',
  gbp_usd: 'FX:GBPUSD',
};

function TradingViewChart({ marketId }) {
  const containerRef = useRef(null);
  const symbol = TV_SYMBOLS[marketId];

  useEffect(() => {
    if (!containerRef.current) return;
    // Clear previous widget
    containerRef.current.innerHTML = '';

    if (!symbol) {
      containerRef.current.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8B8BA8;font-size:11px;font-family:Geist,sans-serif">// CHART NOT AVAILABLE FOR THIS MARKET</div>';
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: '15',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#14141F',
      gridColor: '#262640',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: 'https://www.tradingview.com',
    });

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';

    containerRef.current.appendChild(widgetDiv);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, marketId]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
}

function NewToTradingHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 text-left text-xs font-medium text-[var(--t-text-muted)] hover:text-[var(--t-text)] flex items-center justify-between"
      >
        New to trading?
        <span className="text-[var(--t-blue)]">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-[11px] text-[var(--t-text-muted)] space-y-1.5 border-t border-[var(--t-border)] pt-2">
          <p><strong className="text-[var(--t-text)]">Long</strong> = you profit if the price goes up.</p>
          <p><strong className="text-[var(--t-text)]">Short</strong> = you profit if the price goes down.</p>
          <p><strong className="text-[var(--t-text)]">Margin</strong> = how much USDC you put up.</p>
          <p><strong className="text-[var(--t-text)]">Leverage</strong> = multiplies your trade size (5× means $100 controls $500).</p>
          <p><strong className="text-[var(--t-text)]">Auto-close price</strong> = if price hits this, your trade closes to limit loss.</p>
        </div>
      )}
    </div>
  );
}

export default function MarketDetailPage() {
  const { id } = useParams();
  const { prices } = useSocket();
  const api = useApi();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const market = MARKETS.find((m) => m.id === id);

  const [direction, setDirection] = useState('long');
  const [margin, setMargin] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [positions, setPositions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [depositing, setDepositing] = useState(false);
  const [traderBalance, setTraderBalance] = useState(null);
  const [chartData, setChartData] = useState([]); // Liveline: { time: unixSec, value: number }[]
  const [chartLoading, setChartLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { data: husdcBalance, refetch: refetchBalance } = useReadContract({
    address: HUSDC_ADDRESS,
    abi: HUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && HUSDC_ADDRESS !== 'YOUR_ADDRESS' },
  });

  const rawWalletBalance = husdcBalance ? parseFloat(formatUnits(husdcBalance, 6)) : 0;
  // Demo: cap displayed balance so testnet doesn't show trillion (audit P5)
  const walletBalance = rawWalletBalance > 100000 ? Math.min(rawWalletBalance, 50000) : rawWalletBalance;
  const isDemoBalance = rawWalletBalance > 100000;

  useEffect(() => {
    if (!address) return;
    api.get(`/api/user/${address}`).then((res) => {
      setTraderBalance(res.traderBalance ?? res.user?.traderBalance ?? 0);
    }).catch(() => {});
  }, [address]);

  const handleDeposit = async () => {
    if (!address) return;
    setDepositing(true);
    setError(null);
    try {
      const depositAmt = parseUnits('10000', 6);
      if (rawWalletBalance < 10000) {
        await writeContractAsync({
          address: HUSDC_ADDRESS, abi: HUSDC_ABI, functionName: 'faucet',
          args: [address, parseUnits('100000', 6)], gas: 100000n,
        });
      }
      await writeContractAsync({
        address: HUSDC_ADDRESS, abi: HUSDC_ABI, functionName: 'approve',
        args: [VAULT_ADDRESS, 2n ** 256n - 1n], gas: 60000n,
      });
      await writeContractAsync({
        address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'depositTrader',
        args: [depositAmt], gas: 150000n,
      });
      await refetchBalance();
      setTimeout(() => {
        api.get(`/api/user/${address}`).then((res) => {
          setTraderBalance(res.traderBalance ?? res.user?.traderBalance ?? 0);
        }).catch(() => {});
      }, 6000);
      setSuccessMsg('Deposited 10,000 USDY to vault!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err.shortMessage || err.message || 'Deposit failed');
    }
    setDepositing(false);
  };

  const priceData = prices[id];
  const currentPrice = priceData?.p;
  // When socket doesn't provide a live price (e.g. some real estate markets), use last chart point so user can still open a position
  const effectivePrice = currentPrice ?? (chartData?.length ? chartData[chartData.length - 1].value : null);
  const flashClass = usePriceFlash(currentPrice);
  const marginNum = parseFloat(margin) || 0;
  const size = marginNum * leverage;
  const fee = size * 0.001;

  // Fetch price history: for Liveline (non-TV markets) and for effectivePrice fallback when socket has no price (e.g. TV markets like Solana)
  useEffect(() => {
    const toUnixSec = (ts, fallback) => {
      if (ts != null) {
        if (typeof ts === 'number') return ts < 1e12 ? ts : ts / 1000;
        const ms = new Date(ts).getTime();
        if (Number.isFinite(ms)) return ms / 1000;
      }
      return fallback != null ? new Date(fallback).getTime() / 1000 : NaN;
    };
    if (!TV_SYMBOLS[id]) setChartLoading(true);
    api.get(`/api/markets/${id}/chart?timeframe=1m`)
      .then((res) => {
        const data = res.history || res.data || res;
        if (Array.isArray(data) && data.length > 0) {
          const sampled = data.length > 300
            ? data.filter((_, i) => i % Math.ceil(data.length / 300) === 0 || i === data.length - 1)
            : data;
          const points = sampled
            .map((h) => ({ time: toUnixSec(h.timestamp, h.date), value: Number(h.price) }))
            .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
            .sort((a, b) => a.time - b.time);
          setChartData(points);
        } else {
          setChartData([]);
        }
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [id]);

  // Load positions + auto-refresh every 10s
  useEffect(() => {
    if (!address) return;
    const fetchPositions = () => {
      api.get(`/api/trade/positions/${address}?marketId=${id}`)
        .then((res) => setPositions(res.positions || res))
        .catch(() => {});
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, [address, id]);

  const handleOpenPosition = () => {
    if (!address) {
      setError('Connect your wallet first');
      return;
    }
    if (marginNum <= 0) {
      setError('Enter an amount (USDC) to place your bet.');
      return;
    }
    if (!effectivePrice) {
      setError('Waiting for price — try again in a moment');
      return;
    }
    setError(null);
    setShowConfirmModal(true);
  };

  const doOpenPosition = async () => {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    setShowConfirmModal(false);
    try {
      const result = await api.post('/api/trade/open', {
        address, marketId: id, direction, margin: marginNum, leverage,
        tp: tpPrice ? parseFloat(tpPrice) : undefined,
        sl: slPrice ? parseFloat(slPrice) : undefined,
      });
      setPositions((prev) => [...prev, result.position || result]);
      setSuccessMsg('Position opened successfully');
      setMargin('');
      api.get(`/api/user/${address}`).then((res) => {
        setTraderBalance(res.traderBalance ?? res.user?.traderBalance ?? 0);
      }).catch(() => {});
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to open position');
    }
    setSubmitting(false);
  };

  const liqPrice = marginNum > 0 && effectivePrice
    ? direction === 'long'
      ? effectivePrice * (1 - 0.9 / leverage)
      : effectivePrice * (1 + 0.9 / leverage)
    : null;

  const handleClosePosition = async (positionId) => {
    try {
      await api.post('/api/trade/close', { positionId });
      setPositions((prev) => prev.filter((p) => (p._id || p.id) !== positionId));
      // Refresh balance
      api.get(`/api/user/${address}`).then((res) => {
        setTraderBalance(res.traderBalance ?? res.user?.traderBalance ?? 0);
      }).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close position');
    }
  };

  const hasTvChart = !!TV_SYMBOLS[id];

  if (!market) {
    return (
      <div className="t-panel p-8 text-center">
        <div className="text-[var(--t-text-muted)]">Market not found</div>
      </div>
    );
  }

  return (
    <WalletGate>
      <div className="font-sans">
        {/* Market Header */}
        <div className="flex items-center gap-3 mb-4">
          <MarketIcon market={market} className="w-8 h-8 text-[var(--t-text-muted)] shrink-0" />
          <div>
            <h1 className="text-lg font-bold uppercase tracking-[0.08em]">{market.name}</h1>
            <div className="text-xs text-[var(--t-text-muted)]">{market.description}</div>
          </div>
          <div className={`ml-auto text-right ${flashClass}`}>
            <div className="text-2xl font-bold">
              {effectivePrice != null ? formatMarketPrice(effectivePrice, market) : '---'}
            </div>
            {priceData?.c != null && (
              <div className={`text-xs ${priceData.c >= 0 ? 'text-[var(--t-blue)]' : 'text-[var(--t-red)]'}`}>
                {formatPercent(priceData.c)}
              </div>
            )}
          </div>
        </div>

        {/* Chart (2/3) + Order Panel (1/3) */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          {/* Chart — 2/3 width */}
          <div className="w-full lg:w-2/3 font-sans">
            <div className="t-panel p-0 overflow-hidden" style={{ height: hasTvChart ? 500 : 400 }}>
              {hasTvChart ? (
                <TradingViewChart marketId={id} />
              ) : (
                <div className="p-4 h-full flex flex-col">
                  <div className="t-panel-header mb-2 px-0 border-0 text-[0.6rem]">
                    Price chart — {market.category === 'real_estate' ? '5 year' : '30 day'}
                  </div>
                  <div className="flex-1 min-h-0">
                    <Liveline
                      data={chartData}
                      value={effectivePrice ?? 0}
                      theme="dark"
                      color="#A78BFA"
                      fill={false}
                      grid
                      badge
                      scrub
                      momentum
                      loading={chartLoading}
                      emptyText="No data to display"
                      window={chartData.length >= 2 ? Math.max(chartData[chartData.length - 1].time - chartData[0].time, 60) : 60}
                      formatValue={(v) => formatMarketPrice(v, market, market.category === 'real_estate' ? 0 : 2)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Panel — 1/3 width; relative + z-10 so it stays on top and receives clicks */}
          <div className="w-full lg:w-1/3 font-sans relative z-10">
            <div className="t-panel p-4">
              <div className="t-panel-header mb-3 px-0 border-0">Open a position</div>

              {/* New to trading? */}
              <NewToTradingHelp />

              {/* Direction */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setDirection('long')}
                  className={`t-btn flex-1 ${direction === 'long' ? 'bg-[var(--t-blue)] text-white border-[var(--t-blue)]' : 't-btn-ghost'}`}
                >Bet price goes up</button>
                <button
                  onClick={() => setDirection('short')}
                  className={`t-btn flex-1 ${direction === 'short' ? 'bg-[var(--t-red)] text-white border-[var(--t-red)]' : 't-btn-ghost'}`}
                >Bet price goes down</button>
              </div>

              {/* Balance */}
              <div className="mb-3 t-panel p-2 bg-[var(--t-bg)]">
                <div className="flex justify-between items-center text-[0.6rem]">
                  <span className="text-[var(--t-text-muted)] uppercase tracking-[0.08em]">Your wallet</span>
                  <span className="font-bold">{formatPrice(walletBalance)}{isDemoBalance ? ' (Testnet)' : ''}</span>
                </div>
                <div className="flex justify-between items-center text-[0.6rem] mt-0.5">
                  <span className="text-[var(--t-text-muted)] uppercase tracking-[0.08em]">Available to trade</span>
                  <span className="font-bold text-[var(--t-blue)]">
                    {traderBalance != null ? formatPrice(traderBalance) : '---'}
                  </span>
                </div>
                {(traderBalance == null || traderBalance < 10) && (
                  <button onClick={handleDeposit} disabled={depositing}
                    className="t-btn t-btn-ghost w-full mt-1.5 text-[0.55rem] py-1">
                    {depositing ? 'Adding funds…' : 'Get test USDC and add to trading balance'}
                  </button>
                )}
              </div>

              {/* Margin */}
              <div className="mb-3">
                <label className="t-label mb-1 block">Amount to use (USDC)</label>
                <input type="number" value={margin} onChange={(e) => setMargin(e.target.value)}
                  placeholder="0.00" className="t-input" min="0" />
              </div>

              {/* Leverage */}
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <label className="t-label">Multiplier</label>
                  <span className="text-xs text-[var(--t-blue)] font-bold">{leverage}x</span>
                </div>
                <input type="range" min="1" max="50" value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-[var(--t-blue)]" />
                <div className="flex justify-between text-[0.5rem] text-[var(--t-text-dim)]">
                  <span>1x</span><span>25x</span><span>50x</span>
                </div>
              </div>

              {/* Size */}
              <div className="flex justify-between text-[0.65rem] mb-2">
                <span className="text-[var(--t-text-muted)]">Trade size</span>
                <span className="font-bold">{formatPrice(size)}</span>
              </div>

              {/* TP/SL */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="t-label mb-1 block text-[0.55rem]">Take profit (optional)</label>
                  <input type="number" value={tpPrice} onChange={(e) => setTpPrice(e.target.value)}
                    placeholder="e.g. 110000" className="t-input text-xs" />
                </div>
                <div>
                  <label className="t-label mb-1 block text-[0.55rem]">Stop loss (optional)</label>
                  <input type="number" value={slPrice} onChange={(e) => setSlPrice(e.target.value)}
                    placeholder="Optional" className="t-input text-xs" />
                </div>
              </div>

              {/* Fees */}
              <div className="border-t border-[var(--t-border)] pt-2 mb-3">
                <div className="flex justify-between text-[0.6rem] text-[var(--t-text-muted)] mb-0.5">
                  <span>Trading fee (0.1%)</span>
                  <span>{formatPrice(fee)}</span>
                </div>
                <div className="flex justify-between text-[0.6rem] text-[var(--t-text-muted)]">
                  <span>Auto-close price</span>
                  <span>
                    {marginNum > 0 && effectivePrice
                      ? formatPrice(direction === 'long'
                          ? effectivePrice * (1 - 0.9 / leverage)
                          : effectivePrice * (1 + 0.9 / leverage))
                      : '---'}
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded border border-[var(--t-red)]/50 bg-[var(--t-red)]/10 text-[var(--t-red)] text-xs px-3 py-2 mb-3">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="rounded border border-[var(--t-green)]/50 bg-[var(--t-green)]/10 text-[var(--t-green)] text-xs px-3 py-2 mb-3 font-medium">
                  {successMsg}
                </div>
              )}

              {/* Confirm open position modal (audit P6) */}
              {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowConfirmModal(false)}>
                  <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-bg-secondary)] p-5 shadow-xl max-w-sm w-full font-sans" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-sm font-bold text-[var(--t-text)] mb-3">Confirm position</h3>
                    <p className="text-xs text-[var(--t-text-muted)] mb-3">
                      You&apos;re placing a bet that {market.name} will go {direction === 'long' ? 'up' : 'down'}. You&apos;re using {formatPrice(marginNum)} with a {leverage}× multiplier (trade size: {formatPrice(size)}).
                      {liqPrice != null && (
                        <span className="block mt-2"> If price moves to {formatMarketPrice(liqPrice, market)}, your position will be closed automatically to limit loss.</span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowConfirmModal(false)} className="flex-1 py-2 rounded-lg border border-[var(--t-border)] text-sm font-medium text-[var(--t-text)]">Cancel</button>
                      <button type="button" onClick={doOpenPosition} disabled={submitting} className="flex-1 py-2 rounded-lg bg-[var(--t-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-70">
                        {submitting ? 'Opening…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenPosition}
                disabled={submitting}
                className={`t-btn w-full py-3 flex items-center justify-center gap-2 transition-opacity cursor-pointer ${
                  submitting ? 'opacity-90 cursor-wait' : ''
                } ${direction === 'long'
                  ? 'bg-[var(--t-blue)] text-white border-[var(--t-blue)]'
                  : 'bg-[var(--t-red)] text-white border-[var(--t-red)]'}`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                    <span>Opening {direction} position…</span>
                  </>
                ) : (
                  direction === 'long' ? 'Place bet (price goes up)' : 'Place bet (price goes down)'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Positions Table — full width below */}
        {positions.length > 0 && (
          <div className="t-panel font-sans">
            <div className="t-panel-header">Open positions</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--t-border)]">
                    <th className="text-left px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Bet</th>
                    <th className="text-right px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Amount used</th>
                    <th className="text-right px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Multiplier</th>
                    <th className="text-right px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Entry price</th>
                    <th className="text-right px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Current price</th>
                    <th className="text-right px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Profit or loss</th>
                    <th className="text-right px-3 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const posId = pos._id || pos.id;
                    const entry = pos.entryPrice;
                    const posSize = pos.size || pos.margin * pos.leverage;
                    const isLong = pos.direction?.toUpperCase() === 'LONG';
                    const pnl = effectivePrice && entry
                      ? isLong
                        ? ((effectivePrice - entry) / entry) * posSize
                        : ((entry - effectivePrice) / entry) * posSize
                      : (pos.unrealizedPnl ?? 0);

                    return (
                      <tr key={posId} className="border-b border-[var(--t-border)] last:border-0">
                        <td className="px-3 py-2">
                          <span className={`t-tag ${isLong ? 't-tag-green' : 't-tag-red'}`}>
                            {isLong ? 'Up' : 'Down'}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">{formatPrice(pos.margin)}</td>
                        <td className="text-right px-3 py-2">{pos.leverage}x</td>
                        <td className="text-right px-3 py-2">{formatMarketPrice(entry, market)}</td>
                        <td className="text-right px-3 py-2">{effectivePrice != null ? formatMarketPrice(effectivePrice, market) : '---'}</td>
                        <td className={`text-right px-3 py-2 font-medium ${pnl >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'}`}>
                          {pnl >= 0 ? '+' : ''}{formatPrice(pnl)}
                        </td>
                        <td className="text-right px-3 py-2">
                          <button onClick={() => handleClosePosition(posId)}
                            className="t-btn t-btn-ghost text-[0.55rem] py-1 px-2 border-[var(--t-red)] text-[var(--t-red)] hover:bg-[var(--t-red)] hover:text-white">
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Your agents on this asset — populated by AgentSessionKey + AgentAction backend */}
        <div className="mt-6">
          <AgentFeed asset={id} title={`Your agents on ${market.name}`} />
        </div>
      </div>
    </WalletGate>
  );
}
