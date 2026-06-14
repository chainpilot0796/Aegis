import { formatPrice, formatPercent } from '../lib/utils';

export default function ProjectionTable({ projections, depositAmount, exposureBudget, assetName }) {
  if (!projections || projections.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--t-border)] overflow-hidden font-sans bg-[var(--t-panel)]">
      {assetName && depositAmount > 0 && (
        <div className="px-4 py-3 bg-[var(--t-blue)]/10 border-b border-[var(--t-border)]">
          <p className="text-sm text-[var(--t-text)]">
            Your {formatPrice(depositAmount)} is safe. If {assetName} goes down, you get it all back. If it goes up, you could earn more.
          </p>
        </div>
      )}
      <div className="px-4 py-3 border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
        <h3 className="text-sm font-semibold text-[var(--t-text)]">
          If the asset price moves — what you could get
        </h3>
      </div>
      <div className="overflow-x-auto bg-[var(--t-panel)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
              <th className="text-left px-4 py-3 text-[var(--t-text-muted)] font-medium">
                Price change
              </th>
              <th className="text-right px-4 py-3 text-[var(--t-text-muted)] font-medium">
                Yield bonus
              </th>
              <th className="text-right px-4 py-3 text-[var(--t-text-muted)] font-medium">
                Total back
              </th>
              <th className="text-right px-4 py-3 text-[var(--t-text-muted)] font-medium">
                Gain
              </th>
            </tr>
          </thead>
          <tbody>
            {projections.map((row, i) => {
              const changePct = row.assetChange ?? row.change;
              const payout = row.exposurePayout ?? row.exposureReturn ?? row.payout ?? 0;
              const total = row.totalReturn ?? row.total ?? (depositAmount + payout);
              const profit = row.profitPercent ?? row.profit ?? ((total - depositAmount) / depositAmount * 100);
              const isNegative = changePct < 0;
              const isProtected = changePct === -100;

              return (
                <tr
                  key={i}
                  className={`border-b border-[var(--t-border)] last:border-0 bg-[var(--t-panel)] ${
                    isProtected ? 'bg-[var(--t-bg-secondary)]' : ''
                  }`}
                >
                  <td className={`px-4 py-3 font-medium ${isNegative ? 'text-[var(--t-red)]' : 'text-[var(--t-blue)]'}`}>
                    {formatPercent(changePct)}
                  </td>
                  <td className="text-right px-4 py-3 text-[var(--t-text)]">
                    {formatPrice(payout)}
                  </td>
                  <td className={`text-right px-4 py-3 font-medium ${
                    total >= depositAmount ? 'text-[var(--t-blue)]' : 'text-[var(--t-red)]'
                  }`}>
                    {formatPrice(total)}
                    {isProtected && (
                      <span className="ml-1 text-xs text-[var(--t-text-muted)]">(protected)</span>
                    )}
                  </td>
                  <td className={`text-right px-4 py-3 ${profit >= 0 ? 'text-[var(--t-blue)]' : 'text-[var(--t-red)]'}`}>
                    {formatPercent(profit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {exposureBudget != null && (
        <div className="px-4 py-3 border-t border-[var(--t-border)] bg-[var(--t-bg-secondary)] text-xs text-[var(--t-text-muted)]">
          Your deposit ({formatPrice(depositAmount)}) is protected. Worst case: you get your full deposit back.
        </div>
      )}
    </div>
  );
}
