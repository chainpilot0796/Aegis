import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Liveline } from 'liveline';
import { formatPrice, formatMarketPrice, formatPercent } from '../lib/utils';
import { usePriceFlash } from '../hooks/usePriceFlash';
import MarketIcon from './MarketIcon';

function toChartPoints(apiResponse) {
  const data = apiResponse?.history || apiResponse?.data || apiResponse;
  if (!Array.isArray(data) || data.length === 0) return [];
  const toUnixSec = (ts, fallback) => {
    if (ts != null) {
      if (typeof ts === 'number') return ts < 1e12 ? ts : ts / 1000;
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms)) return ms / 1000;
    }
    return fallback != null ? new Date(fallback).getTime() / 1000 : NaN;
  };
  const sampled =
    data.length > 300
      ? data.filter((_, i) => i % Math.ceil(data.length / 300) === 0 || i === data.length - 1)
      : data;
  return sampled
    .map((h) => ({ time: toUnixSec(h.timestamp, h.date), value: Number(h.price) }))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
}

function AssetCard({
  asset,
  selected,
  onSelect,
  price,
  change24h,
  tagline,
  onHoverStart,
  onHoverEnd,
  enableHoverChart,
}) {
  const flashClass = usePriceFlash(price);
  const hoverDelayRef = useRef(null);
  const leaveDelayRef = useRef(null);

  const handleMouseEnter = () => {
    if (leaveDelayRef.current) {
      clearTimeout(leaveDelayRef.current);
      leaveDelayRef.current = null;
    }
    if (!enableHoverChart) return;
    hoverDelayRef.current = setTimeout(() => {
      onHoverStart?.(asset);
      hoverDelayRef.current = null;
    }, 350);
  };

  const handleMouseLeave = () => {
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current);
      hoverDelayRef.current = null;
    }
    leaveDelayRef.current = setTimeout(() => {
      onHoverEnd?.();
      leaveDelayRef.current = null;
    }, 150);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => onSelect(asset)}
        className={`t-panel p-3 text-left transition-all w-full h-full ${flashClass} ${
          selected
            ? 'border-[var(--t-blue)] bg-[var(--t-bg-secondary)]'
            : 'hover:border-[var(--t-blue)]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <MarketIcon market={asset} className="w-5 h-5 text-[var(--t-text-muted)] shrink-0" />
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--t-text)]">
            {asset.name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">
            {price != null ? formatMarketPrice(price, asset) : '---'}
          </span>
          {change24h != null && (
            <span
              className={`text-[0.65rem] ${
                change24h >= 0 ? 'text-[var(--t-green)]' : 'text-[var(--t-red)]'
              }`}
            >
              {formatPercent(change24h)}
            </span>
          )}
        </div>
        <p className="text-[0.6rem] text-[var(--t-text-muted)] mt-1 truncate leading-tight">
          {asset.category === 'real_estate' ? '$/sqft index · Parcl Labs' : tagline || asset.category}
        </p>
        {selected && (
          <div className="mt-1 text-[0.55rem] text-[var(--t-green)] uppercase tracking-[0.1em]">
            &#9656; SELECTED
          </div>
        )}
      </button>
    </div>
  );
}

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 220;

function ChartPopover({ asset, chartData, chartLoading, currentPrice, rect, onMouseEnter, onMouseLeave }) {
  const isEmpty = !chartData?.length;
  const windowSec =
    chartData?.length >= 2
      ? Math.max(chartData[chartData.length - 1].time - chartData[0].time, 60)
      : 60;
  const value = currentPrice ?? (chartData?.length ? chartData[chartData.length - 1].value : 0);
  const isRealEstate = asset?.category === 'real_estate';

  // Position above the card when possible so we don't cover the grid; otherwise below. Keep horizontal in viewport.
  let style = { left: 0, top: 0 };
  if (rect && typeof window !== 'undefined') {
    const gap = 8;
    const left = Math.max(gap, Math.min(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, window.innerWidth - POPOVER_WIDTH - gap));
    const aboveTop = rect.top - POPOVER_HEIGHT - gap;
    const belowTop = rect.bottom + gap;
    const top = aboveTop >= gap ? aboveTop : belowTop;
    style = { left, top };
  }

  const popover = (
    <div
      className="fixed z-[100] rounded-lg border border-[var(--t-border)] bg-[var(--t-panel)] shadow-lg p-3 font-sans"
      style={{
        width: POPOVER_WIDTH,
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="text-[0.6rem] text-[var(--t-text-muted)] uppercase tracking-wider mb-2">
        Perps price — {asset?.name}
      </div>
      <div className="h-[180px] min-h-[180px] -mx-1">
        {chartLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-[var(--t-text-muted)]">
            Loading chart…
          </div>
        ) : isEmpty ? (
          <div className="h-full flex items-center justify-center text-xs text-[var(--t-text-muted)]">
            No chart data — view market page for full chart
          </div>
        ) : (
          <Liveline
            data={chartData}
            value={value}
            theme="dark"
            color="#A78BFA"
            fill={false}
            grid
            badge
            scrub
            momentum
            loading={false}
            emptyText="No data"
            window={windowSec}
            formatValue={(v) => formatMarketPrice(v, asset, isRealEstate ? 0 : 2)}
          />
        )}
      </div>
    </div>
  );

  return createPortal(popover, document.body);
}

export default function AssetPicker({ assets, selectedAsset, onSelect, prices = {}, api, taglines = {} }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredRect, setHoveredRect] = useState(null);
  const [chartCache, setChartCache] = useState({});
  const leaveTimeoutRef = useRef(null);
  const enableHoverChart = !!api;

  const hoveredAsset = hoveredId ? assets.find((a) => a.id === hoveredId) : null;
  const hoveredPrice = hoveredId ? prices[hoveredId]?.price : null;
  const cache = hoveredId ? chartCache[hoveredId] : null;

  useEffect(() => {
    if (!hoveredId || !api) return;
    if (chartCache[hoveredId] !== undefined) return;
    setChartCache((prev) => ({ ...prev, [hoveredId]: { loading: true, data: null } }));
    api
      .get(`/api/markets/${hoveredId}/chart?timeframe=1m`)
      .then((res) => {
        const points = toChartPoints(res);
        setChartCache((prev) => ({ ...prev, [hoveredId]: { loading: false, data: points } }));
      })
      .catch(() => {
        setChartCache((prev) => ({ ...prev, [hoveredId]: { loading: false, data: [] } }));
      });
  }, [hoveredId, api]);

  const handleHoverStart = (asset) => {
    setHoveredId(asset.id);
    const el = document.querySelector(`[data-asset-card="${asset.id}"]`);
    if (el) {
      setHoveredRect(el.getBoundingClientRect());
    }
  };

  const handleHoverEnd = () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredId(null);
      setHoveredRect(null);
      leaveTimeoutRef.current = null;
    }, 200);
  };

  const handlePopoverMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {assets.map((asset) => (
          <div key={asset.id} data-asset-card={asset.id}>
            <AssetCard
              asset={asset}
              selected={selectedAsset?.id === asset.id}
              onSelect={onSelect}
              price={prices[asset.id]?.price}
              change24h={prices[asset.id]?.change24h}
              tagline={taglines[asset.id]}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              enableHoverChart={enableHoverChart}
            />
          </div>
        ))}
      </div>
      {enableHoverChart && hoveredAsset && (
        <ChartPopover
          asset={hoveredAsset}
          chartData={cache?.data ?? null}
          chartLoading={cache?.loading ?? true}
          currentPrice={hoveredPrice}
          rect={hoveredRect}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handleHoverEnd}
        />
      )}
    </>
  );
}
