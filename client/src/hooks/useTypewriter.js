import { useEffect, useState } from "react";

export function useTypewriter(text, speed = 40, delay = 0) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    const t = setTimeout(() => {
      let i = 0;
      const id = setInterval(() => {
        setDisplayed(text.slice(0, ++i));
        if (i >= text.length) clearInterval(id);
      }, speed);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [text, speed, delay]);

  return displayed;
}
