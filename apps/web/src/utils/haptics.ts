// Haptics — feedback tátil sutil (design emocional P1).
// Regra do produto: comemorar movimento, nunca punir ausência.
// Vibrações curtas e discretas; nada de padrões longos ou alarmantes.

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* dispositivos sem suporte: silêncio */
  }
}

/** Toque leve ao pressionar um botão primário (8ms — sentido, não ouvido). */
export function tapHaptic() {
  vibrate(8);
}

/** Confirmação de pequena vitória: tarefa/hábito concluído, check-in salvo. */
export function successHaptic() {
  vibrate([12, 60, 18]);
}
