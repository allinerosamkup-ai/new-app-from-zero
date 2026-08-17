/**
 * Ciclo menstrual — perguntar uma vez, calcular o resto.
 *
 * O que existia antes só rotulava: lia `isFlowing` dos últimos 35 dias, achava
 * o começo do episódio e devolvia um nome de fase. Não havia previsão de nada,
 * e a pergunta "está menstruada hoje?" voltava todo dia — inclusive para quem
 * marcara o primeiro dia na véspera. Registrar o mesmo fato repetidas vezes é
 * trabalho que o app deveria estar fazendo pela pessoa.
 *
 * Aqui a entrada é só o que não dá para deduzir: **a data do primeiro dia de
 * fluxo**. Duração do ciclo, dia atual, fase, próxima menstruação e janela
 * fértil saem daí.
 *
 * Método: fase lútea (da ovulação à menstruação) é a parte estável do ciclo,
 * ~14 dias; a folicular é a que varia. Por isso a ovulação é estimada para trás
 * a partir da próxima menstruação prevista, não para frente a partir da última.
 * A janela fértil são 6 dias — o dia da ovulação e os 5 anteriores, porque o
 * espermatozoide sobrevive até 5 dias e o óvulo cerca de 24h.
 *
 * **Isto não é método contraceptivo e o produto não pode sugerir que seja.**
 * A precisão do calendário depende de regularidade, e a previsão sai como
 * faixa com confiança declarada justamente para não fingir exatidão.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const LUTEAL_DAYS = 14;
const DEFAULT_CYCLE_LENGTH = 28;

/** Limites fisiológicos. Fora disso não é ciclo, é lacuna de registro. */
const MIN_PLAUSIBLE_CYCLE = 21;
const MAX_PLAUSIBLE_CYCLE = 45;

export type CyclePhase =
  | 'menstruacao'
  | 'folicular'
  | 'ovulacao'
  | 'lutea'
  | 'pre_menstrual'
  | 'desconhecida';

export type CycleConfidence = 'nenhuma' | 'provisoria' | 'estimada' | 'boa';

export type MenstrualCycleReading = {
  /** Dia do ciclo, 1 = primeiro dia de fluxo. `null` sem nenhum registro. */
  cycleDay: number | null;
  phase: CyclePhase;
  phaseLabel: string;
  /** Duração média observada. `null` até haver dois inícios registrados. */
  averageCycleLength: number | null;
  /** Amplitude entre o ciclo mais curto e o mais longo observados. */
  variability: number | null;
  observedCycles: number;
  confidence: CycleConfidence;
  /**
   * Previsões — calculadas sempre que há base, exibidas conforme a decisão de
   * produto. Faixa, nunca data cravada.
   */
  prediction: {
    nextPeriodFrom: string;
    nextPeriodTo: string;
    fertileFrom: string;
    fertileTo: string;
  } | null;
  /** Se hoje é dia de perguntar "começou?" — ver `shouldAskFlowStart`. */
  askFlowStart: boolean;
  /** Frase pronta em pt-BR sobre o momento do ciclo. */
  summary: string;
};

function dayKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number): string {
  return dayKey(new Date(toUtcDate(value).getTime() + days * DAY_MS));
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS);
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstruacao: 'Menstruação',
  folicular: 'Fase folicular',
  ovulacao: 'Ovulação',
  lutea: 'Fase lútea',
  pre_menstrual: 'Pré-menstrual',
  desconhecida: 'Ciclo sem leitura',
};

/**
 * Extrai as datas de início de fluxo a partir dos dias com fluxo registrado.
 *
 * Um dia com fluxo que vem logo depois de outro é continuação, não começo. O
 * corte é de 3 dias: intervalo menor que isso entre registros é a mesma
 * menstruação com uma falha de registro no meio.
 */
export function extractFlowStarts(flowingDays: readonly string[]): string[] {
  const unique = [...new Set(flowingDays.map((day) => dayKey(day)))].sort();
  const starts: string[] = [];
  for (const day of unique) {
    const previous = starts.length > 0 ? unique[unique.indexOf(day) - 1] : undefined;
    if (!previous || daysBetween(previous, day) > 3) starts.push(day);
  }
  return starts;
}

function cycleLengths(starts: readonly string[]): number[] {
  const lengths: number[] = [];
  for (let index = 1; index < starts.length; index += 1) {
    const length = daysBetween(starts[index - 1], starts[index]);
    // Intervalo fora do plausível é lacuna de registro, não ciclo real. Deixar
    // entrar contaminaria a média e a previsão sairia semanas errada.
    if (length >= MIN_PLAUSIBLE_CYCLE && length <= MAX_PLAUSIBLE_CYCLE) lengths.push(length);
  }
  return lengths;
}

function phaseFor(cycleDay: number, cycleLength: number): CyclePhase {
  if (cycleDay <= 5) return 'menstruacao';
  const ovulationDay = cycleLength - LUTEAL_DAYS;
  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) return 'ovulacao';
  if (cycleDay < ovulationDay) return 'folicular';
  if (cycleDay >= cycleLength - 4) return 'pre_menstrual';
  return 'lutea';
}

/**
 * Quando vale perguntar "sua menstruação começou hoje?".
 *
 * A pergunta antiga era diária e não olhava para nada. Esta só aparece perto da
 * janela prevista, ou quando faz tempo demais sem registro — que é quando a
 * resposta realmente acrescenta. Nos outros dias o app já sabe e fica quieto.
 */
export function shouldAskFlowStart(input: {
  lastFlowStart: string | null;
  averageCycleLength: number | null;
  today: string;
}): boolean {
  if (!input.lastFlowStart) return true;
  const elapsed = daysBetween(input.lastFlowStart, input.today);
  if (elapsed < MIN_PLAUSIBLE_CYCLE) return false;
  // Sem média ainda, pergunta a partir do mínimo plausível.
  if (!input.averageCycleLength) return true;
  // A partir de 3 dias antes do previsto, e segue perguntando enquanto atrasa.
  return elapsed >= input.averageCycleLength - 3;
}

export function computeMenstrualCycle(input: {
  /** Dias em que houve fluxo registrado, em qualquer ordem. */
  flowingDays: readonly string[];
  today: string;
}): MenstrualCycleReading {
  const starts = extractFlowStarts(input.flowingDays).filter((start) => start <= input.today);
  const lengths = cycleLengths(starts);
  const observedCycles = lengths.length;

  const averageCycleLength = observedCycles > 0
    ? Math.round(lengths.reduce((total, value) => total + value, 0) / observedCycles)
    : null;
  const variability = observedCycles >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;

  const confidence: CycleConfidence = observedCycles === 0
    ? 'nenhuma'
    : observedCycles === 1
      ? 'provisoria'
      : observedCycles === 2
        ? 'estimada'
        : 'boa';

  const lastStart = starts.at(-1) ?? null;
  if (!lastStart) {
    return {
      cycleDay: null,
      phase: 'desconhecida',
      phaseLabel: PHASE_LABEL.desconhecida,
      averageCycleLength: null,
      variability: null,
      observedCycles: 0,
      confidence: 'nenhuma',
      prediction: null,
      askFlowStart: true,
      summary: 'Ainda não sei onde você está no ciclo. Me diga quando a menstruação começar e eu acompanho daqui.',
    };
  }

  const elapsed = daysBetween(lastStart, input.today);
  const cycleDay = elapsed + 1;
  const workingLength = averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const phase = cycleDay > MAX_PLAUSIBLE_CYCLE ? 'desconhecida' : phaseFor(cycleDay, workingLength);

  /**
   * A faixa da previsão cresce com a irregularidade observada — e com a falta
   * de histórico. Devolver "dia 14" para quem tem dois ciclos registrados com
   * 9 dias de diferença entre eles seria precisão inventada.
   */
  const margin = observedCycles === 0
    ? null
    : Math.max(1, Math.min(7, Math.ceil((variability ?? 4) / 2)));

  const prediction = margin === null ? null : (() => {
    const nextStart = addDays(lastStart, workingLength);
    const ovulation = addDays(nextStart, -LUTEAL_DAYS);
    return {
      nextPeriodFrom: addDays(nextStart, -margin),
      nextPeriodTo: addDays(nextStart, margin),
      // Janela fértil: o dia da ovulação e os cinco anteriores.
      fertileFrom: addDays(ovulation, -5),
      fertileTo: addDays(ovulation, 1),
    };
  })();

  const summary = phase === 'desconhecida'
    ? `Faz ${elapsed} dias desde o último registro de fluxo — perdi o fio do ciclo. Quando a menstruação vier, me avise.`
    : `Dia ${cycleDay} do seu ciclo, em ${PHASE_LABEL[phase].toLowerCase()}.`;

  return {
    cycleDay,
    phase,
    phaseLabel: PHASE_LABEL[phase],
    averageCycleLength,
    variability,
    observedCycles,
    confidence,
    prediction,
    askFlowStart: shouldAskFlowStart({ lastFlowStart: lastStart, averageCycleLength, today: input.today }),
    summary,
  };
}
