import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Small (?) icon that shows a one-sentence definition on hover.
 * Use for jargon: APY, TVL, Exposure, Shield, etc.
 * Renders tooltip in a portal with solid background to avoid transparency/stacking issues.
 */
export default function HelpTooltip({ text, className = '' }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const handleMouseEnter = () => {
    if (triggerRef.current && typeof document !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  };

  const handleMouseLeave = () => setShow(false);

  const tooltipEl = show && text && (
    <div
      className="fixed z-[9999] rounded-lg border border-[var(--t-border)] px-3 py-2 text-left text-xs font-normal leading-snug text-[var(--t-text)] shadow-xl"
      style={{
        left: position.left,
        top: position.top,
        transform: 'translateX(-50%)',
        minWidth: '180px',
        maxWidth: '260px',
        backgroundColor: '#14141F',
      }}
      role="tooltip"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-[var(--t-text-muted)]/30 text-[10px] font-bold text-[var(--t-text-muted)] hover:bg-[var(--t-blue)]/30 hover:text-[var(--t-blue)] align-middle ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={text}
      >
        ?
      </span>
      {typeof document !== 'undefined' && tooltipEl && createPortal(tooltipEl, document.body)}
    </>
  );
}
