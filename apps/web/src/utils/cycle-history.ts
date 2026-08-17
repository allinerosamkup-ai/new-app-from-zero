/**
 * Leitura mínima do ciclo no cliente — só o suficiente para decidir se vale
 * perguntar alguma coisa hoje.
 *
 * O cálculo completo (fase, previsão, janela fértil) mora no backend, em
 * `lib/menstrual-cycle.ts`, que é a fonte de verdade. Aqui não se recalcula
 * nada disso: a tela só precisa saber se está perto da janela esperada, e
 * buscar o servidor antes de desenhar um campo opcional atrasaria a abertura do
 * check-in em troca de nada.
 *
 * As regras de agrupamento são as mesmas do backend de propósito — dias
 * seguidos de fluxo são uma menstruação só, e intervalo fora do plausível é
 * lacuna de registro, não ciclo.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_PLAUSIBLE_CYCLE = 21;
const MAX_PLAUSIBLE_CYCLE = 45;

type HistoryEntry = { localDate?: string; recordedAt?: string; isFlowing?: boolean };

function dayKey(value: string): string {
  return value.slice(0, 10);
}

/** Datas de início de fluxo, da mais antiga para a mais recente. */
export function cycleFlowStarts(history: readonly HistoryEntry[]): string[] {
  const flowing = [...new Set(
    history
      .filter((entry) => entry.isFlowing === true)
      .map((entry) => dayKey(entry.localDate ?? entry.recordedAt ?? ""))
      .filter(Boolean),
  )].sort();

  const starts: string[] = [];
  let previous: string | null = null;
  for (const day of flowing) {
    // Mais de 3 dias desde o anterior = outro episódio. Abaixo disso é a mesma
    // menstruação, com ou sem falha de registro no meio.
    if (!previous || (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / DAY_MS > 3) {
      starts.push(day);
    }
    previous = day;
  }
  return starts;
}

export function daysSinceISO(day: string, today = new Date()): number {
  const from = Date.parse(`${dayKey(day)}T00:00:00Z`);
  const to = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

/** Duração média dos ciclos observados. `null` até haver um ciclo fechado. */
export function averageCycleLength(starts: readonly string[]): number | null {
  const lengths: number[] = [];
  for (let index = 1; index < starts.length; index += 1) {
    const length = daysSinceISO(starts[index - 1], new Date(`${starts[index]}T00:00:00Z`));
    if (length >= MIN_PLAUSIBLE_CYCLE && length <= MAX_PLAUSIBLE_CYCLE) lengths.push(length);
  }
  if (lengths.length === 0) return null;
  return Math.round(lengths.reduce((total, value) => total + value, 0) / lengths.length);
}
