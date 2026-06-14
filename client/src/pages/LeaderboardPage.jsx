import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useApi } from '../hooks/useApi';
import { formatPrice, truncateAddress } from '../lib/utils';

// PnL color helpers — uses theme tokens. Positive shows in t-violet (reads
// stronger against the dark background than t-green for this product's brand);
// negative in t-red.
const pnlClass = (n) => (n >= 0 ? 'text-[var(--t-violet)]' : 'text-[var(--t-red)]');
const formatSignedPrice = (n) => {
  if (n == null || isNaN(n)) return formatPrice(0);
  return `${n >= 0 ? '+' : ''}${formatPrice(n)}`;
};

function PnlInfoTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        aria-label="PnL units"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--t-border)] text-[0.55rem] text-[var(--t-text-muted)] hover:text-[var(--t-cyan)] hover:border-[var(--t-cyan)] transition-colors"
      >
        i
      </button>
      {open && (
        <span className="absolute right-0 top-5 z-10 w-56 t-panel p-2 text-[0.6rem] text-[var(--t-text-muted)] normal-case tracking-normal leading-relaxed">
          PnL in USDY (test token on Mantle Sepolia). Real USDY at v1 launch.
        </span>
      )}
    </span>
  );
}

function RecentShields({ items }) {
  const [open, setOpen] = useState(false);

  if (!items || items.length === 0) return null;

  return (
    <div className="t-panel mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full t-panel-header flex items-center justify-between hover:bg-[var(--t-bg-secondary)] transition-colors"
      >
        <span>Recent shields ({items.length})</span>
        <span className="text-[var(--t-text-muted)]">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--t-border)]">
                <th className="text-left px-4 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.55rem]">User</th>
                <th className="text-left px-4 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.55rem]">Asset</th>
                <th className="text-right px-4 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.55rem]">Deposit</th>
                <th className="text-right px-4 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.55rem]">Current PnL</th>
                <th className="text-right px-4 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.55rem]">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--t-border)] last:border-0"
                >
                  <td className="px-4 py-2 font-mono text-[var(--t-text-muted)]">{truncateAddress(s.user)}</td>
                  <td className="px-4 py-2">{s.assetName || s.asset}</td>
                  <td className="text-right px-4 py-2 text-[var(--t-text-muted)]">{formatPrice(s.depositAmount)}</td>
                  <td className={`text-right px-4 py-2 font-medium ${s.currentPnl == null ? 'text-[var(--t-text-dim)]' : pnlClass(s.currentPnl)}`}>
                    {s.currentPnl == null ? '—' : formatSignedPrice(s.currentPnl)}
                  </td>
                  <td className="text-right px-4 py-2 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.55rem]">
                    {s.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const api = useApi();
  const { address: connectedAddress } = useAccount();
  const [leaders, setLeaders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/leaderboard').catch(() => ({ leaderboard: [] })),
      api.get('/api/leaderboard/recent?limit=5').catch(() => ({ recent: [] })),
    ])
      .then(([lb, rc]) => {
        setLeaders(lb.leaderboard || []);
        setRecent(rc.recent || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load leaderboard');
        setLoading(false);
      });
  }, []);

  const getRankDisplay = (rank) => {
    if (rank === 1) return { text: '#1', color: 'text-[var(--t-gold)]' };
    if (rank === 2) return { text: '#2', color: 'text-[var(--t-text)]' };
    if (rank === 3) return { text: '#3', color: 'text-[#CD7F32]' };
    return { text: `#${rank}`, color: 'text-[var(--t-text-muted)]' };
  };

  const isConnected = !!connectedAddress;
  const hasLeaders = leaders.length > 0;
  const connectedHasShields = isConnected
    ? leaders.some((l) => (l.address || '').toLowerCase() === connectedAddress.toLowerCase())
    : false;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="t-section text-xl font-bold uppercase tracking-[0.1em]">Leaderboard</h1>
        <p className="text-xs text-[var(--t-text-muted)] mt-1">
          Top traders ranked by total profit or loss across their shields.
        </p>
        <p className="text-xs text-[var(--t-blue)] mt-1 font-medium">
          This list shows shield exposure outcomes only. Your protected principal is always safe.
        </p>
      </div>

      {loading ? (
        <div className="t-panel p-8 text-center text-[var(--t-text-dim)] text-xs">Loading…</div>
      ) : error ? (
        <div className="t-panel p-8 text-center text-[var(--t-red)] text-xs">{error}</div>
      ) : (
        <>
          <div className="t-panel overflow-hidden">
            <div className="t-panel-header">Top traders</div>

            {!isConnected && !hasLeaders ? (
              <div className="p-8 text-center text-[var(--t-text-muted)] text-xs">
                Connect a wallet to see traders.
              </div>
            ) : isConnected && !connectedHasShields && !hasLeaders ? (
              <div className="p-8 text-center text-[var(--t-text-muted)] text-xs">
                No shields yet — be the first.
                <div className="mt-3">
                  <Link
                    to="/app/shield"
                    className="inline-block px-3 py-1.5 border border-[var(--t-violet)] text-[var(--t-violet)] uppercase tracking-[0.1em] text-[0.6rem] hover:bg-[var(--t-violet)] hover:text-[var(--t-bg)] transition-colors"
                  >
                    Create a shield
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--t-border)]">
                      <th className="text-left px-4 py-3 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem] w-16">Rank</th>
                      <th className="text-left px-4 py-3 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Address</th>
                      <th className="text-right px-4 py-3 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">
                        <span className="inline-flex items-center justify-end">
                          Total profit or loss
                          <PnlInfoTooltip />
                        </span>
                      </th>
                      <th className="text-right px-4 py-3 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Shields</th>
                      <th className="text-right px-4 py-3 text-[var(--t-text-muted)] uppercase tracking-[0.1em] text-[0.6rem]">Win rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaders.map((leader, i) => {
                      const rank = leader.rank || i + 1;
                      const rankInfo = getRankDisplay(rank);
                      const total = Number(leader.totalPnl || 0);
                      const realized = Number(leader.realizedPnl || 0);
                      const unrealized = Number(leader.unrealizedPnl || 0);
                      const showBreakdown = total === 0 && (realized !== 0 || unrealized !== 0 || (leader.tradeCount || leader.trades || 0) > 0);
                      const tradeCount = leader.tradeCount ?? leader.trades ?? 0;
                      const winRate = leader.winRate ?? 0;

                      return (
                        <tr
                          key={leader.address || i}
                          className="border-b border-[var(--t-border)] last:border-0 hover:bg-[var(--t-bg-secondary)] transition-colors"
                        >
                          <td className={`px-4 py-3 font-bold text-sm ${rankInfo.color}`}>{rankInfo.text}</td>
                          <td className="px-4 py-3 font-mono">
                            {leader.ensSubname || leader.ens || truncateAddress(leader.address)}
                          </td>
                          <td className={`text-right px-4 py-3 font-bold ${pnlClass(total)}`}>
                            <div>{formatSignedPrice(total)}</div>
                            {showBreakdown && (
                              <div className="text-[0.55rem] text-[var(--t-text-muted)] font-normal mt-0.5">
                                R {formatSignedPrice(realized)} · U {formatSignedPrice(unrealized)}
                              </div>
                            )}
                          </td>
                          <td className="text-right px-4 py-3 text-[var(--t-text-muted)]">{tradeCount}</td>
                          <td className="text-right px-4 py-3">
                            <span
                              className={
                                winRate >= 60
                                  ? 'text-[var(--t-violet)]'
                                  : winRate >= 45
                                  ? 'text-[var(--t-gold)]'
                                  : 'text-[var(--t-red)]'
                              }
                            >
                              {Number(winRate).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 py-2 border-t border-[var(--t-border)] text-[0.55rem] text-[var(--t-text-dim)]">
              // RANKINGS COMPUTED LIVE FROM SETTLED + MARK-TO-MARKET SHIELDS
            </div>
          </div>

          <RecentShields items={recent} />
        </>
      )}
    </div>
  );
}
