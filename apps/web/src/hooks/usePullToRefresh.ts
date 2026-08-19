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
      // Touches pode estar vazio (ex.: eventos sintéticos, toque que terminou
      // durante a transição do gesto). Sem toque real não há nada a rastrear.
      const touch = e.touches[0];
      if (!touch || el.scrollTop !== 0) return;
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      tracking.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || isRefreshingRef.current) return;
      // BUG CRÍTICO (2026-08-19): sem essa guarda, `e.touches[0]` undefined
      // derrubava a página com "Cannot read properties of undefined (clientY)"
      // e quebrava a navegação por clique — a URL mudava mas o conteúdo
      // ficava preso na Home. Touches pode ser vazio em toques rápidos,
      // múltiplos dedos ou gestos do sistema.
      const touch = e.touches[0];
      if (!touch) {
        startY.current = null;
        startX.current = null;
        tracking.current = false;
        return;
      }
      const delta = touch.clientY - startY.current;
      const deltaX = startX.current === null ? 0 : touch.clientX - startX.current;
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
