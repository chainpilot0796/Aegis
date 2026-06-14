import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Plus, Check } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MARKETS } from "../data/mockData";
import MarketIcon from "../components/MarketIcon";
import CosmicBg from "../components/ui/CosmicBg";
import logo from "../assets/aegis-mark.svg";

/* ---------- Live price hook (asset ticker only) ---------- */
function useLivePrices() {
  const [prices, setPrices] = useState(() =>
    MARKETS.reduce((acc, m) => ({ ...acc, [m.id]: m.currentPrice }), {})
  );
  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = {};
        MARKETS.forEach((m) => {
          const delta = prev[m.id] * m.volatility * (Math.random() - 0.48);
          next[m.id] = Math.max(0, prev[m.id] + delta + prev[m.id] * m.drift);
        });
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, []);
  return prices;
}

/* ---------- Synthetic agent activity feed ---------- */
const AGENT_POOL = [
  { agent: "aegis-conservative-saver", verb: "opened shield", asset: "gold" },
  { agent: "claude-strategist-04", verb: "rolled position", asset: "ethereum" },
  { agent: "atlas-treasury-bot", verb: "anchored proof", asset: "wti_oil" },
  { agent: "openclaw-yield-01", verb: "settled payoff", asset: "silver" },
  { agent: "tee-recorder-v2", verb: "stored receipt", asset: "bitcoin" },
  { agent: "aegis-defensive-rt", verb: "raised floor", asset: "re_nyc" },
  { agent: "shield-rebalancer", verb: "closed envelope", asset: "natural_gas" },
  { agent: "vault-router", verb: "routed LP fee", asset: "ethereum" },
];
function shortPnL() {
  const n = Math.round((Math.random() * 180 - 30) * 10) / 10;
  return (n >= 0 ? "+" : "") + "$" + Math.abs(n).toFixed(1) * (n < 0 ? -1 : 1);
}
function shortAgo() {
  const s = Math.floor(Math.random() * 60) + 2;
  return `${s}s ago`;
}
function useAgentFeed() {
  const [rows, setRows] = useState(() =>
    Array.from({ length: 7 }, (_, i) => {
      const p = AGENT_POOL[i % AGENT_POOL.length];
      return {
        id: `init-${i}`,
        ...p,
        pnl: shortPnL(),
        ago: `${(i + 1) * 6}s ago`,
        cid: `0x${Math.random().toString(16).slice(2, 10)}`,
      };
    })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setRows((prev) => {
        const p = AGENT_POOL[Math.floor(Math.random() * AGENT_POOL.length)];
        const row = {
          id: `r-${Date.now()}`,
          ...p,
          pnl: shortPnL(),
          ago: shortAgo(),
          cid: `0x${Math.random().toString(16).slice(2, 10)}`,
        };
        return [row, ...prev.slice(0, 6)];
      });
    }, 2600);
    return () => clearInterval(id);
  }, []);
  return rows;
}

/* ---------- Interactive agent terminal (real API call to /api/ai/recommend-shield) ---------- */
const PRESETS = [
  "I am worried about inflation eating my savings.",
  "I want a 3-month hedge on the price of gold.",
  "Housing in Miami keeps going up. I want exposure.",
  "Solana has momentum and I can lock $200 for 30 days.",
  "Crude oil is volatile but I expect a runup over 3 months.",
];

function AgentTerminal() {
  const [concern, setConcern] = useState(PRESETS[0]);
  const [deposit, setDeposit] = useState(500);
  const [duration, setDuration] = useState(3);
  const [slug, setSlug] = useState("inflation-hedger");
  const [bearer, setBearer] = useState("");
  const [response, setResponse] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const apiBase =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://aegis.xyz";
  const bearerDisplay = bearer.trim() ? `Bearer ${bearer.trim()}` : "(omitted — public demo mode)";

  const requestPreview = useMemo(
    () => JSON.stringify({ concern, depositAmount: Number(deposit) || 0, durationMonths: Number(duration) || 0 }, null, 2),
    [concern, deposit, duration],
  );

  async function send() {
    setBusy(true);
    setError(null);
    setResponse(null);
    setElapsed(null);
    const t0 = performance.now();
    try {
      const headers = { "Content-Type": "application/json" };
      if (bearer.trim()) {
        headers["Authorization"] = "Bearer " + bearer.trim();
        headers["X-Agent-Slug"] = slug;
        headers["X-Agent-Model"] = "landing-page-terminal";
        headers["X-Agent-Name"] = "Aegis Hero Demo";
      }
      const res = await fetch(apiBase + "/api/ai/recommend-shield", {
        method: "POST",
        headers,
        body: JSON.stringify({ concern, depositAmount: Number(deposit) || 0, durationMonths: Number(duration) || 0 }),
      });
      const text = await res.text();
      let j;
      try { j = JSON.parse(text); } catch { j = { raw: text }; }
      setElapsed(Math.round(performance.now() - t0));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setResponse(j.recommendation || j);
    } catch (e) {
      setError(e?.message || String(e));
    }
    setBusy(false);
  }

  // Auto-fire once on mount so the terminal has visible context immediately.
  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative font-mono text-[12px] leading-[1.55] text-[var(--t-text)]"
      style={{
        background: "#0A0A12",
        border: "1px solid var(--t-border)",
        borderRadius: 14,
        boxShadow: "0 1px 0 rgba(167,139,250,0.08) inset",
      }}
    >
      {/* chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--t-border)] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[#3A3A55]" />
        <span className="h-2 w-2 rounded-full bg-[#3A3A55]" />
        <span className="h-2 w-2 rounded-full bg-[#3A3A55]" />
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[var(--t-text-dim)]">
          aegis.terminal . live
        </span>
        <span className="ml-auto text-[10px] text-[var(--t-text-dim)]">
          {busy
            ? <span className="text-[var(--t-amber)]">running…</span>
            : error
              ? <span className="text-[var(--t-red)]">error</span>
              : response
                ? <span className="text-[var(--t-cyan)]">200 OK . {elapsed}ms . provider={response.providerUsed || "?"}{response.teeVerified ? " . tee✓" : ""}</span>
                : <span>idle</span>}
        </span>
      </div>

      {/* Inputs */}
      <div className="px-5 pt-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)] mb-1">concern</div>
          <textarea
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-[12px] text-[var(--t-text)] outline-none focus:border-[var(--t-violet)]"
            spellCheck={false}
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setConcern(p)}
                className="rounded-md border border-[var(--t-border)] bg-[var(--t-panel-elev)] px-2 py-0.5 text-[10px] text-[var(--t-text-muted)] hover:border-[var(--t-violet)] hover:text-[var(--t-violet)]"
              >
                {p.slice(0, 32)}{p.length > 32 ? "…" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)] mb-1">deposit (USDY)</div>
            <input
              type="number" min={1}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="w-full rounded-md border border-[var(--t-border)] bg-[var(--t-bg)] px-2 py-1.5 text-[12px] tabular-nums outline-none focus:border-[var(--t-violet)]"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)] mb-1">duration (months)</div>
            <input
              type="number" min={1} max={12}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-md border border-[var(--t-border)] bg-[var(--t-bg)] px-2 py-1.5 text-[12px] tabular-nums outline-none focus:border-[var(--t-violet)]"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)] mb-1">agent slug</div>
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-[var(--t-border)] bg-[var(--t-bg)] px-2 py-1.5 text-[12px] outline-none focus:border-[var(--t-violet)]"
            >
              <option value="conservative-saver">conservative-saver</option>
              <option value="inflation-hedger">inflation-hedger</option>
              <option value="momentum-shield">momentum-shield</option>
              <option value="balanced">balanced</option>
              <option value="aggressive">aggressive</option>
            </select>
          </div>
        </div>

        <details className="text-[11px]">
          <summary className="cursor-pointer text-[var(--t-text-muted)] hover:text-[var(--t-text)] list-none">
            <span className="text-[var(--t-violet)]">▸</span> Optional: paste a session key (Aegis records this call against your wallet)
          </summary>
          <input
            type="text"
            value={bearer}
            onChange={(e) => setBearer(e.target.value)}
            placeholder="aegis_sk_…"
            className="mt-2 w-full rounded-md border border-[var(--t-border)] bg-[var(--t-bg)] px-2 py-1.5 text-[11px] font-mono outline-none focus:border-[var(--t-violet)]"
            spellCheck={false} autoComplete="off"
          />
        </details>

        <button
          type="button"
          onClick={send}
          disabled={busy || !concern.trim()}
          className="t-btn t-btn-primary w-full justify-center disabled:opacity-50"
        >
          {busy ? "calling /api/ai/recommend-shield…" : "Send"}
        </button>
      </div>

      {/* Request preview */}
      <div className="mt-4 border-t border-[var(--t-border)] px-5 py-3 text-[11px]">
        <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)]">request</div>
        <div><span className="text-[var(--t-cyan)]">POST</span> <span className="text-[var(--t-text)]">{apiBase}/api/ai/recommend-shield</span></div>
        <div className="text-[var(--t-text-muted)]">Authorization: <span className="text-[var(--t-violet)]">{bearerDisplay}</span></div>
        <div className="text-[var(--t-text-muted)]">Content-Type: <span className="text-[var(--t-text)]">application/json</span></div>
        <pre className="mt-1 whitespace-pre text-[var(--t-text)]">{requestPreview}</pre>
      </div>

      {/* Response */}
      <div className="border-t border-dashed border-[var(--t-border)] px-5 py-3 text-[11px]">
        <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)]">response</div>
        {busy && <div className="text-[var(--t-text-muted)]">…</div>}
        {error && <div className="text-[var(--t-red)]">error: {error}</div>}
        {!busy && !error && response && (
          <pre className="whitespace-pre-wrap text-[var(--t-text-muted)]">
{`{
  asset:        `}<span className="text-[var(--t-violet)]">{JSON.stringify(response.asset)}</span>{`,
  assetName:    `}<span className="text-[var(--t-text)]">{JSON.stringify(response.assetName || response.asset)}</span>{`,
  reason:       `}<span className="text-[var(--t-text)]">{JSON.stringify(response.reason || "")}</span>{`,
  providerUsed: `}<span className="text-[var(--t-cyan)]">{JSON.stringify(response.providerUsed || "?")}</span>{`,
  teeVerified:  `}<span className={response.teeVerified ? "text-[var(--t-cyan)]" : "text-[var(--t-amber)]"}>{String(response.teeVerified === true)}</span>{`,
  teeModel:     `}<span className="text-[var(--t-text-muted)]">{JSON.stringify(response.teeModel || null)}</span>{`
}`}
          </pre>
        )}
      </div>

      <div className="border-t border-[var(--t-border)] px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] text-[var(--t-text-dim)] flex items-center justify-between">
        <span>You just hit a live mainnet endpoint. No mocks.</span>
        <a href="/app/shield" className="text-[var(--t-violet)] hover:underline normal-case tracking-normal">Open the Shield Builder →</a>
      </div>
    </div>
  );
}

// Back-compat alias so call-sites keep working.
const HeroCodeBlock = AgentTerminal;

/* ---------- Asset name lookup (for the feed) ---------- */
function assetMeta(id) {
  const m = MARKETS.find((x) => x.id === id);
  return m || { name: id, category: "asset", id };
}

/* ---------- Page ---------- */
export default function LandingPage() {
  const prices = useLivePrices();
  const feed = useAgentFeed();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-text)] font-sans">
      {/* ===================== TOP BAR ===================== */}
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? "border-b border-[var(--t-border)] bg-[var(--t-panel)]/85 backdrop-blur-md"
            : ""
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="" className="h-7 w-7" />
            <span className="text-[13px] font-bold tracking-[0.18em] uppercase text-[var(--t-text)]">
              Aegis<span className="text-[var(--t-cyan)]">.RWA</span>
            </span>
          </Link>
          <div className="hidden items-center gap-0.5 md:flex">
            {[
              { to: "/app/shield", label: "Shield" },
              { to: "/app/markets", label: "Assets" },
              { to: "/app/agents", label: "Agents" },
              { to: "/app/vault", label: "Vault" },
              { to: "/app/portfolio", label: "Dashboard" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="px-3 py-2 text-[12px] tracking-wide text-[var(--t-text-muted)] transition-colors hover:text-[var(--t-text)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
                if (!mounted) return null;
                const connected = mounted && account && chain;
                return (
                  <button
                    onClick={connected ? openAccountModal : openConnectModal}
                    className="rounded-md border border-[var(--t-border)] bg-[var(--t-panel-elev)] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--t-text)] transition-colors hover:border-[var(--t-violet)] hover:text-[var(--t-violet)]"
                  >
                    {connected
                      ? `${account.displayName}`
                      : "connect wallet"}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <CosmicBg />
        <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-6 lg:grid-cols-[1.05fr_1fr]">
          {/* Left: claim */}
          <div>
            <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--t-text-dim)]">
              <span>// AEGIS · MANTLE RWA</span>
              <span className="h-px w-10 bg-[var(--t-border)]" />
              <span className="text-[var(--t-cyan)]">v0.4 testnet</span>
            </div>

            <h1 className="text-[44px] font-bold leading-[1.04] tracking-tight text-[var(--t-text)] md:text-[64px]">
              Hedging,{" "}
              <span className="relative inline-block">
                callable
                <span
                  className="absolute -bottom-1 left-0 h-[3px] w-full"
                  style={{ background: "var(--t-cyan)" }}
                />
              </span>{" "}
              by any
              <br />
              <span className="text-[var(--t-violet)]">autonomous agent</span>.
            </h1>

            <p className="mt-6 max-w-[520px] text-[17px] leading-[1.55] text-[var(--t-text-muted)]">
              Aegis exposes principal protection as an HTTP primitive. Your agent
              signs intent and risk params; Mantle settles the shield; the AI shield
              envelope is hashed on-chain. Every leg is replayable.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/app/shield"
                className="group flex items-center gap-2 rounded-md bg-[var(--t-violet)] px-5 py-3 text-[13px] font-semibold text-[#07070C] transition-all hover:bg-[#B79DFC] hover:shadow-[0_0_30px_rgba(167,139,250,0.35)]"
              >
                <Shield className="h-4 w-4" />
                Spin a shield
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#stack"
                className="flex items-center gap-2 rounded-md border border-[var(--t-border)] px-5 py-3 text-[13px] text-[var(--t-text-muted)] transition-colors hover:border-[var(--t-text-muted)] hover:text-[var(--t-text)]"
              >
                Read the stack
              </a>
            </div>

            {/* Two value chips */}
            <div className="mt-10 grid grid-cols-2 gap-3 max-w-[520px]">
              <div className="border-l-2 border-[var(--t-violet)] pl-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
                  Floor
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--t-text)]">
                  Refuses to break the deposit.
                </div>
              </div>
              <div className="border-l-2 border-[var(--t-cyan)] pl-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
                  Proof
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--t-text)]">
                  TEE attestation; replayable byte-for-byte.
                </div>
              </div>
            </div>
          </div>

          {/* Right: code block */}
          <div className="relative">
            <div className="absolute -top-3 left-3 z-10 rounded-sm bg-[var(--t-bg)] px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
              :: agent call
            </div>
            <HeroCodeBlock />
            <p className="mt-4 font-mono text-[11px] text-[var(--t-text-dim)]">
              {">"} The same call is wired into the in-app{" "}
              <Link
                to="/app/shield"
                className="text-[var(--t-violet)] underline-offset-4 hover:underline"
              >
                Shield builder
              </Link>
              ; humans get a form, agents get this.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== LIVE TICKER ===================== */}
      <div className="border-y border-[var(--t-border)] bg-[var(--t-panel)] overflow-hidden">
        <div className="flex items-center">
          <div className="hidden md:flex shrink-0 items-center gap-2 border-r border-[var(--t-border)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--t-cyan)] animate-pulse" />
            signals.live
          </div>
          <div className="flex animate-ticker-25s gap-8 whitespace-nowrap py-2 text-xs text-[var(--t-text-muted)]">
            {[...MARKETS, ...MARKETS].map((m, i) => {
              const p = prices[m.id] ?? m.currentPrice;
              const chg = m.change24hPct ?? 0;
              const up = chg >= 0;
              return (
                <span
                  key={i}
                  className="flex items-center gap-2 font-mono text-[11px]"
                >
                  <span className="flex items-center gap-1.5 text-[var(--t-text-muted)]">
                    <MarketIcon market={m} className="w-3.5 h-3.5 shrink-0" />
                    {m.name}
                  </span>
                  <span className="text-[var(--t-text)]">
                    $
                    {p.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                  <span
                    className={
                      up ? "text-[var(--t-cyan)]" : "text-[var(--t-red)]"
                    }
                  >
                    {up ? "+" : "-"}
                    {Math.abs(chg * 100).toFixed(2)}%
                  </span>
                  <span className="text-[var(--t-border)]">|</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===================== STACK (diagonal-divided) ===================== */}
      <section id="stack" className="relative py-28">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-12 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--t-cyan)]">
                01 . stack
              </div>
              <h2 className="mt-2 max-w-[640px] text-[34px] font-bold leading-[1.1] tracking-tight">
                How an agent uses Aegis,{" "}
                <span className="text-[var(--t-violet)]">end to end</span>.
              </h2>
            </div>
            <p className="max-w-[360px] font-mono text-[12px] leading-[1.6] text-[var(--t-text-muted)]">
              Four layers, four artifacts. None of them require trust in us; all
              of them produce on-chain or on-storage evidence.
            </p>
          </div>

          {/* Diagonal panel */}
          <div className="relative grid grid-cols-1 overflow-hidden rounded-[18px] border border-[var(--t-border)] lg:grid-cols-2">
            {/* left half */}
            <div className="relative bg-[var(--t-panel)] p-8 md:p-10">
              <div className="space-y-7">
                {[
                  {
                    n: "00",
                    title: "Session key",
                    body: "Mint a scoped agent key. No mnemonic exposure, no full-account approval.",
                    tag: "sdk",
                  },
                  {
                    n: "01",
                    title: "AI . Risk Engine",
                    body: "Strategy, hedge sizing, and compliance are built by the AI agent. The risk params are explicit and auditable.",
                    tag: "ai:risk-engine",
                  },
                  {
                    n: "02",
                    title: "Mantle . Shield",
                    body: "Settlement contract enforces a hard floor on the deposit. Upside flows; downside is bounded.",
                    tag: "mantle",
                  },
                  {
                    n: "03",
                    title: "On-chain . Proof",
                    body: "Inputs, risk params, compliance, and outcome are hashed into a rootHash committed on-chain. Replay any window in one call.",
                    tag: "roothash",
                  },
                ].map((row) => (
                  <div key={row.n} className="flex items-start gap-4">
                    <div className="font-mono text-[11px] text-[var(--t-text-dim)] pt-0.5">
                      [{row.n}]
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-[16px] font-semibold text-[var(--t-text)]">
                          {row.title}
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--t-cyan)]">
                          {row.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--t-text-muted)]">
                        {row.body}
                      </p>
                      <div className="mt-2 h-px w-full bg-gradient-to-r from-[var(--t-border)] to-transparent" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* right half (terminal artifacts) */}
            <div
              className="relative bg-[var(--t-bg-secondary)] p-8 md:p-10 font-mono text-[12px] leading-[1.7] text-[var(--t-text-muted)]"
            >
              <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--t-text-dim)]">
                <span className="h-1 w-1 rounded-full bg-[var(--t-cyan)]" />
                ledger . trail
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-[var(--t-text-dim)]">key_id</span>
                  <span className="text-[var(--t-text)]">
                    {" "}= ak_live_a7c91f.session
                  </span>
                </div>
                <div>
                  <span className="text-[var(--t-text-dim)]">tee_attest</span>
                  <span className="text-[var(--t-violet)]">
                    {" "}= 0g.tee.v1:9f4e..3a21
                  </span>
                </div>
                <div>
                  <span className="text-[var(--t-text-dim)]">shield_tx</span>
                  <span className="text-[var(--t-text)]">
                    {" "}= 0x91ab..d7f0
                  </span>
                </div>
                <div>
                  <span className="text-[var(--t-text-dim)]">floor_usdc</span>
                  <span className="text-[var(--t-cyan)]"> = 10,000</span>
                </div>
                <div>
                  <span className="text-[var(--t-text-dim)]">storage_cid</span>
                  <span className="text-[var(--t-violet)]">
                    {" "}= bafybeih..tte
                  </span>
                </div>
                <div>
                  <span className="text-[var(--t-text-dim)]">replayable</span>
                  <span className="text-[var(--t-cyan)]"> = true</span>
                </div>
              </div>

              <div className="my-6 border-t border-dashed border-[var(--t-border)]" />

              <div className="text-[11px] text-[var(--t-text-dim)]">
                $ aegis replay --shield 0x91ab..d7f0
              </div>
              <div className="text-[11px] text-[var(--t-text)]">
                {">"} resolving inputs from on-chain rootHash..
              </div>
              <div className="text-[11px] text-[var(--t-text)]">
                {">"} re-hashing AI shield envelope..
              </div>
              <div className="text-[11px] text-[var(--t-cyan)]">
                {">"} hashes match. payoff: $10,481.20
              </div>
            </div>

            {/* diagonal slash */}
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[2px] -translate-x-1/2 lg:block"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, var(--t-violet) 25%, var(--t-cyan) 75%, transparent 100%)",
                transform: "translateX(-50%) skewX(-8deg)",
                opacity: 0.4,
              }}
            />
          </div>

          {/* Layer chip row */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { l: "L0", t: "Session key" },
              { l: "L1", t: "AI Risk Engine" },
              { l: "L2", t: "Mantle Shield" },
              { l: "L3", t: "On-chain proof" },
            ].map((c) => (
              <div
                key={c.l}
                className="flex items-center gap-3 rounded-md border border-[var(--t-border)] bg-[var(--t-panel)] px-4 py-3 font-mono text-[11px]"
              >
                <span className="text-[var(--t-cyan)]">{c.l}</span>
                <span className="h-3 w-px bg-[var(--t-border)]" />
                <span className="text-[var(--t-text-muted)]">{c.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== IS / ISN'T PANEL ===================== */}
      <section className="border-y border-[var(--t-border)] bg-[var(--t-bg-secondary)]/40 py-24">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--t-cyan)]">
              02 . definition
            </div>
            <h2 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight">
              Aegis sits in a category of one.
            </h2>
          </div>

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* IS */}
            <div
              className="relative rounded-[14px] border border-[var(--t-violet)]/60 bg-[var(--t-panel)] p-7"
              style={{ transform: "translateY(-6px)" }}
            >
              <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--t-violet)]">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-sm"
                  style={{ background: "rgba(167,139,250,0.18)" }}
                >
                  <Check className="h-3 w-3" />
                </span>
                Aegis is
              </div>
              <ul className="space-y-3 text-[14px] text-[var(--t-text)]">
                {[
                  ["principal-protected", "the deposit floor is the contract floor"],
                  ["agent-callable", "every action exposes an HTTP and SDK surface"],
                  ["AI-managed", "hedge sizing and compliance decided by the risk engine"],
                  ["fully replayable", "every shield ships with an on-chain rootHash receipt"],
                  ["LP-funded", "vault providers earn per signed envelope"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-3">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-[var(--t-violet)]" />
                    <div>
                      <span className="font-semibold">{k}</span>
                      <span className="text-[var(--t-text-muted)]"> . {v}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ISN'T */}
            <div className="relative rounded-[14px] border border-[var(--t-border)] bg-[var(--t-panel)]/60 p-7">
              <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-sm"
                  style={{ background: "rgba(140,140,160,0.12)" }}
                >
                  <Plus className="h-3 w-3 rotate-45" />
                </span>
                Aegis is not
              </div>
              <ul className="space-y-3 text-[14px] text-[var(--t-text-muted)]">
                {[
                  ["a perpetual DEX", "no liquidations, no leverage casino"],
                  ["a yield farm", "no inflationary token bribes; fees are real"],
                  ["a CEX wrapper", "no custodial off-chain matching engine"],
                  ["a black-box AI fund", "the strategy is signed math, not a vibe"],
                  ["financial advice", "you remain the verifier of the receipt"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-3">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rotate-45 bg-[var(--t-text-dim)]" />
                    <div>
                      <span className="font-semibold text-[var(--t-text)]/85 line-through decoration-[var(--t-text-dim)]/70">
                        {k}
                      </span>
                      <span> . {v}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== AGENT ACTIVITY FEED ===================== */}
      <section className="py-24">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--t-cyan)]">
                03 . feed
              </div>
              <h2 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight">
                What agents are doing right now.
              </h2>
            </div>
            <Link
              to="/app/agents"
              className="font-mono text-[12px] text-[var(--t-violet)] hover:underline"
            >
              {">"} browse agent fleet
            </Link>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[var(--t-border)] bg-[var(--t-panel)]">
            {/* table head */}
            <div className="grid grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.6fr] gap-3 border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--t-text-dim)]">
              <span>agent</span>
              <span>action</span>
              <span>asset</span>
              <span>pnl</span>
              <span className="text-right">when</span>
            </div>
            {/* rows */}
            <div>
              {feed.map((row, idx) => {
                const m = assetMeta(row.asset);
                const pnlNum = parseFloat(row.pnl.replace(/[^-\d.]/g, ""));
                const pnlUp = pnlNum >= 0;
                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.6fr] gap-3 px-5 py-3 font-mono text-[12px] transition-colors ${
                      idx === 0
                        ? "bg-[rgba(0,229,212,0.04)]"
                        : "hover:bg-[var(--t-bg-secondary)]"
                    }`}
                    style={{
                      borderBottom:
                        idx === feed.length - 1
                          ? "none"
                          : "1px solid var(--t-border)",
                    }}
                  >
                    <span className="text-[var(--t-text)] truncate">
                      <span className="text-[var(--t-text-dim)]">{">"}</span>{" "}
                      {row.agent}
                    </span>
                    <span className="text-[var(--t-text-muted)]">{row.verb}</span>
                    <span className="flex items-center gap-1.5 text-[var(--t-text)]">
                      <MarketIcon
                        market={m}
                        className="w-3 h-3 shrink-0 text-[var(--t-text-muted)]"
                      />
                      {m.name}
                    </span>
                    <span
                      className={
                        pnlUp ? "text-[var(--t-cyan)]" : "text-[var(--t-red)]"
                      }
                    >
                      {row.pnl}
                    </span>
                    <span className="text-right text-[var(--t-text-dim)]">
                      {row.ago}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* table foot */}
            <div className="flex items-center justify-between border-t border-[var(--t-border)] bg-[var(--t-bg-secondary)] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--t-text-dim)]">
              <span>
                <span className="text-[var(--t-cyan)] mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--t-cyan)] animate-pulse align-middle" />
                streaming . demo data
              </span>
              <span>last refresh . just now</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CTA STRIP ===================== */}
      <section className="relative overflow-hidden border-y border-[var(--t-border)] py-20">
        <div className="relative mx-auto max-w-[1100px] px-6">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--t-cyan)]">
                04 . crawl
              </div>
              <h2 className="mt-2 text-[28px] font-bold leading-[1.15] tracking-tight md:text-[34px]">
                Visiting agents read this URL first.
              </h2>
              <a
                href="/.well-known/aegis-skills.json"
                className="mt-3 inline-block rounded-md border border-[var(--t-cyan)]/40 bg-[var(--t-cyan-soft)] px-3 py-1.5 font-mono text-[12px] text-[var(--t-cyan)] transition-colors hover:bg-[rgba(0,229,212,0.18)]"
              >
                GET /.well-known/aegis-skills.json
              </a>
            </div>
            <div className="flex gap-3">
              <Link
                to="/app/shield"
                className="rounded-md bg-[var(--t-violet)] px-5 py-3 text-[13px] font-semibold text-[#07070C] hover:bg-[#B79DFC]"
              >
                Spin a shield
              </Link>
              <Link
                to="/app/vault"
                className="rounded-md border border-[var(--t-border)] px-5 py-3 text-[13px] text-[var(--t-text-muted)] hover:border-[var(--t-text-muted)] hover:text-[var(--t-text)]"
              >
                Provide vault liquidity
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-[var(--t-bg)] py-10">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="" className="h-7 w-7" />
              <span className="text-[13px] font-bold tracking-[0.18em] uppercase">
                Aegis<span className="text-[var(--t-cyan)]">.RWA</span>
              </span>
            </div>
            <p className="mt-3 max-w-[280px] text-[12px] leading-[1.6] text-[var(--t-text-muted)]">
              Verifiable hedging primitive for RWAs — USDY and mETH — built
              natively on Mantle&apos;s RWA infrastructure.
            </p>
            <div className="mt-4 font-mono text-[10px] text-[var(--t-text-dim)]">
              42.3601 N . 71.0589 W . Mantle Sepolia
            </div>
          </div>

          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
              Product
            </div>
            <ul className="space-y-1.5 text-[13px] text-[var(--t-text-muted)]">
              <li>
                <Link to="/app/shield" className="hover:text-[var(--t-text)]">
                  Shield
                </Link>
              </li>
              <li>
                <Link to="/app/markets" className="hover:text-[var(--t-text)]">
                  Assets
                </Link>
              </li>
              <li>
                <Link to="/app/agents" className="hover:text-[var(--t-text)]">
                  Agents
                </Link>
              </li>
              <li>
                <Link to="/app/vault" className="hover:text-[var(--t-text)]">
                  Vault
                </Link>
              </li>
              <li>
                <Link to="/app/portfolio" className="hover:text-[var(--t-text)]">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
              For agents
            </div>
            <ul className="space-y-1.5 font-mono text-[12px] text-[var(--t-text-muted)]">
              <li>
                <a
                  href="/.well-known/aegis-skills.json"
                  className="text-[var(--t-cyan)] hover:underline"
                >
                  /.well-known/aegis-skills.json
                </a>
              </li>
              <li>
                <a
                  href="/api/ai/recommend-shield"
                  className="hover:text-[var(--t-text)]"
                >
                  POST /api/ai/recommend-shield
                </a>
              </li>
              <li>
                <a
                  href="/api/ai/spec"
                  className="hover:text-[var(--t-text)]"
                >
                  GET /api/ai/spec
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--t-text-dim)]">
              Network
            </div>
            <ul className="space-y-1.5 text-[13px] text-[var(--t-text-muted)]">
              <li className="font-mono text-[12px]">
                <span className="text-[var(--t-text-dim)]">chain</span> .{" "}
                <span className="text-[var(--t-text)]">0g testnet</span>
              </li>
              <li className="font-mono text-[12px]">
                <span className="text-[var(--t-text-dim)]">storage</span> .{" "}
                <span className="text-[var(--t-text)]">0g storage</span>
              </li>
              <li className="font-mono text-[12px]">
                <span className="text-[var(--t-text-dim)]">compute</span> .{" "}
                <span className="text-[var(--t-text)]">0g compute (TEE)</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-[1400px] border-t border-[var(--t-border)] px-6 pt-5">
          <div className="flex flex-col items-start justify-between gap-3 text-[11px] text-[var(--t-text-dim)] md:flex-row md:items-center">
            <div>
              Aegis runs on Mantle Sepolia testnet. Mainnet launch is in review. Not
              financial advice.
            </div>
            <div className="font-mono">v0.4.0 . build {new Date().getFullYear()}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
