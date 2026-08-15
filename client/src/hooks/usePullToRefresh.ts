import { useEffect, useRef, useState } from "react";

/**
 * Provides a restrained, touch-only refresh gesture for top-level mobile views.
 * It only activates when the document is already at its scroll origin.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 84) {
  const refreshRef = useRef(onRefresh);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 4 || event.touches.length !== 1 || refreshing) return;
      startY.current = event.touches[0].clientY;
      active.current = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!active.current || startY.current === null) return;
      const next = Math.max(0, event.touches[0].clientY - startY.current);
      if (next <= 0) return;
      setPullDistance(Math.min(next, threshold + 28));
      if (next > 10) event.preventDefault();
    };
    const onTouchEnd = () => {
      const shouldRefresh = active.current && pullDistance >= threshold;
      active.current = false;
      startY.current = null;
      setPullDistance(0);
      if (!shouldRefresh) return;
      setRefreshing(true);
      Promise.resolve(refreshRef.current()).finally(() => setRefreshing(false));
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshing, threshold]);

  return {
    pullDistance,
    refreshing,
    ready: pullDistance >= threshold,
  };
}
