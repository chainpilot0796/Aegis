export default function YieldSourceCards({ rates }) {
  const defaultRates = rates || [
    { name: 'Morpho', protocol: 'morpho', apy: 8.2, best: true },
    { name: 'Aave', protocol: 'aave', apy: 5.4, best: false },
    { name: 'Moonwell', protocol: 'moonwell', apy: 6.1, best: false },
  ];

  const bestApy = Math.max(...defaultRates.map((r) => r.apy));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {defaultRates.map((source) => {
        const isBest = source.apy === bestApy || source.best;
        return (
          <div
            key={source.name}
            className={`rounded-lg border p-4 font-sans ${
              isBest
                ? 'border-[var(--t-blue)] bg-[var(--t-bg-secondary)]'
                : 'border-[var(--t-border)] bg-[var(--t-panel)]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[var(--t-text-muted)]">{source.name}</span>
              {isBest && (
                <span className="text-xs font-medium text-[var(--t-blue)] bg-[var(--t-blue)]/10 px-2 py-0.5 rounded">
                  Best rate
                </span>
              )}
            </div>
            <div className={`text-xl font-bold ${isBest ? 'text-[var(--t-blue)]' : 'text-[var(--t-text)]'}`}>
              {source.apy?.toFixed(1)}%
            </div>
            <div className="text-xs text-[var(--t-text-muted)] mt-0.5">
              Estimated annual return
            </div>
          </div>
        );
      })}
    </div>
  );
}
