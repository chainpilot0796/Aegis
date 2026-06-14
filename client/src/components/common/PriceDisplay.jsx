import { formatPrice, formatPercent } from '../../lib/utils';
import { usePriceFlash } from '../../hooks/usePriceFlash';

export default function PriceDisplay({ price, change24h, symbol, size = 'md' }) {
  const flashClass = usePriceFlash(price);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${flashClass}`}>
      {symbol && (
        <span className="text-[var(--t-text-muted)] text-xs uppercase tracking-[0.1em]">
          {symbol}
        </span>
      )}
      <span className={`font-bold ${sizeClasses[size]}`}>
        {formatPrice(price)}
      </span>
      {change24h != null && (
        <span
          className={`text-xs font-medium ${
            change24h >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'
          }`}
        >
          {formatPercent(change24h)}
        </span>
      )}
    </div>
  );
}
