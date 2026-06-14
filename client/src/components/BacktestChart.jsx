import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatPrice } from '../lib/utils';

export default function BacktestChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="t-panel p-6 text-center">
        <div className="text-[var(--t-text-dim)] text-xs uppercase tracking-[0.1em]">
          // NO BACKTEST DATA AVAILABLE
        </div>
      </div>
    );
  }

  const depositValue = data[0]?.deposit ?? data[0]?.principal ?? 0;

  return (
    <div className="t-panel p-4">
      <div className="t-panel-header mb-4 px-0 border-0">
        [PANEL] 90-DAY BACKTEST
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'Geist Mono' }}
            stroke="#1E1E2E"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'Geist Mono' }}
            stroke="#1E1E2E"
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111118',
              border: '1px solid #1E1E2E',
              borderRadius: 0,
              fontFamily: 'Geist Mono',
              fontSize: 11,
              color: '#F0F0F5',
            }}
            formatter={(value, name) => [formatPrice(value), name]}
          />
          <ReferenceLine
            y={depositValue}
            stroke="#6B7280"
            strokeDasharray="3 3"
            label={{
              value: 'DEPOSIT',
              position: 'right',
              fontSize: 9,
              fill: '#6B7280',
              fontFamily: 'Geist Mono',
            }}
          />
          <Area
            type="monotone"
            dataKey="deposit"
            stroke="#6B7280"
            fill="none"
            strokeDasharray="5 5"
            name="Deposit"
          />
          <Area
            type="monotone"
            dataKey="shieldReturn"
            stroke="var(--t-blue)"
            fill="rgba(167, 139, 250, 0.18)"
            name="Shield Return"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
