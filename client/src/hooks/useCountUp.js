import { useEffect, useRef, useState } from 'react';

export function useCountUp(target, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);
  const startTime = useRef(null);
  const startValue = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null) return;

    const start = () => {
      startValue.current = value;
      startTime.current = performance.now();

      const animate = (now) => {
        const elapsed = now - startTime.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue.current + (target - startValue.current) * eased;

        setValue(current);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    };

    const t = delay > 0 ? setTimeout(start, delay) : (start(), null);

    return () => {
      if (t != null) clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
}
