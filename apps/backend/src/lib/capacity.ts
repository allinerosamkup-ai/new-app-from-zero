import type { RiskRoute } from './risk-safety';

/**
 * Capacidade do dia — uma implementação só.
 *
 * Antes disto o app calculava "quanto cabe hoje" em cinco lugares, com cinco
 * fórmulas que discordavam entre si: um ternário sobre energia em `index.ts`,
 * quatro níveis em `reasoning-context`, dois booleanos no `decision-engine`,
 * três níveis com frase pronta em `phase-capacity` e uma sexta regra inline no
 * `airia-reading`. Superfícies diferentes chegavam a respostas diferentes sobre
 * o mesmo dia — e duas telas discordando viram uma pergunta, que é exatamente o
 * que este app não pode fazer.
 *
 * A escala é a de `reasoning-context` (`protecao | baixa | media | alta`) de
 * propósito: os literais já são o tipo que `airia-operational-reasoning`
 * consome para traduzir capacidade em duração, então adotá-la não obriga
 * ninguém a reescrever nada.
 *
 * **A capacidade nunca é perguntada.** Ela é inferida aqui e a pessoa corrige
 * depois, com um toque. Pedir que ela classifique a própria capacidade é
 * `PRODUCT FAIL` — ver `docs/product/PRODUCT_CONSTITUTION.md` §3.
 */
export type CapacityLevel = 'protecao' | 'baixa' | 'media' | 'alta';

/** Do menor para o maior. É esta ordem que `shift()` percorre. */
const LEVEL_ORDER: readonly CapacityLevel[] = ['protecao', 'baixa', 'media', 'alta'] as const;

/** Sinal que participou da decisão — alimenta a frase na tela e o prompt. */
export type CapacityBasisItem = {
  signal: string;
  value: string;
  /** `decisive` fixou o nível; `supporting` só ajustou ou confirmou. */
  weight: 'decisive' | 'supporting';
};

export type CapacityCorrection = {
  direction: 'up' | 'down';
  localDate: string;
};

export type CapacitySignals = {
  moodScore?: number | null;
  energyScore?: number | null;
  phaseLabel?: string | null;

  /**
   * Sono do Health Connect. Tem precedência sobre o declarado: medida erra
   * menos que memória de quem acabou de acordar.
   */
  measuredSleepMinutes?: number | null;
  measuredSleepScore?: number | null;

  /** Sono do check-in. Só entra quando não há medida, e nunca decide sozinho. */
  declaredSleepScore?: number | null;
  declaredSleepHours?: number | null;

  intradayDirection?: 'rising' | 'falling' | 'stable' | 'oscillating' | 'insufficient_samples' | null;
  riskRoute?: RiskRoute | null;

  /** `day_hard | energy_crash | day_great | hyperfocus`, de /api/agenda/recalibrate. */
  recalibrationSignal?: string | null;

  /** Correção da própria pessoa sobre a proposta de hoje. */
  correction?: CapacityCorrection | null;
  /** Correções anteriores, para o viés entre dias. Ver `correctionBias`. */
  correctionHistory?: CapacityCorrection[] | null;

  localDate?: string | null;
  /** Quando o sinal foi observado. Sinal velho perde força. */
  observedAt?: Date | string | null;
  now?: Date;
};

export type CapacityReading = {
  level: CapacityLevel;
  /** Frase pronta em pt-BR, com o número dentro. Vai direto para a tela. */
  reason: string;
  basis: CapacityBasisItem[];
  confidence: 'alta' | 'media' | 'baixa';
  /** `true` quando não havia sinal nenhum e o nível é só o default. */
  assumed: boolean;
  corrected: boolean;
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePhase(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function isLowPhase(phase: string): boolean {
  return /\b(turbulencia|pausa|recolhimento|desacelerando)\b/.test(phase);
}

function isHighPhase(phase: string): boolean {
  return /\b(voo alto|fluindo)\b/.test(phase);
}

function shift(level: CapacityLevel, steps: number): CapacityLevel {
  const index = LEVEL_ORDER.indexOf(level);
  const next = Math.max(0, Math.min(LEVEL_ORDER.length - 1, index + steps));
  return LEVEL_ORDER[next];
}

function lower(a: CapacityLevel, b: CapacityLevel): CapacityLevel {
  return LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;
}

/**
 * Sono medido ruim. Mesmo limiar que o `decision-engine` já usava: nota <= 4,
 * ou menos de 6h efetivas. `minutes > 0` porque zero é "não sincronizou", não
 * "não dormiu".
 */
function hasPoorMeasuredSleep(signals: CapacitySignals): boolean {
  const score = numberOrNull(signals.measuredSleepScore);
  if (score !== null) return score <= 4;
  const minutes = numberOrNull(signals.measuredSleepMinutes);
  return minutes !== null && minutes > 0 && minutes < 360;
}

function hasPoorDeclaredSleep(signals: CapacitySignals): boolean {
  const score = numberOrNull(signals.declaredSleepScore);
  if (score !== null && score <= 4) return true;
  const hours = numberOrNull(signals.declaredSleepHours);
  return hours !== null && hours > 0 && hours < 6;
}

const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

function isStale(signals: CapacitySignals): boolean {
  if (!signals.observedAt) return false;
  const observed = signals.observedAt instanceof Date ? signals.observedAt : new Date(signals.observedAt);
  if (!Number.isFinite(observed.getTime())) return false;
  const now = signals.now ?? new Date();
  return now.getTime() - observed.getTime() > STALE_AFTER_MS;
}

/**
 * Viés entre dias a partir das correções anteriores.
 *
 * Só vira viés com 3 correções na mesma direção em pelo menos 2 dias
 * distintos — o mesmo contrato de verificação de padrão que o resto do app
 * usa. Uma correção contrária zera a contagem, então uma semana atípica não
 * cria preferência permanente. O deslocamento é de no máximo um nível:
 * correção calibra, não vira configuração.
 */
export function correctionBias(history: CapacityCorrection[] | null | undefined): -1 | 0 | 1 {
  if (!history || history.length === 0) return 0;
  const ordered = [...history].sort((left, right) => left.localDate.localeCompare(right.localDate));

  let direction: 'up' | 'down' | null = null;
  let streak: CapacityCorrection[] = [];
  for (const entry of ordered) {
    if (entry.direction !== direction) {
      direction = entry.direction;
      streak = [entry];
      continue;
    }
    streak.push(entry);
  }

  if (streak.length < 3) return 0;
  const distinctDays = new Set(streak.map((entry) => entry.localDate));
  if (distinctDays.size < 2) return 0;
  return direction === 'up' ? 1 : -1;
}

function buildReason(level: CapacityLevel, basis: CapacityBasisItem[], assumed: boolean): string {
  if (assumed) {
    return 'Ainda não tenho sinal de hoje, então mantive um tamanho moderado e reversível.';
  }

  const decisive = basis.filter((item) => item.weight === 'decisive');
  const parts = (decisive.length ? decisive : basis).slice(0, 2).map((item) => item.value);
  const because = parts.length === 2 ? `${parts[0]} e ${parts[1]}` : parts[0] ?? 'a leitura de hoje';

  switch (level) {
    case 'protecao':
      return `Deixei hoje no menor tamanho possível: ${because}.`;
    case 'baixa':
      return `Reduzi o tamanho de hoje: ${because}.`;
    case 'alta':
      return `Hoje cabe um passo maior: ${because}.`;
    default:
      return `Mantive um tamanho intermediário: ${because}.`;
  }
}

/**
 * A inferência.
 *
 * Regras avaliadas em ordem; a primeira `decisive` fixa o nível e as seguintes
 * só podem **rebaixar**. Proteção sempre vence conveniência.
 */
export function inferCapacity(signals: CapacitySignals = {}): CapacityReading {
  const basis: CapacityBasisItem[] = [];
  const energy = numberOrNull(signals.energyScore);
  const mood = numberOrNull(signals.moodScore);
  const phase = normalizePhase(signals.phaseLabel);
  const stale = isStale(signals);

  // 1. Segurança primeiro, e sem apelação: risco alto encerra a inferência.
  if (signals.riskRoute === 'crisis_protocol' || signals.riskRoute === 'human_support') {
    basis.push({ signal: 'risco', value: 'hoje a prioridade é apoio, não tarefa', weight: 'decisive' });
    return {
      level: 'protecao',
      reason: 'Hoje a prioridade é apoio, não tarefa. Deixei qualquer avanço de lado.',
      basis,
      confidence: 'alta',
      assumed: false,
      corrected: false,
    };
  }

  let level: CapacityLevel | null = null;

  // 2. O que ela acabou de relatar sobre o dia vence fase e sono: é o sinal
  //    mais fresco que existe, e foi ela quem deu.
  const recalibration = signals.recalibrationSignal ?? null;
  const forceHard = recalibration === 'day_hard' || recalibration === 'energy_crash';
  const forceGreat = recalibration === 'day_great' || recalibration === 'hyperfocus';
  if (forceHard) {
    level = 'baixa';
    basis.push({ signal: 'relato', value: 'você disse que hoje está difícil', weight: 'decisive' });
  } else if (forceGreat) {
    level = 'alta';
    basis.push({ signal: 'relato', value: 'você disse que hoje está rendendo', weight: 'decisive' });
  }

  if (level === null) {
    // 3. Sono medido ruim, energia ou humor no chão, fase baixa: proteção.
    const poorMeasuredSleep = hasPoorMeasuredSleep(signals);
    if (poorMeasuredSleep || isLowPhase(phase) || (energy !== null && energy <= 3) || (mood !== null && mood <= 3)) {
      level = 'protecao';
      if (poorMeasuredSleep) {
        const minutes = numberOrNull(signals.measuredSleepMinutes);
        basis.push({
          signal: 'sono',
          value: minutes !== null && minutes > 0
            ? `você dormiu ${Math.round((minutes / 60) * 10) / 10}h`
            : 'o sono medido veio baixo',
          weight: 'decisive',
        });
      }
      if (energy !== null && energy <= 3) {
        basis.push({ signal: 'energia', value: `sua energia está em ${energy} de 10`, weight: 'decisive' });
      }
      if (mood !== null && mood <= 3) {
        basis.push({ signal: 'humor', value: `seu humor está em ${mood} de 10`, weight: 'decisive' });
      }
      if (isLowPhase(phase)) {
        basis.push({ signal: 'fase', value: `seu estado está em ${signals.phaseLabel}`, weight: 'decisive' });
      }
    } else if (energy !== null && energy <= 5) {
      level = 'baixa';
      basis.push({ signal: 'energia', value: `sua energia está em ${energy} de 10`, weight: 'decisive' });
    } else if (isHighPhase(phase) || (energy !== null && energy >= 8 && (mood ?? 8) >= 6)) {
      level = 'alta';
      if (isHighPhase(phase)) {
        basis.push({ signal: 'fase', value: `seu estado está em ${signals.phaseLabel}`, weight: 'decisive' });
      }
      if (energy !== null && energy >= 8) {
        basis.push({ signal: 'energia', value: `sua energia está em ${energy} de 10`, weight: 'decisive' });
      }
    }
  }

  const assumed = level === null && basis.length === 0 && energy === null && mood === null;
  if (level === null) {
    level = 'media';
    if (energy !== null) {
      basis.push({ signal: 'energia', value: `sua energia está em ${energy} de 10`, weight: 'supporting' });
    }
  }

  /**
   * Aplica uma regra que só pode rebaixar.
   *
   * Quando ela de fato muda o nível, é ela que passa a explicar o dia: manter
   * como decisivo o sinal anterior produzia frase incoerente do tipo "reduzi o
   * tamanho de hoje porque sua energia está em 8 de 10".
   */
  function applyCeiling(next: CapacityLevel, item: CapacityBasisItem): void {
    const changed = LEVEL_ORDER.indexOf(next) < LEVEL_ORDER.indexOf(level as CapacityLevel);
    if (changed) {
      for (const previous of basis) {
        if (previous.weight === 'decisive') previous.weight = 'supporting';
      }
    }
    level = next;
    basis.push({ ...item, weight: changed ? 'decisive' : item.weight });
  }

  // 4. Queda ao longo do dia e rota de adaptar o dia limitam o teto, mas não
  //    derrubam quem acabou de dizer que está rendendo.
  if (!forceGreat) {
    if (signals.riskRoute === 'adapt_day') {
      applyCeiling(lower(level, 'baixa'), {
        signal: 'risco',
        value: 'a leitura de hoje pede adaptar o dia',
        weight: 'supporting',
      });
    }
    if (signals.intradayDirection === 'falling') {
      applyCeiling(lower(level, 'baixa'), {
        signal: 'trajetória',
        value: 'seu dia veio caindo desde o primeiro registro',
        weight: 'supporting',
      });
    }
    // 5. Sono declarado é mais ruidoso que medida: rebaixa, nunca decide.
    if (!hasPoorMeasuredSleep(signals) && hasPoorDeclaredSleep(signals)) {
      const hours = numberOrNull(signals.declaredSleepHours);
      applyCeiling(shift(level, -1), {
        signal: 'sono',
        value: hours !== null && hours > 0 ? `você contou que dormiu ${hours}h` : 'você contou que o sono foi ruim',
        weight: 'supporting',
      });
    }
  }

  // 6. Sinal velho não sustenta um dia grande: um pico das 7h não decide as 22h.
  if (stale) {
    applyCeiling(lower(level, 'media'), {
      signal: 'frescor',
      value: 'seu último registro já tem algumas horas',
      weight: 'supporting',
    });
  }

  // 7. A correção dela desloca um nível, e só um. Nunca fura o teto de
  //    proteção: sono medido ruim ou risco ativo não viram dia grande porque
  //    alguém apertou "coube mais que isso".
  let corrected = false;
  const sameDayCorrection = signals.correction
    && (!signals.localDate || !signals.correction.localDate || signals.correction.localDate === signals.localDate)
    ? signals.correction
    : null;

  const bias = sameDayCorrection ? 0 : correctionBias(signals.correctionHistory);
  const delta = sameDayCorrection ? (sameDayCorrection.direction === 'up' ? 1 : -1) : bias;

  if (delta !== 0) {
    const proposed = shift(level, delta);
    const protectedCeiling = hasPoorMeasuredSleep(signals) || signals.riskRoute === 'adapt_day';
    const next = delta > 0 && protectedCeiling ? lower(proposed, 'media') : proposed;
    corrected = next !== level;
    const item: CapacityBasisItem = {
      signal: 'correção',
      value: sameDayCorrection
        ? (delta > 0 ? 'você disse que coube mais que isso' : 'você disse que coube menos que isso')
        : (delta > 0 ? 'você vem corrigindo para cima' : 'você vem corrigindo para baixo'),
      weight: 'supporting',
    };
    // Correção para baixo usa o mesmo caminho das regras de teto; para cima é
    // a própria correção que passa a explicar o dia.
    if (LEVEL_ORDER.indexOf(next) < LEVEL_ORDER.indexOf(level)) {
      applyCeiling(next, item);
    } else {
      if (next !== level) {
        for (const previous of basis) {
          if (previous.weight === 'decisive') previous.weight = 'supporting';
        }
        level = next;
        basis.push({ ...item, weight: 'decisive' });
      } else {
        basis.push(item);
      }
    }
  }

  const decisiveCount = basis.filter((item) => item.weight === 'decisive').length;
  const confidence: CapacityReading['confidence'] = assumed || stale
    ? 'baixa'
    : decisiveCount >= 2
      ? 'alta'
      : decisiveCount === 1
        ? 'media'
        : 'baixa';

  return {
    level,
    reason: buildReason(level, basis, assumed),
    basis,
    confidence,
    assumed,
    corrected,
  };
}

/**
 * Tamanho de passo para o `GoalIntelligenceService`.
 *
 * Mudança declarada em relação ao ternário que vivia em `index.ts:2225`:
 * energia 7 passa de `heavy` para `moderate`. O corte de "dia grande" é 8 em
 * todo o resto do app (`decision-engine`, `reasoning-context`); manter 7 aqui
 * era o app discordando de si mesmo sobre o mesmo dia.
 */
export function toGoalCapacity(level: CapacityLevel): 'quick' | 'moderate' | 'heavy' {
  if (level === 'protecao' || level === 'baixa') return 'quick';
  if (level === 'alta') return 'heavy';
  return 'moderate';
}

/** Os dois booleanos que o `DecisionEngine` usa. */
export function toDecisionFlags(level: CapacityLevel): { lowCapacity: boolean; highCapacity: boolean } {
  return {
    lowCapacity: level === 'protecao' || level === 'baixa',
    highCapacity: level === 'alta',
  };
}

/** Duração concreta do passo, em minutos. */
export function toStepMinutes(level: CapacityLevel): number {
  switch (level) {
    case 'protecao': return 10;
    case 'baixa': return 15;
    case 'alta': return 40;
    default: return 25;
  }
}

/** Texto curto para injetar em prompt: quais sinais sustentaram a inferência. */
export function capacityBasisSummary(reading: CapacityReading): string {
  const values = reading.basis.map((item) => item.value);
  return values.length ? values.join('; ') : 'nenhum sinal registrado hoje';
}
