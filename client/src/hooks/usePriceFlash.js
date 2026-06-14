import { useEffect, useRef, useState } from 'react';

export function usePriceFlash(price) {
  const prevPrice = useRef(price);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (price == null || prevPrice.current == null) {
      prevPrice.current = price;
      return;
    }

    if (price > prevPrice.current) {
      setFlashClass('price-up');
    } else if (price < prevPrice.current) {
      setFlashClass('price-down');
    }

    prevPrice.current = price;

    const timer = setTimeout(() => setFlashClass(''), 600);
    return () => clearTimeout(timer);
  }, [price]);

  return flashClass;
}
