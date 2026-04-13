import { useEffect, useRef } from 'react';

/**
 * Calls `callback` immediately and then every `interval` ms while `enabled` is true.
 * Cleans up on unmount or when enabled flips to false.
 */
export function useAutoRefresh(callback, interval, enabled = true) {
  const savedCallback = useRef(callback);

  // Keep the latest callback in a ref so the interval always calls the newest version
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !interval || interval <= 0) return;

    // Call immediately on mount/enable
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, interval);

    return () => clearInterval(id);
  }, [interval, enabled]);
}
