import { useEffect, useState } from "react";

// useState that survives page reloads (saved in the browser).
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [key, value]);
  return [value, setValue];
}

export const dayStr = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
