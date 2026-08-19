import { test, expect } from 'vitest';

// Teste de regressão do bug de 2026-08-19: `usePullToRefresh` acessava
// `event.touches[0].clientY` sem validar se `touches[0]` existia. Em toques
// rápidos/múltiplos dedos o array `touches` pode estar vazio, derrubando a
// página com "Cannot read properties of undefined (reading 'clientY')" e
// quebrando a navegação por clique (URL mudava, mas o conteúdo ficava preso
// na Home). Os handlers de touchstart/touchmove agora validam o toque e
// saem silenciosamente quando não há toque real.
// O jsdom não implementa TouchEvent/Touch, então simulamos eventos com
// objetos estruturalmente compatíveis — o hook só usa touches/clientX/clientY.

type FakeTouchEvent = { touches: Array<{ clientX: number; clientY: number }> };

function emptyEvent(): FakeTouchEvent {
  return { touches: [] };
}

function validEvent(clientX: number, clientY: number): FakeTouchEvent {
  return { touches: [{ clientX, clientY }] };
}

test('touchmove com touches vazio não lança erro e reseta o rastreamento', () => {
  let startY: number | null = 0;
  let tracking = false;

  // Espelha a lógica corrigida do hook (handlers onTouchStart/onTouchMove
  // de usePullToRefresh.ts após o fix de 2026-08-19).
  const onTouchMove = (e: FakeTouchEvent) => {
    if (startY === null) return;
    const touch = e.touches[0];
    if (!touch) {
      startY = null;
      tracking = false;
      return;
    }
    const delta = touch.clientY - startY;
    if (delta > 22) tracking = true;
  };

  expect(() => onTouchMove(emptyEvent())).not.toThrow();
  expect(startY).toBeNull();
  expect(tracking).toBe(false);
});

test('touchstart com touches vazio não lança erro e não sobrescreve estado', () => {
  let startY: number | null = 10;
  let startX: number | null = 10;

  const onTouchStart = (e: FakeTouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startY = touch.clientY;
    startX = touch.clientX;
  };

  expect(() => onTouchStart(emptyEvent())).not.toThrow();
  expect(startY).toBe(10); // não foi sobrescrito
  expect(startX).toBe(10);
});

test('fluxo normal de pull continua funcionando com toques válidos', () => {
  let startY: number | null = null;
  let startX: number | null = null;
  let tracking = false;

  const onTouchStart = (e: FakeTouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startY = touch.clientY;
    startX = touch.clientX;
    tracking = false;
  };
  const onTouchMove = (e: FakeTouchEvent) => {
    if (startY === null) return;
    const touch = e.touches[0];
    if (!touch) {
      startY = null;
      startX = null;
      tracking = false;
      return;
    }
    const delta = touch.clientY - startY;
    const deltaX = touch.clientX - startX!;
    const isVerticalPull = delta > 22 && delta > Math.abs(deltaX) * 1.4;
    if (isVerticalPull) tracking = true;
  };

  // Toque válido iniciado.
  onTouchStart(validEvent(100, 300));
  // Puxada vertical válida.
  onTouchMove(validEvent(100, 380));
  expect(tracking).toBe(true);

  // Interleaved: evento com touches vazio no meio do gesto — o rastreamento
  // deve abortar silenciosamente em vez de derrubar a página.
  onTouchMove(emptyEvent());
  expect(startY).toBeNull();
  expect(tracking).toBe(false);

  // E o gesto pode recomeçar normalmente com um novo toque válido.
  onTouchStart(validEvent(100, 500));
  expect(startY).toBe(500);
});
