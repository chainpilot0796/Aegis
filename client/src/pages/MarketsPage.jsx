import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { MARKETS, CATEGORIES } from '../data/markets';
import { formatPrice, formatMarketPrice, formatPercent } from '../lib/utils';
import { usePriceFlash } from '../hooks/usePriceFlash';
import MarketIcon from '../components/MarketIcon';
import { ArrowUpRight, TrendingUp, TrendingDown, Search } from 'lucide-react';
import StarBorder from '../components/ui/StarBorder';

// ─── Mini sparkline bars (last 7 synthetic ticks) ─────────────────────────────
function SparkBars({ change }) {
  const isUp = change >= 0;
  const bars = useMemo(() => {
    const seed = Math.abs(Math.round(change * 100)) || 1;
    return Array.from({ length: 12 }, (_, i) => {
      const h = 20 + ((seed * (i + 1) * 17) % 60);
      return h;
    });
  }, [change]);

  return (
    <div className="flex items-end gap-[2px] h-7">
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            height: `${h}%`,
            width: '3px',
            borderRadius: '2px',
            background: isUp ? 'var(--t-blue)' : 'var(--t-red)',
            opacity: 0.3 + (i / bars.length) * 0.7,
          }}
        />
      ))}
    </div>
  );
}

// ─── Featured hero card (top 3 markets) ───────────────────────────────────────
function FeaturedCard({ market, priceData }) {
  const price = priceData?.price ?? priceData?.p;
  const change24h = priceData?.change24h ?? priceData?.c ?? 0;
  const flashClass = usePriceFlash(price);
  const isUp = change24h >= 0;

  const categoryAccent = {
    commodities: '#D97706',
    crypto: '#A78BFA',
    forex: '#A78BFA',
    real_estate: '#DC2626',
  }[market.category] || '#A78BFA';

  return (
    <Link
      to={`/app/trade/${market.id}`}
      className={`glass-card block p-5 group relative overflow-hidden hover:shadow-[0_0_24px_rgba(167,139,250,0.18)] transition-all duration-200 ${flashClass}`}
    >
      {/* accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: categoryAccent }}
      />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 border border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
            <MarketIcon market={market} className="w-5 h-5 text-[var(--t-text-muted)]" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--t-text)]">
              {market.name}
            </div>
            <div className="text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-wider mt-0.5">
              {market.category.replace('_', ' ')}
            </div>
          </div>
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-[var(--t-text-dim)] group-hover:text-[var(--t-blue)] transition-colors" />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-2xl font-bold text-[var(--t-text)] tracking-tight leading-none">
            {price != null ? formatMarketPrice(price, market) : '—'}
          </div>
          <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${isUp ? 'text-[var(--t-blue)]' : 'text-[var(--t-red)]'}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {formatPercent(change24h)}
          </div>
        </div>
        <SparkBars change={change24h} />
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--t-border)] flex gap-2">
        {market.shieldEligible && (
          <Link
            to="/app/shield"
            className="flex-1 rounded-lg border border-[var(--t-blue)] bg-[var(--t-panel)] py-2.5 text-center text-xs font-semibold text-[var(--t-blue)] hover:bg-[var(--t-bg-secondary)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Shield
          </Link>
        )}
        {market.perpEligible && (
          <Link
            to={`/app/trade/${market.id}`}
            className="flex-1 rounded-lg bg-[var(--t-blue)] py-2.5 text-center text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            Trade
          </Link>
        )}
      </div>
    </Link>
  );
}

// ─── Dense table row for remaining markets ────────────────────────────────────
function MarketRow({ market, priceData, rank }) {
  const price = priceData?.price ?? priceData?.p;
  const change24h = priceData?.change24h ?? priceData?.c ?? 0;
  const flashClass = usePriceFlash(price);
  const isUp = change24h >= 0;

  const categoryColors = {
    commodities: 't-tag-gold',
    crypto: 't-tag-blue',
    forex: 't-tag-green',
    real_estate: 't-tag-red',
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--t-border)]/60 hover:bg-[var(--t-bg-secondary)] transition-colors group ${flashClass}`}
    >
      <span className="font-mono text-[0.6rem] text-[var(--t-text-dim)] w-5 shrink-0 text-right">
        {String(rank).padStart(2, '0')}
      </span>

      <Link to={`/app/trade/${market.id}`} className="flex items-center gap-2 flex-1 min-w-0">
        <MarketIcon market={market} className="w-4 h-4 text-[var(--t-text-dim)] shrink-0" />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--t-text)] truncate">
            {market.name}
          </div>
        </div>
      </Link>

      <span className={`t-tag ${categoryColors[market.category] || ''} text-[0.45rem] hidden sm:inline-block shrink-0`}>
        {market.category.replace('_', ' ')}
      </span>

      <div className="hidden md:flex gap-2 shrink-0">
        {market.shieldEligible && (
          <Link
            to="/app/shield"
            className="rounded-lg border border-[var(--t-blue)] bg-[var(--t-panel)] px-3 py-2 text-xs font-semibold text-[var(--t-blue)] hover:bg-[var(--t-bg-secondary)] transition-colors min-w-[4.5rem] text-center"
          >
            Shield
          </Link>
        )}
        {market.perpEligible && (
          <Link
            to={`/app/trade/${market.id}`}
            className="rounded-lg bg-[var(--t-blue)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-colors min-w-[4.5rem] text-center"
          >
            Trade
          </Link>
        )}
      </div>

      <div className="font-mono text-[13px] font-bold text-[var(--t-text)] w-28 text-right shrink-0">
        {price != null ? formatMarketPrice(price, market) : '—'}
      </div>

      <div className={`font-mono text-[11px] font-semibold w-24 sm:w-28 text-right shrink-0 flex flex-col items-end gap-0.5 ${isUp ? 'text-[var(--t-blue)]' : 'text-[var(--t-red)]'}`}>
        <span>{isUp ? '▲' : '▼'} {Math.abs(change24h * 100).toFixed(2)}%</span>
        <span className="text-[9px] font-normal text-[var(--t-text-muted)]">{isUp ? 'Shield users earning extra' : 'Deposits protected'}</span>
      </div>

      <Link to={`/app/trade/${market.id}`} className="shrink-0">
        <ArrowUpRight className="w-3.5 h-3.5 text-[var(--t-text-dim)] group-hover:text-[var(--t-blue)] transition-colors" />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const { prices } = useSocket();
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = activeCategory === 'all' ? MARKETS : MARKETS.filter(m => m.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.category.includes(q));
    }
    return list;
  }, [activeCategory, search]);

  // top 3 for the featured row — always bitcoin, gold, ethereum if available, else first 3
  const FEATURED_IDS = ['bitcoin', 'gold', 'ethereum'];
  const featuredMarkets = FEATURED_IDS.map(id => MARKETS.find(m => m.id === id)).filter(Boolean);
  const tableMarkets = filtered.filter(m => !FEATURED_IDS.includes(m.id) || activeCategory !== 'all' || search.trim());
  const showFeatured = activeCategory === 'all' && !search.trim();

  // stats
  const totalMarkets = MARKETS.length;
  const upMarkets = MARKETS.filter(m => {
    const d = prices[m.id];
    const c = d?.change24h ?? d?.c ?? 0;
    return c > 0;
  }).length;

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[0.6rem] text-[var(--t-text-dim)] uppercase tracking-[0.25em] mb-0.5">
            Assets
          </div>
          <h1 className="text-lg font-bold text-[var(--t-text)] leading-none">
            {totalMarkets} assets you can earn from or trade
          </h1>
          <p className="text-[11px] text-[var(--t-text-muted)] mt-1 max-w-xl">
            Choose an asset to protect your earnings or to trade (bet on price up or down). Prices update in real time.
          </p>
          <p className="text-[10px] text-[var(--t-text-dim)] mt-0.5">
            Commodities · Crypto · Forex · Real Estate
          </p>
        </div>

        {/* live stats strip */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-[0.6rem] text-[var(--t-text-dim)] uppercase tracking-widest">Advancing</div>
            <div className="font-mono text-sm font-bold text-[var(--t-blue)]">{upMarkets}/{totalMarkets}</div>
          </div>
          <div className="w-px h-8 bg-[var(--t-border)]" />
          <div className="text-right">
            <div className="font-mono text-[0.6rem] text-[var(--t-text-dim)] uppercase tracking-widest">Declining</div>
            <div className="font-mono text-sm font-bold text-[var(--t-red)]">{totalMarkets - upMarkets}/{totalMarkets}</div>
          </div>
          <div className="w-px h-8 bg-[var(--t-border)]" />
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--t-blue)] animate-pulse" />
            <span className="font-mono text-[0.6rem] text-[var(--t-blue)] uppercase tracking-widest">Live</span>
          </div>
        </div>
      </div>

      {/* ── Controls: tabs + search ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <StarBorder
              key={cat.id}
              active={activeCategory === cat.id}
              color="#A78BFA"
              speed="4s"
            >
              <button
                onClick={() => setActiveCategory(cat.id)}
                className={`t-btn text-[0.55rem] py-1.5 px-3 ${
                  activeCategory === cat.id ? 't-btn-primary' : 't-btn-ghost'
                }`}
              >
                {cat.id === 'all' ? 'ALL' : cat.label.toUpperCase()}
              </button>
            </StarBorder>
          ))}
        </div>
        <div className="relative ml-auto">
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="t-input pl-9 py-1.5 text-[11px] w-44 h-8"
          />
        </div>
      </div>

      {/* ── Featured cards (only on "all" with no search) ── */}
      {showFeatured && (
        <div>
          <div className="text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-[0.2em] mb-2">
            Popular
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {featuredMarkets.map(market => (
              <FeaturedCard key={market.id} market={market} priceData={prices[market.id]} />
            ))}
          </div>
        </div>
      )}

      {/* ── All markets table ── */}
      <div className="glass-card overflow-hidden">
        {/* table header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
          <span className="font-mono text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-widest w-5 text-right shrink-0">#</span>
          <span className="font-mono text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-widest flex-1">Asset</span>
          <span className="font-mono text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-widest hidden sm:block">Category</span>
          <span className="font-mono text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-widest hidden md:block w-10">Type</span>
          <span className="font-mono text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-widest w-28 text-right shrink-0">Price</span>
          <span className="font-mono text-[0.55rem] text-[var(--t-text-dim)] uppercase tracking-widest w-24 sm:w-28 text-right shrink-0">24h</span>
          <span className="w-5 shrink-0" />
        </div>

        {/* rows */}
        <div>
          {(showFeatured ? tableMarkets : filtered).map((market, i) => (
            <MarketRow
              key={market.id}
              market={market}
              priceData={prices[market.id]}
              rank={i + 1}
            />
          ))}
          {(showFeatured ? tableMarkets : filtered).length === 0 && (
            <div className="px-4 py-10 text-center font-mono text-[11px] text-[var(--t-text-dim)]">
              No markets found for &quot;{search}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

