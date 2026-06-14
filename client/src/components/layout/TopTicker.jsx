import { useSocket } from '../../hooks/useSocket';
import { formatMarketPrice, formatPercent } from '../../lib/utils';
import { MARKETS } from '../../data/markets';
import MarketIcon from '../MarketIcon';

export default function TopTicker() {
  const { prices } = useSocket();

  const tickerItems = MARKETS.map((m) => {
    const p = prices[m.id];
    return {
      id: m.id,
      market: m,
      name: m.name,
      price: p?.price ?? null,
      change24h: p?.change24h ?? 0,
    };
  }).filter((item) => item.price != null);

  // If no prices yet, show placeholder
  if (tickerItems.length === 0) {
    return (
      <div className="h-7 border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)] flex items-center overflow-hidden">
        <div className="text-[0.6rem] text-[var(--t-text-dim)] px-4 uppercase tracking-[0.1em]">
          // CONNECTING TO PRICE FEED...
        </div>
      </div>
    );
  }

  const renderItems = () =>
    tickerItems.map((item) => (
      <span key={item.id} className="inline-flex items-center gap-1.5 px-4 text-[0.65rem] whitespace-nowrap">
        <MarketIcon market={item.market} className="w-3.5 h-3.5 text-[var(--t-text-muted)] shrink-0" />
        <span className="text-[var(--t-text-muted)] uppercase">{item.name}</span>
        <span className="text-[var(--t-text)]">{formatMarketPrice(item.price, item.market)}</span>
        <span className={item.change24h >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'}>
          {formatPercent(item.change24h)}
        </span>
        <span className="text-[var(--t-text-dim)] mx-2">|</span>
      </span>
    ));

  return (
    <div className="h-7 border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)] flex items-center overflow-hidden">
      <div className="ticker-track">
        {renderItems()}
        {renderItems()}
      </div>
    </div>
  );
}
