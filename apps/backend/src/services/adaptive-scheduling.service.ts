/**
 * Engine adaptativa: decide carga, buffer, pausa de hábitos e demais
 * comportamentos do planner em função da fase de humor + warningFlags.
 *
 * Função pura. Não acessa DB. Recebe fase + flags, devolve decisões.
 *
 * Quem chama:
 * - buildAuraSystemPrompt (injeta promptSummary no prompt)
 * - generateJournalSuggestedTasks (respeita maxTarefasAlta + bufferMinutos)
 * - habit cron (pula push se pauseHabits)
 * - auto-reschedule cron (consulta preFallActive pra decidir migração)
 */

export type MoodPhase =
  | 'elevated'
  | 'flowing'
  | 'stable'
  | 'falling'
  | 'low'
  | 'depleted'
  | 'recovering'
  | 'mixed'
  | 'insufficient_data';

export type WarningFlag =
  | 'high_volatility'
  | 'sustained_low'
  | 'rapid_drop'
  | 'sustained_elevated'
  | 'sleep_impact_high'
  | 'low_checkin_frequency';

export type Carga = 'leve' | 'media' | 'alta';

export type AdaptiveContext = {
  phase: MoodPhase;
  cargaSugerida: Carga;
  /** Limite de tarefas categoria 'trabalho' / pesadas no dia */
  maxTarefasAlta: number;
  /** Buffer entre tarefas em minutos */
  bufferMinutos: number;
  /** Pausa de hábitos não-essenciais */
  pauseHabits: boolean;
  /** Razão da pausa pra Aura comunicar com gentileza */
  pauseReason: string | null;
  /** Resumo curto pra injeção no prompt da Aura */
  promptSummary: string;
  /** Pre-queda detectada → planner deve REDUZIR demanda nova */
  preFallActive: boolean;
  /** Aviso pra exibir ao usuário (opcional) */
  userMessage: string | null;
};

const PHASE_CARGA: Record<MoodPhase, { carga: Carga; max: number; buffer: number }> = {
  elevated: { carga: 'alta', max: 4, buffer: 10 },
  flowing: { carga: 'alta', max: 4, buffer: 10 },
  stable: { carga: 'media', max: 3, buffer: 15 },
  recovering: { carga: 'leve', max: 2, buffer: 20 },
  falling: { carga: 'leve', max: 1, buffer: 30 },
  low: { carga: 'leve', max: 0, buffer: 30 },
  depleted: { carga: 'leve', max: 0, buffer: 45 },
  mixed: { carga: 'media', max: 2, buffer: 30 },
  insufficient_data: { carga: 'media', max: 3, buffer: 15 },
};

/**
 * Hábitos pausam quando a pessoa está em fase de proteção:
 * - low / depleted: pausa todos os hábitos não-essenciais
 * - falling / mixed: pausa hábitos não-essenciais
 * - sustained_low ou rapid_drop ativos: pausa preventiva mesmo se fase for stable
 */
function shouldPauseHabits(phase: MoodPhase, flags: WarningFlag[]): { pause: boolean; reason: string | null } {
  if (phase === 'depleted' || phase === 'low') {
    return { pause: true, reason: 'fase de proteção — energia baixa, hábitos pausados pra você não pagar preço' };
  }
  if (phase === 'falling' || phase === 'mixed') {
    return { pause: true, reason: 'fase instável — só o essencial hoje, hábitos não-essenciais aguardam' };
  }
  if (flags.includes('sustained_low') || flags.includes('rapid_drop')) {
    return { pause: true, reason: 'sinal de queda detectado — pausa preventiva nos hábitos' };
  }
  return { pause: false, reason: null };
}

/**
 * Pre-fall: planner deve descartar criação de demanda nova pesada.
 */
function isPreFallActive(flags: WarningFlag[]): boolean {
  return (
    flags.includes('sustained_low') ||
    flags.includes('rapid_drop') ||
    flags.includes('sustained_elevated') // alta sustentada também é risco (oposto)
  );
}

/**
 * Mensagem opcional pra exibir ao usuário (banner suave no planner).
 */
function deriveUserMessage(phase: MoodPhase, flags: WarningFlag[]): string | null {
  if (phase === 'depleted') return 'Hoje é dia de proteção. Só o essencial. Sua agenda foi enxugada automaticamente.';
  if (phase === 'low') return 'Carga reduzida hoje. Foque no básico — o resto pode esperar.';
  if (phase === 'falling') return 'Sinal de queda. Buffer ampliado, demanda nova suspensa até estabilizar.';
  if (flags.includes('rapid_drop')) return 'Queda rápida detectada nas últimas 48h. Reduzi o ritmo do planner.';
  if (flags.includes('sustained_low')) return 'Você está em fase baixa há alguns dias. Cuidado com demanda nova.';
  if (flags.includes('sustained_elevated')) return 'Aceleração sustentada. Cuidado com decisões irreversíveis e excesso de escopo.';
  return null;
}

export function deriveAdaptiveContext(input: {
  phase?: MoodPhase | null;
  warningFlags?: WarningFlag[] | null;
}): AdaptiveContext {
  const phase: MoodPhase = (input.phase as MoodPhase) || 'insufficient_data';
  const flags: WarningFlag[] = input.warningFlags || [];
  const cfg = PHASE_CARGA[phase] || PHASE_CARGA.insufficient_data;
  const { pause, reason } = shouldPauseHabits(phase, flags);
  const preFall = isPreFallActive(flags);
  const userMessage = deriveUserMessage(phase, flags);

  const promptSummary = [
    `Fase atual: ${phase}.`,
    `Carga sugerida hoje: ${cfg.carga} (máx ${cfg.max} tarefas pesadas, buffer ${cfg.buffer}min entre demandas).`,
    pause ? `Hábitos pausados: ${reason}.` : `Hábitos ativos.`,
    preFall
      ? `ALERTA pre-queda ativo (${flags.filter(f => ['sustained_low','rapid_drop','sustained_elevated'].includes(f)).join(', ')}) — NÃO crie demanda nova pesada; proteja energia.`
      : `Sem alerta de queda — pode encadear demanda dentro do orçamento.`,
  ].join(' ');

  return {
    phase,
    cargaSugerida: cfg.carga,
    maxTarefasAlta: cfg.max,
    bufferMinutos: cfg.buffer,
    pauseHabits: pause,
    pauseReason: reason,
    promptSummary,
    preFallActive: preFall,
    userMessage,
  };
}

/**
 * Verifica se uma tarefa pesada cabe no orçamento do dia.
 * countTarefasAltaJa: quantas tarefas pesadas já existem no planner de hoje.
 */
export function fitsTodayBudget(
  ctx: AdaptiveContext,
  category: string,
  countTarefasAltaJa: number,
): { fits: boolean; reason: string | null } {
  const isHeavy = category === 'trabalho';
  if (!isHeavy) return { fits: true, reason: null };
  if (ctx.preFallActive) return { fits: false, reason: 'pre-queda ativa — sem demanda pesada nova' };
  if (countTarefasAltaJa >= ctx.maxTarefasAlta) {
    return { fits: false, reason: `orçamento de tarefas pesadas atingido (${ctx.maxTarefasAlta}/${ctx.maxTarefasAlta})` };
  }
  return { fits: true, reason: null };
}

/**
 * Verifica se há buffer suficiente entre uma tarefa nova e tarefas existentes.
 * existingTimes: array de "HH:MM" das tarefas já no planner.
 */
export function respectsBuffer(
  ctx: AdaptiveContext,
  candidateTime: string,
  existingTimes: string[],
): boolean {
  const candidate = parseTimeToMinutes(candidateTime);
  if (candidate === null) return true;
  for (const ex of existingTimes) {
    const exMin = parseTimeToMinutes(ex);
    if (exMin === null) continue;
    if (Math.abs(candidate - exMin) < ctx.bufferMinutos) return false;
  }
  return true;
}

function parseTimeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Heurística rápida pra inferir fase a partir de check-ins recentes (usado em cron).
 * Espera array de check-ins ordenados do mais recente pro mais antigo, com mood/energy/clarity.
 * NÃO substitui mood-cycle-engine completo; é fallback enxuto pra cron decidir pause de hábito.
 */
export function inferPhaseFromRecentCheckins(
  checkins: Array<{ moodScore: number; energyScore: number }>,
): { phase: MoodPhase; warningFlags: WarningFlag[] } {
  if (checkins.length < 3) return { phase: 'insufficient_data', warningFlags: ['low_checkin_frequency'] };
  const last = checkins.slice(0, 7);
  const composites = last.map((c) => (c.moodScore + c.energyScore) / 2);
  const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
  const variance =
    composites.reduce((acc, x) => acc + (x - avg) ** 2, 0) / composites.length;
  const stdDev = Math.sqrt(variance);

  const flags: WarningFlag[] = [];
  if (stdDev > 1.5) flags.push('high_volatility');
  const recentAvg = composites.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, composites.length);
  const olderAvg = composites.slice(3).length > 0
    ? composites.slice(3).reduce((a, b) => a + b, 0) / composites.slice(3).length
    : recentAvg;
  if (recentAvg + 1.2 < olderAvg) flags.push('rapid_drop');
  const lowDays = composites.filter((c) => c < 4.5).length;
  if (lowDays >= 3) flags.push('sustained_low');
  const highDays = composites.filter((c) => c > 8).length;
  if (highDays >= 5) flags.push('sustained_elevated');

  let phase: MoodPhase;
  if (avg <= 3) phase = 'depleted';
  else if (avg <= 4.5) phase = 'low';
  else if (recentAvg + 0.8 < olderAvg) phase = 'falling';
  else if (recentAvg - 0.8 > olderAvg && olderAvg < 5) phase = 'recovering';
  else if (avg >= 8) phase = 'elevated';
  else if (avg >= 7) phase = 'flowing';
  else if (stdDev > 1.5) phase = 'mixed';
  else phase = 'stable';

  return { phase, warningFlags: flags };
}
