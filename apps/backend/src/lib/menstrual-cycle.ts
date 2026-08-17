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

/**
 * Vocabulário único de fases — o mesmo que o produto já usava em
 * `computeMenstrualModulator`. Não é jargão clínico de propósito: "fase lútea"
 * não diz nada para quem lê, e o que importa não é o nome da fase, é o que ela
 * faz com humor e energia.
 */
export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal_early'
  | 'luteal_late'
  | 'unknown';

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
  /**
   * Desvio esperado sobre o baseline pessoal. É tendência da fase, nunca
   * afirmação sobre como ela está — o registro dela sempre ganha.
   */
  energyModifier: number;
  moodModifier: number;
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
  menstrual: 'Menstruação',
  follicular: 'Pós-menstruação',
  ovulatory: 'Ovulação',
  luteal_early: 'Pós-ovulação',
  luteal_late: 'TPM',
  unknown: 'Ciclo sem leitura',
};

/**
 * O que cada fase faz com humor e energia — a razão de calcular o ciclo.
 *
 * Saber que hoje é "dia 22" não muda nada; saber que a irritabilidade tende a
 * subir muda o tamanho do dia que a Airia propõe. Os valores vêm do modulador
 * que o produto já usava, e o desvio é aplicado sobre o baseline pessoal, nunca
 * como afirmação sobre como ela está — é tendência, e ela pode contrariar.
 */
const PHASE_EFFECT: Record<CyclePhase, { energy: number; mood: number; effect: string }> = {
  menstrual: {
    energy: -0.5,
    mood: -0.3,
    effect: 'a energia costuma ficar mais baixa e a sensibilidade mais alta',
  },
  follicular: {
    energy: 0.3,
    mood: 0.2,
    effect: 'a energia e a clareza tendem a subir',
  },
  ovulatory: {
    energy: 0.5,
    mood: 0.3,
    effect: 'costuma ser o pico de energia e disposição do seu ciclo',
  },
  luteal_early: {
    energy: 0,
    mood: 0,
    effect: 'é a parte mais estável do seu ciclo',
  },
  luteal_late: {
    energy: -0.3,
    mood: -0.4,
    effect: 'a irritabilidade tende a subir e a paciência a encurtar',
  },
  unknown: { energy: 0, mood: 0, effect: '' },
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

/**
 * Fronteiras derivadas da duração REAL do ciclo dela.
 *
 * O modulador anterior cortava em dias fixos — menstruação até 5,
 * pós-menstruação até 13, ovulação 14 a 16, pós-ovulação até 22, TPM depois —
 * o que só está certo para quem tem exatamente 28 dias.
 *
 * Num ciclo de 35 dias a ovulação cai por volta do dia 21. As fronteiras fixas
 * chamavam esse dia de "pós-ovulação" (modificador `0`) e o dia 23 de "TPM"
 * (modificador negativo) — **o sinal invertido bem no pico de energia dela**.
 * Em ciclo curto acontece o espelho: a pessoa entra em TPM e o app ainda acha
 * que está na fase estável.
 *
 * A âncora é a ovulação em `duração − 14`, pelo mesmo motivo da previsão: a
 * fase lútea tem duração estável e a folicular é a que estica ou encolhe.
 */
export function phaseFor(cycleDay: number, cycleLength: number): CyclePhase {
  const ovulationDay = cycleLength - LUTEAL_DAYS;

  if (cycleDay <= 5) return 'menstrual';
  if (Math.abs(cycleDay - ovulationDay) <= 2) return 'ovulatory';
  if (cycleDay < ovulationDay) return 'follicular';
  if (cycleDay > cycleLength - 5) return 'luteal_late';
  return 'luteal_early';
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
      phase: 'unknown',
      phaseLabel: PHASE_LABEL.unknown,
      averageCycleLength: null,
      variability: null,
      observedCycles: 0,
      confidence: 'nenhuma',
      prediction: null,
      askFlowStart: true,
      energyModifier: 0,
      moodModifier: 0,
      summary: 'Ainda não sei onde você está no ciclo. Me diga quando a menstruação começar e eu acompanho daqui.',
    };
  }

  const elapsed = daysBetween(lastStart, input.today);
  const cycleDay = elapsed + 1;
  const workingLength = averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const phase: CyclePhase = cycleDay > MAX_PLAUSIBLE_CYCLE ? 'unknown' : phaseFor(cycleDay, workingLength);

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

  /**
   * A frase diz o EFEITO, não o rótulo. "Fase lútea" não informa nada; "a
   * irritabilidade tende a subir" muda o que ela espera do próprio dia — e é
   * exatamente para isso que o ciclo é calculado.
   *
   * Sem duração medida, o texto declara que a leitura é estimada em vez de
   * apresentar 28 dias como se fosse o ciclo dela.
   */
  const effect = PHASE_EFFECT[phase];
  const estimated = averageCycleLength === null ? ' Ainda é estimativa: preciso de mais um ciclo pra acertar o seu ritmo.' : '';
  const summary = phase === 'unknown'
    ? `Faz ${elapsed} dias desde o último registro de fluxo — perdi o fio do ciclo. Quando a menstruação vier, me avise.`
    : `Dia ${cycleDay} do seu ciclo: ${effect.effect}.${estimated}`;

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
    energyModifier: effect.energy,
    moodModifier: effect.mood,
    summary,
  };
}
