import { useState, useEffect } from 'react';

/**
 * Hook para retrasar la actualización de un valor (ej: búsquedas en vivo)
 * y evitar renders innecesarios en arrays grandes.
 */
export function useDebounce<T>(value: T, delayMs: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
