import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useApi } from '../hooks/useApi';
import { EXPLORER_BASE } from '../config/contracts';

/**
 * "Your agents on {asset}" panel.
 *
 * Pulls /api/agents/actions/public?wallet=&asset= and renders one row per
 * (sessionKeyId × agentSlug). Read-only — the source of truth is the AgentAction
 * mongo collection populated by the agentBearerAuth middleware.
 */
export default function AgentFeed({ asset, title = 'Your agents on this asset' }) {
  const { address } = useAccount();
  const api = useApi();
  const [agents, setAgents] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!address) {
        setAgents([]);
        setRecent([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams({ wallet: address.toLowerCase() });
        if (asset) params.set('asset', asset);
        const result = await api.get(`/api/agents/actions/public?${params.toString()}`);
        if (cancelled) return;
        setAgents(result.agents || []);
        setRecent((result.actions || []).slice(0, 25));
      } catch (e) {
        if (cancelled) return;
        setErr(e?.response?.data?.error || e?.message || 'Failed to load agent feed');
      }
      setLoading(false);
    }
    load();
    // poll every 10s while the page is open
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, asset, api]);

  if (!address) {
    return (
      <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-panel)] p-6 text-center text-sm text-[var(--t-text-muted)]">
        Connect a wallet to see your agents.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-panel)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--t-border)]">
        <h3 className="text-xs uppercase tracking-[0.18em] text-[var(--t-text)]">{title}</h3>
        <div className="text-xs text-[var(--t-text-muted)] font-mono">
          {agents.length} agent{agents.length === 1 ? '' : 's'} · {recent.length} recent action{recent.length === 1 ? '' : 's'}
        </div>
      </div>

      {loading && (
        <div className="px-5 py-6 text-center text-xs text-[var(--t-text-muted)]">Loading…</div>
      )}

      {err && (
        <div className="px-5 py-4 text-sm text-[var(--t-red)] font-mono">{err}</div>
      )}

      {!loading && !err && agents.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-[var(--t-text-muted)]">
          <div className="mb-2">No agent activity for this asset yet.</div>
          <a
            href="/app/agents"
            className="inline-block text-xs uppercase tracking-wider text-[var(--t-violet)] hover:underline"
          >
            Create an API key →
          </a>
        </div>
      )}

      {!loading && !err && agents.length > 0 && (
        <div>
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1.2fr_1.4fr_1fr] gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--t-text-muted)] border-b border-[var(--t-border)]">
            <div>Agent</div>
            <div>Model</div>
            <div>Invested</div>
            <div>Current value</div>
            <div>Realized PnL · last action</div>
            <div>Status</div>
          </div>
          {agents.map((a, i) => (
            <AgentRow key={i} a={a} />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <details className="border-t border-[var(--t-border)]">
          <summary className="cursor-pointer px-5 py-3 text-xs uppercase tracking-[0.14em] text-[var(--t-text-muted)] hover:text-[var(--t-text)]">
            Recent actions ({recent.length})
          </summary>
          <div className="px-5 pb-5 space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-xs font-mono text-[var(--t-text-muted)]">
                <span className="text-[var(--t-text-dim)]">{formatRelative(r.createdAt)}</span>
                <span className="text-[var(--t-violet)]">{r.action}</span>
                <span className="text-[var(--t-text)]">{r.agentSlug || 'anonymous'}</span>
                {r.onChainTxHash && (
                  <a
                    href={`${EXPLORER_BASE}/tx/${r.onChainTxHash}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[var(--t-cyan)] hover:underline"
                  >
                    {r.onChainTxHash.slice(0, 10)}…
                  </a>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AgentRow({ a }) {
  const pnl = Number(a.realizedPnl) || 0;
  const pnlColor = pnl > 0 ? 'text-[var(--t-cyan)]' : pnl < 0 ? 'text-[var(--t-red)]' : 'text-[var(--t-text-muted)]';
  const statusClass =
    a.status === 'error'
      ? 't-tag-red'
      : a.actionCount > 0
      ? 't-tag-cyan'
      : 't-tag';
  return (
    <div className="grid grid-cols-[1.6fr_1fr_1fr_1.2fr_1.4fr_1fr] gap-4 px-5 py-4 border-t border-[var(--t-border)] items-center">
      <div className="flex items-center gap-3">
        <span className="t-tag-blue px-2 py-0.5">{a.agentSlug}</span>
        {a.agentName && <span className="font-mono text-xs text-[var(--t-text-muted)]">{a.agentName}</span>}
      </div>
      <div className="font-mono text-sm text-[var(--t-text)]">{a.agentModel || '—'}</div>
      <div className="font-mono text-sm text-[var(--t-text)]">${(a.invested || 0).toFixed(2)}</div>
      <div className="font-mono text-sm text-[var(--t-text)]">${(a.currentValue || a.invested || 0).toFixed(2)}</div>
      <div>
        <div className={`font-mono text-sm ${pnlColor}`}>
          {pnl > 0 ? '+' : ''}${pnl.toFixed(2)}
        </div>
        <div className="text-[10px] text-[var(--t-text-dim)] font-mono mt-0.5">
          {a.lastAction} · {formatRelative(a.lastActionAt)}
        </div>
      </div>
      <div>
        <span className={statusClass}>{a.actionCount > 0 ? 'active' : 'idle'}</span>
      </div>
    </div>
  );
}

function formatRelative(ts) {
  if (!ts) return '—';
  const t = new Date(ts).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
