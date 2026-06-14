import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useApi } from '../hooks/useApi';
import { useSocket } from '../hooks/useSocket';
import { useCountdown } from '../hooks/useCountdown';
import { MARKETS } from '../data/markets';
import { formatPrice, formatPercent, formatDuration } from '../lib/utils';
import WalletGate from '../components/WalletGate';
import MarketIcon from '../components/MarketIcon';
import AddTokenButton from '../components/AddTokenButton';

function ShieldRow({ shield, prices, onSettle }) {
  const market = MARKETS.find((m) => m.id === shield.asset);
  const livePrice = prices[shield.asset]?.price;
  const entryPrice = shield.entryPrice;
  const exposure = shield.exposureBudget || 0;

  // PnL is mark-to-market of the *yield-derived exposure budget*, NEVER the
  // principal. Clamp to ±exposure so a degenerate stored entryPrice (e.g.
  // 1.0 from an earlier run before the price feed was live) can't surface as a
  // fantasy return. Skip mark-to-market entirely if entryPrice looks bogus.
  const ENTRY_PRICE_FLOOR = 0.5; // any asset below $0.50 is invalid for our universe
  let pnl;
  if (livePrice && entryPrice && entryPrice >= ENTRY_PRICE_FLOOR) {
    const raw = ((livePrice - entryPrice) / entryPrice) * exposure;
    pnl = Math.max(-exposure, Math.min(exposure, raw));
  } else {
    pnl = shield.positionId?.unrealizedPnl ?? 0;
  }

  const deposit = shield.depositAmount || 0;
  const pnlPct = deposit > 0 ? (pnl / deposit) * 100 : 0;

  const expiryTs = shield.settleAt ? new Date(shield.settleAt).getTime() : null;
  const countdown = useCountdown(expiryTs);

  return (
    <tr className="border-b border-[var(--t-border)] last:border-0 hover:bg-[var(--t-bg-secondary)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <MarketIcon market={market || { id: shield.asset, category: 'commodities' }} className="w-4 h-4 text-[var(--t-text-muted)] shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wide">{market?.name || shield.assetName || shield.asset}</span>
          <span className="text-[0.55rem] font-medium text-[var(--t-blue)] bg-[var(--t-blue)]/10 px-1.5 py-0.5 rounded">
            Deposit: Protected ✓
          </span>
        </div>
      </td>
      <td className="text-right px-4 py-3 text-xs tabular-nums">{formatPrice(shield.depositAmount)}</td>
      <td className="text-right px-4 py-3 text-xs tabular-nums text-[var(--t-gold)]" title="Yield earned so far tracking this asset. Your deposit is separate and always protected.">
        {formatPrice(shield.exposureBudget)}
      </td>
      <td
        className={`text-right px-4 py-3 text-xs font-medium tabular-nums ${
          pnl >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'
        }`}
      >
        {formatPrice(pnl)} <span className="text-[0.6rem] font-normal opacity-90">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(3)}%)</span>
      </td>
      <td className="text-right px-4 py-3 text-[0.65rem] text-[var(--t-text-muted)] tabular-nums" title={countdown.expired ? '' : 'When the period ends, your deposit + any gains are returned automatically.'}>
        {countdown.expired ? (
          <span className="t-tag t-tag-gold">Ended</span>
        ) : (
          countdown.formatted
        )}
      </td>
      <td className="text-right px-4 py-3">
        {countdown.expired ? (
          <button
            onClick={() => onSettle(shield._id || shield.id)}
            className="t-btn t-btn-primary text-[0.6rem] py-1 px-3"
          >
            Collect
          </button>
        ) : (
          <button
            onClick={() => onSettle(shield._id || shield.id)}
            className="t-btn t-btn-ghost text-[0.6rem] py-1 px-3 opacity-60 hover:opacity-100"
            title="Close early: you'll receive your deposit + yield earned so far. Any asset gains/losses settled at current price."
          >
            Close early
          </button>
        )}
      </td>
    </tr>
  );
}

function TradeRow({ position, prices, onClose }) {
  const market = MARKETS.find((m) => m.id === position.marketId);
  const livePrice = prices[position.marketId]?.price;
  const entryPrice = position.entryPrice;
  const posSize = position.size || position.margin * position.leverage;

  // Prefer live price for PnL; fall back to server-computed unrealizedPnl
  const pnl = livePrice && entryPrice
    ? position.direction?.toUpperCase() === 'LONG'
      ? ((livePrice - entryPrice) / entryPrice) * posSize
      : ((entryPrice - livePrice) / entryPrice) * posSize
    : (position.unrealizedPnl ?? 0);

  const marginVal = position.margin || 0;
  const pnlPct = marginVal > 0 ? (pnl / marginVal) * 100 : 0;

  return (
    <tr className="border-b border-[var(--t-border)] last:border-0 hover:bg-[var(--t-bg-secondary)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <MarketIcon market={market || { id: position.marketId, category: 'crypto' }} className="w-4 h-4 text-[var(--t-text-muted)] shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wide">{market?.name || position.marketId}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`t-tag ${
            position.direction?.toUpperCase() === 'LONG' ? 't-tag-green' : 't-tag-red'
          }`}
        >
          {position.direction?.toUpperCase() === 'LONG' ? 'Up' : 'Down'}
        </span>
      </td>
      <td className="text-right px-4 py-3 text-xs tabular-nums">{formatPrice(position.margin)}</td>
      <td className="text-right px-4 py-3 text-xs tabular-nums">{position.leverage}×</td>
      <td
        className={`text-right px-4 py-3 text-xs font-medium tabular-nums ${
          pnl >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'
        }`}
      >
        {formatPrice(pnl)} <span className="text-[0.6rem] font-normal opacity-90">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
      </td>
      <td className="text-right px-4 py-3">
        <button
          onClick={() => onClose(position._id || position.id)}
          className="t-btn t-btn-danger text-[0.6rem] py-1 px-3"
        >
          Close
        </button>
      </td>
    </tr>
  );
}

export default function PortfolioPage() {
  const { address } = useAccount();
  const api = useApi();
  const { prices } = useSocket();

  const [tab, setTab] = useState('shields');
  const [shields, setShields] = useState([]);
  const [trades, setTrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);

    Promise.allSettled([
      api.get(`/api/yield-shield/active/${address}`),
      api.get(`/api/trade/positions/${address}`),
      api.get(`/api/trade/history/${address}`),
      api.get(`/api/yield-shield/history/${address}`),
    ]).then(([shieldsResult, tradesResult, tradeHistResult, shieldHistResult]) => {
      if (shieldsResult.status === 'fulfilled') {
        const d = shieldsResult.value;
        setShields(d.shields || d || []);
      }
      if (tradesResult.status === 'fulfilled') {
        const d = tradesResult.value;
        setTrades(d.positions || d || []);
      }
      // Merge trade history and shield history into a single list
      const closedTrades = (tradeHistResult.status === 'fulfilled'
        ? (tradeHistResult.value.positions || tradeHistResult.value || [])
        : []
      ).map((p) => ({
        _type: 'trade',
        marketId: p.marketId,
        amount: p.margin,
        pnl: p.realizedPnl ?? 0,
        closedAt: p.closedAt,
        direction: p.direction,
        status: p.status,
      }));
      const settledShields = (shieldHistResult.status === 'fulfilled'
        ? (shieldHistResult.value.shields || shieldHistResult.value || [])
        : []
      ).map((s) => ({
        _type: 'shield',
        marketId: s.asset,
        amount: s.depositAmount,
        pnl: s.exposurePayout ?? 0,
        closedAt: s.settledAt || s.createdAt,
        status: s.status,
      }));
      setHistory(
        [...closedTrades, ...settledShields].sort(
          (a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0)
        )
      );
      setLoading(false);
    });
  }, [address]);

  const handleSettle = async (shieldId) => {
    try {
      await api.post(`/api/yield-shield/settle/${shieldId}`);
      setShields((prev) => prev.filter((s) => (s._id || s.id) !== shieldId));
    } catch (err) {
      console.error('Settle failed', err);
    }
  };

  const handleClose = async (positionId) => {
    try {
      const priceData = prices[trades.find((t) => (t._id || t.id) === positionId)?.marketId];
      await api.post('/api/trade/close', { positionId });
      setTrades((prev) => prev.filter((t) => (t._id || t.id) !== positionId));
    } catch (err) {
      console.error('Close failed', err);
    }
  };

  // Position IDs that belong to shields (so we don't double-count in trades P&L or show them in Trades tab)
  const shieldPositionIds = useMemo(
    () => new Set(shields.map((s) => String(s.positionId?._id ?? s.positionId ?? '')).filter(Boolean)),
    [shields]
  );

  // Trades only: exclude positions that are the perp-side of a shield
  const tradesExcludingShields = useMemo(
    () => trades.filter((t) => !shieldPositionIds.has(String(t._id || t.id))),
    [trades, shieldPositionIds]
  );

  return (
    <WalletGate>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="t-section text-xl font-bold uppercase tracking-[0.1em]">
              Portfolio
            </h1>
            <p className="text-xs text-[var(--t-text-muted)] mt-1">
              Manage your active shields and trading positions.
            </p>
          </div>
          <AddTokenButton />
        </div>

        {/* Simple portfolio summary – like Polymarket overview */}
        {!loading && (shields.length > 0 || trades.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="t-stat">
              <div className="t-stat-label">Total protected deposit</div>
              <div className="t-stat-value text-base">
                {formatPrice(shields.reduce((sum, s) => sum + (s.depositAmount || 0), 0))}
              </div>
              <div className="text-[0.65rem] text-[var(--t-blue)] mt-1 font-medium">
                100% protected — your deposits are always safe
              </div>
            </div>
            <div className="t-stat">
              <div className="t-stat-label">Live profit or loss (protected earnings + trades)</div>
              {(() => {
                const shieldPnl = shields.reduce((sum, s) => {
                  const livePrice = prices[s.asset]?.price;
                  const entryPrice = s.entryPrice;
                  const exposure = s.exposureBudget || 0;
                  // Match ShieldRow: clamp to ±exposure and reject degenerate
                  // entry prices so an old corrupt row can't blow up the sum.
                  let pnl;
                  if (livePrice && entryPrice && entryPrice >= 0.5) {
                    const raw = ((livePrice - entryPrice) / entryPrice) * exposure;
                    pnl = Math.max(-exposure, Math.min(exposure, raw));
                  } else {
                    pnl = s.positionId?.unrealizedPnl ?? 0;
                  }
                  return sum + (pnl || 0);
                }, 0);
                const tradePnl = tradesExcludingShields.reduce((sum, p) => {
                  const livePrice = prices[p.marketId]?.price;
                  const entryPrice = p.entryPrice;
                  const size = p.size || (p.margin || 0) * (p.leverage || 1);
                  const pnl =
                    livePrice && entryPrice
                      ? p.direction?.toUpperCase() === 'LONG'
                        ? ((livePrice - entryPrice) / entryPrice) * size
                        : ((entryPrice - livePrice) / entryPrice) * size
                      : (p.unrealizedPnl ?? 0);
                  return sum + (pnl || 0);
                }, 0);
                const total = shieldPnl + tradePnl;
                const totalDeposit = shields.reduce((sum, s) => sum + (s.depositAmount || 0), 0);
                const pct = totalDeposit > 0 ? (total / totalDeposit) * 100 : 0;
                return (
                  <>
                    <div
                      className={`t-stat-value text-base ${
                        total >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'
                      }`}
                    >
                      {formatPrice(total)}
                      {totalDeposit > 0 && (
                        <span className="text-[0.65rem] font-normal ml-1 opacity-90">
                          ({pct >= 0 ? '+' : ''}{pct.toFixed(3)}%)
                        </span>
                      )}
                    </div>
                    <div className="text-[0.6rem] text-[var(--t-text-muted)] mt-1 tabular-nums">
                      {shields.length > 0 && (
                        <span>Shields: {formatPrice(shieldPnl)}</span>
                      )}
                      {shields.length > 0 && tradesExcludingShields.length > 0 && ' · '}
                      {tradesExcludingShields.length > 0 && (
                        <span>Trades: {formatPrice(tradePnl)}</span>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="text-[0.65rem] text-[var(--t-text-muted)] mt-1">
                Your protected earnings are new. Profit or loss updates as prices move.
              </div>
            </div>
            <div className="t-stat">
              <div className="t-stat-label">Positions</div>
              <div className="t-stat-value text-base">
                {shields.length} shields · {trades.length} trades
              </div>
              <div className="text-[0.65rem] text-[var(--t-text-muted)] mt-1">
                Each row below is one live bet you currently have on.
              </div>
            </div>
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('shields')}
            className={`t-btn ${tab === 'shields' ? 't-btn-primary' : 't-btn-ghost'}`}
          >
            Protected earnings ({shields.length})
          </button>
          <button
            onClick={() => setTab('trades')}
            className={`t-btn ${tab === 'trades' ? 't-btn-primary' : 't-btn-ghost'}`}
          >
            Leveraged trades ({trades.length})
          </button>
        </div>

        {loading ? (
          <div className="t-panel p-8 text-center text-[var(--t-text-dim)] text-xs">
            Loading…
          </div>
        ) : tab === 'shields' ? (
          <div>
            {shields.length === 0 ? (
              <div className="t-panel p-8 text-center">
                <div className="text-[var(--t-text-dim)] text-xs uppercase tracking-[0.1em] mb-2">
                  No protected earnings yet
                </div>
                <p className="text-xs text-[var(--t-text-muted)]">
                  Create your first protected earning to get started — your deposit stays safe while you earn.
                </p>
              </div>
            ) : (
              <div className="t-panel overflow-hidden">
                <div className="t-panel-header">Your protected earnings</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
                        <th className="text-left px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Asset</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Deposit</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Yield at work</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Profit or loss</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Time left</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shields.map((shield) => (
                        <ShieldRow
                          key={shield._id || shield.id}
                          shield={shield}
                          prices={prices}
                          onSettle={handleSettle}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {trades.length === 0 ? (
              <div className="t-panel p-8 text-center">
                <div className="text-[var(--t-text-dim)] text-xs uppercase tracking-[0.1em] mb-2">
                  No open trades
                </div>
                <p className="text-xs text-[var(--t-text-muted)]">
                  Place a bet on any asset from the Markets page to see it here.
                </p>
              </div>
            ) : (
              <div className="t-panel overflow-hidden">
                <div className="t-panel-header">Your open trades</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
                        <th className="text-left px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Market</th>
                        <th className="text-left px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Bet</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Amount used</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Multiplier</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Profit or loss</th>
                        <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((pos) => (
                        <TradeRow
                          key={pos._id || pos.id}
                          position={pos}
                          prices={prices}
                          onClose={handleClose}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 t-panel">
            <div className="t-panel-header">History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
                    <th className="text-left px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Type</th>
                    <th className="text-left px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Market</th>
                    <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Amount</th>
                    <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Profit or loss</th>
                    <th className="text-right px-4 py-2.5 text-[var(--t-text-muted)] uppercase tracking-[0.12em] text-[0.6rem] font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--t-border)] last:border-0 hover:bg-[var(--t-bg-secondary)] transition-colors">
                      <td className="px-4 py-3">
                        <span className={`t-tag ${item._type === 'shield' ? 't-tag-blue' : 't-tag-gold'}`}>
                          {item._type === 'shield' ? 'SHIELD' : 'TRADE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase">{item.marketId}</td>
                      <td className="text-right px-4 py-3 text-xs tabular-nums">{formatPrice(item.amount)}</td>
                      <td
                        className={`text-right px-4 py-3 text-xs tabular-nums font-medium ${
                          (item.pnl || 0) >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'
                        }`}
                      >
                        {formatPrice(item.pnl)}
                      </td>
                      <td className="text-right px-4 py-3 text-xs text-[var(--t-text-muted)]">
                        {item.closedAt
                          ? new Date(item.closedAt).toLocaleDateString()
                          : '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </WalletGate>
  );
}
