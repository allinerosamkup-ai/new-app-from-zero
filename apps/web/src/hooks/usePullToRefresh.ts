import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 64; // px necessários para disparar o refresh
const ACTIVATION_DISTANCE = 22;

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const tracking = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const el = containerRef.current ?? document.documentElement;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
        tracking.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || isRefreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      const deltaX = startX.current === null ? 0 : e.touches[0].clientX - startX.current;
      const isVerticalPull = delta > ACTIVATION_DISTANCE && delta > Math.abs(deltaX) * 1.4;

      if (isVerticalPull && el.scrollTop === 0) {
        tracking.current = true;
      }

      if (tracking.current && delta > 0 && el.scrollTop === 0) {
        e.preventDefault();
        setPullDistance(Math.min(delta * 0.4, THRESHOLD + 20));
      }
    };

    const onTouchEnd = async () => {
      if (pullDistanceRef.current >= THRESHOLD && !isRefreshingRef.current) {
        setIsRefreshing(true);
        setPullDistance(0);
        try {
          await onRefreshRef.current();
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
      startY.current = null;
      startX.current = null;
      tracking.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const isReady = pullDistance >= THRESHOLD;

  return { containerRef, pullDistance, isRefreshing, isReady };
}
