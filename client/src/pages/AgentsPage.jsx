import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useApi } from '../hooks/useApi';
import WalletGate from '../components/WalletGate';

const SCOPES = [
  { id: 'recommend', label: 'recommend',  desc: 'Call /api/ai/recommend-shield' },
  { id: 'shield',    label: 'shield',     desc: 'prepare + activate shields on behalf of the wallet' },
  { id: 'read',      label: 'read',       desc: 'Read price, rates, action feed' },
];

export default function AgentsPage() {
  return (
    <WalletGate>
      <AgentsPageInner />
    </WalletGate>
  );
}

function AgentsPageInner() {
  const { address } = useAccount();
  const api = useApi();
  const { signMessageAsync } = useSignMessage();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [revealed, setRevealed] = useState(null); // { key, prefix, label, scopes } returned once after create/rotate
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(SCOPES.map((s) => s.id));
  const [busy, setBusy] = useState('');

  async function signedRequest(path, action, extra = {}) {
    if (!address) throw new Error('Wallet not connected');
    const { nonce, expiresAt, message } = await api.post('/api/agents/nonce', { walletAddress: address, action });
    const signature = await signMessageAsync({ message });
    return api.post(path, { walletAddress: address, nonce, signature, expiresAt, ...extra });
  }

  async function loadKeys() {
    setLoading(true);
    setErr(null);
    try {
      const out = await signedRequest('/api/agents/keys/list', 'list');
      setKeys(out.keys || []);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to list keys');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (address) loadKeys();
  }, [address]);

  async function handleCreate() {
    setBusy('create');
    setErr(null);
    try {
      const out = await signedRequest('/api/agents/keys', 'create', { label: label.trim() || 'untitled', scopes });
      setRevealed({ key: out.key, prefix: out.keyPrefix, label: out.label, scopes: out.scopes });
      setShowCreate(false);
      setLabel('');
      await loadKeys();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Create failed');
    }
    setBusy('');
  }

  async function handleRevoke(id) {
    if (!confirm('Revoke this key? Agents using it will start receiving 401 immediately.')) return;
    setBusy(`revoke:${id}`);
    setErr(null);
    try {
      await signedRequest(`/api/agents/keys/${id}/revoke`, 'revoke');
      await loadKeys();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Revoke failed');
    }
    setBusy('');
  }

  async function handleRotate(id) {
    setBusy(`rotate:${id}`);
    setErr(null);
    try {
      const out = await signedRequest(`/api/agents/keys/${id}/rotate`, 'rotate');
      setRevealed({ key: out.key, prefix: out.keyPrefix, label: out.label, scopes: out.scopes });
      await loadKeys();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Rotate failed');
    }
    setBusy('');
  }

  return (
    <div className="max-w-5xl mx-auto font-sans pb-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">My Agents</h1>
        <p className="text-base text-[var(--t-text-muted)] max-w-2xl">
          Session keys for external agents (Claude, Cursor, custom bots) to call Aegis on your
          behalf. Each key is wallet-derived, scoped, and revocable. Agents bring their own
          private keys for on-chain signing — we never custody.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-[var(--t-red)]/40 bg-[var(--t-red)]/10 px-4 py-3 text-sm text-[var(--t-red)] font-mono">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-panel)] overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--t-border)]">
          <h3 className="text-xs uppercase tracking-[0.18em]">Your session keys</h3>
          <button
            type="button"
            onClick={() => setShowCreate((s) => !s)}
            className="t-btn t-btn-primary text-[11px]"
          >
            + Create key
          </button>
        </div>

        {showCreate && (
          <div className="border-b border-[var(--t-border)] px-5 py-5 bg-[var(--t-panel-elev)]">
            <div className="grid gap-4 max-w-xl">
              <div>
                <label className="t-stat-label block mb-1">Label</label>
                <input
                  className="t-input"
                  placeholder='e.g. "Claude treasury bot"'
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div>
                <div className="t-stat-label mb-1">Scopes</div>
                <div className="flex flex-wrap gap-2">
                  {SCOPES.map((s) => (
                    <label key={s.id} className={`cursor-pointer t-tag ${scopes.includes(s.id) ? 't-tag-blue' : ''}`}>
                      <input
                        type="checkbox"
                        className="mr-2 align-middle"
                        checked={scopes.includes(s.id)}
                        onChange={(e) =>
                          setScopes((cur) =>
                            e.target.checked ? [...new Set([...cur, s.id])] : cur.filter((x) => x !== s.id)
                          )
                        }
                      />
                      {s.label} — <span className="opacity-70 normal-case">{s.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="t-btn t-btn-primary"
                  onClick={handleCreate}
                  disabled={busy === 'create' || scopes.length === 0}
                >
                  {busy === 'create' ? <span className="shield-loader w-3 h-3" /> : 'Sign + create'}
                </button>
                <button type="button" className="t-btn t-btn-ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
              <small className="text-[var(--t-text-dim)] text-xs">
                You'll be asked to sign a one-time message in your wallet. The raw key is shown only once after signing.
              </small>
            </div>
          </div>
        )}

        {loading && <div className="px-5 py-6 text-xs text-[var(--t-text-muted)]">Loading…</div>}
        {!loading && keys.length === 0 && (
          <div className="px-5 py-8 text-sm text-[var(--t-text-muted)] text-center">
            No keys yet. Create one above to let an agent call Aegis on your behalf.
          </div>
        )}

        {keys.length > 0 && (
          <div>
            <div className="grid grid-cols-[1.6fr_1.4fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--t-text-muted)] border-b border-[var(--t-border)]">
              <div>Key prefix · Label</div>
              <div>Scopes</div>
              <div>Created</div>
              <div>Last used</div>
              <div>Status</div>
              <div></div>
            </div>
            {keys.map((k) => (
              <div key={k.id} className="grid grid-cols-[1.6fr_1.4fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-4 border-t border-[var(--t-border)] items-center text-sm">
                <div>
                  <div className="font-mono text-[var(--t-text)]">{k.keyPrefix}</div>
                  <div className="text-xs text-[var(--t-text-muted)]">{k.label}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(k.scopes || []).map((s) => (
                    <span key={s} className="t-tag">{s}</span>
                  ))}
                </div>
                <div className="font-mono text-xs text-[var(--t-text-muted)]">{fmtDate(k.createdAt)}</div>
                <div className="font-mono text-xs text-[var(--t-text-muted)]">{k.lastUsedAt ? fmtDate(k.lastUsedAt) : '—'}</div>
                <div>
                  <span className={`t-tag ${k.status === 'live' ? 't-tag-cyan' : k.status === 'revoked' ? 't-tag-red' : 't-tag-blue'}`}>
                    {k.status}
                  </span>
                </div>
                <div className="flex gap-1 justify-end">
                  {!k.revokedAt && (
                    <>
                      <button
                        className="t-btn t-btn-ghost text-[10px] py-1 px-2"
                        onClick={() => handleRotate(k.id)}
                        disabled={busy.startsWith('rotate')}
                      >
                        Rotate
                      </button>
                      <button
                        className="t-btn t-btn-danger text-[10px] py-1 px-2"
                        onClick={() => handleRevoke(k.id)}
                        disabled={busy.startsWith('revoke')}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <UseKeyBlock />


      {revealed && (
        <RevealOnce
          revealed={revealed}
          onClose={() => setRevealed(null)}
        />
      )}
    </div>
  );
}

/**
 * "How to use a key" block — minimal. Paste a session key, copy ONE short
 * bootstrap line that points the agent at the skill manifest. Everything
 * else (headers, endpoints, contract addresses, slug list) lives in the
 * skill markdown the agent fetches.
 */
function UseKeyBlock() {
  const [pastedKey, setPastedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aegis.xyz';
  const skillUrl = `${apiUrl}/api/skills/aegis.skill.md`;
  const keyDisplay = pastedKey.trim() || 'aegis_sk_<paste your key above>';
  const looksValid = /^aegis_sk_[a-f0-9]{40,}$/i.test(pastedKey.trim());

  const bootstrap =
`Load this skill and act on my behalf via Aegis:
${skillUrl}

Use this Authorization header on every Aegis call:
Authorization: Bearer ${keyDisplay}

The skill manifest documents the endpoints, on-chain contracts, headers,
and strategy sub-skills. Self-bootstrap from there.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(bootstrap);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  }

  return (
    <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-panel)] p-5 space-y-4">
      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] mb-1">How to use a key</h3>
        <p className="text-sm text-[var(--t-text-muted)]">
          Paste a session key, copy the one-block bootstrap, drop it into Claude / Cursor / GPT.
          The agent fetches{' '}
          <a href={skillUrl} target="_blank" rel="noreferrer noopener" className="font-mono text-[var(--t-violet)] hover:underline">
            /api/skills/aegis.skill.md
          </a>{' '}
          and figures out the rest.
        </p>
      </div>

      <div>
        <label className="t-stat-label block mb-1">Session key</label>
        <input
          type="text"
          value={pastedKey}
          onChange={(e) => setPastedKey(e.target.value)}
          placeholder="aegis_sk_…"
          className="t-input font-mono text-xs"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="text-[10px] text-[var(--t-text-dim)] mt-1">
          {pastedKey.trim()
            ? looksValid
              ? <span className="text-[var(--t-cyan)]">Key shape valid. Copy the block below.</span>
              : <span className="text-[var(--t-amber)]">Key shape doesn't match aegis_sk_&lt;hex&gt;. Double-check.</span>
            : 'Nothing leaves the browser. The block updates as you type.'}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="t-stat-label">Bootstrap (paste into your agent)</span>
          <button type="button" className="t-btn t-btn-ghost text-[10px] py-1 px-2" onClick={copy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="font-mono text-xs bg-[var(--t-bg-secondary)] border border-[var(--t-border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{bootstrap}</pre>
      </div>
    </div>
  );
}

function RevealOnce({ revealed, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(revealed.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-2xl border border-[var(--t-violet)]/40 bg-[var(--t-panel)] p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--t-violet)] mb-2">Your new session key</div>
        <h2 className="text-xl font-semibold mb-2">{revealed.label}</h2>
        <p className="text-sm text-[var(--t-text-muted)] mb-4">
          This is the ONLY time you'll see the raw key. Copy it now and paste it into your agent's environment.
          We only store a hash on our side.
        </p>
        <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-bg-secondary)] p-3 mb-4 font-mono text-sm break-all">
          {revealed.key}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" className="t-btn t-btn-ghost" onClick={copy}>
            {copied ? '✓ Copied' : 'Copy to clipboard'}
          </button>
          <button type="button" className="t-btn t-btn-primary" onClick={onClose}>
            I've saved it
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
}
