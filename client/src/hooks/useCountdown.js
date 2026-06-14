import { useEffect, useState } from 'react';

export function useCountdown(targetTimestamp) {
  const [remaining, setRemaining] = useState(
    targetTimestamp ? Math.max(0, targetTimestamp - Date.now()) : 0
  );

  useEffect(() => {
    if (!targetTimestamp) return;

    const tick = () => {
      const diff = Math.max(0, targetTimestamp - Date.now());
      setRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return {
    remaining,
    days,
    hours,
    minutes,
    seconds,
    expired: remaining <= 0,
    formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
  };
}
