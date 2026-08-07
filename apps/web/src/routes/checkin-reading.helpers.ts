/**
 * A devolutiva do check-in — a frase que mostra que o app entendeu.
 *
 * Regra dura: cada leitura aqui nasce de um número ou de um registro que existe
 * no aparelho. Nenhuma frase é gerada "porque fica bonita no card". Se nenhuma
 * evidência se sustenta, a função devolve `null` e a tela não mostra nada —
 * silêncio é melhor que padrão inventado, porque padrão inventado é exatamente
 * o que faz a pessoa parar de acreditar na leitura seguinte.
 *
 * Por que determinístico e não LLM: a comparação "hoje contra a sua média" é
 * aritmética. Mandar isso para o modelo só adiciona latência, custo e chance de
 * o número sair errado. O modelo entra depois, para decidir a AÇÃO — que é onde
 * interpretação realmente é necessária.
 */

export type CheckinReadingGoal = {
  title: string;
  totalActions: number;
  completedActions: number;
  /** Última ação concluída neste objetivo, quando houver. */
  lastCompletedActionTitle?: string | null;
  /** Dias desde essa conclusão. */
  daysSinceLastCompletion?: number | null;
};

export type CheckinReadingInput = {
  todayEnergy: number | null;
  todayMood: number | null;
  /** Energias dos check-ins anteriores, do mais recente para o mais antigo. */
  previousEnergies: number[];
  goals: CheckinReadingGoal[];
};

export type CheckinReading = {
  text: string;
  /** O dado que sustenta a frase. Serve para auditoria e para teste. */
  evidence: string;
  kind: 'energy_below' | 'energy_above' | 'continue_goal' | 'undefined_goal';
};

const MIN_HISTORY = 3;
const MEANINGFUL_GAP = 1.5;
const RECENT_DAYS = 2;

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function buildCheckinReading(input: CheckinReadingInput): CheckinReading | null {
  const history = input.previousEnergies.filter((value) => Number.isFinite(value)).slice(0, 14);
  const activeGoals = input.goals.filter((goal) => goal.completedActions < goal.totalActions || goal.totalActions === 0);

  // 1. Energia abaixo da própria média. Prioridade máxima: muda o tamanho do dia.
  if (input.todayEnergy !== null && history.length >= MIN_HISTORY) {
    const baseline = average(history);
    const gap = baseline - input.todayEnergy;

    if (gap >= MEANINGFUL_GAP) {
      const focus = activeGoals[0];
      return {
        kind: 'energy_below',
        text: focus
          ? `Hoje sua energia está mais baixa que a sua média dos últimos dias. Em vez de espalhar, vamos ficar só em "${focus.title}".`
          : 'Hoje sua energia está mais baixa que a sua média dos últimos dias. Vamos manter uma coisa só.',
        evidence: `energia ${input.todayEnergy}/10 contra média ${baseline.toFixed(1)}/10 em ${history.length} registros`,
      };
    }

    if (-gap >= MEANINGFUL_GAP) {
      const focus = activeGoals[0];
      return {
        kind: 'energy_above',
        text: focus
          ? `Sua energia hoje está acima da sua média. É o dia para pegar a parte mais pesada de "${focus.title}".`
          : 'Sua energia hoje está acima da sua média. Dá para pegar o que costuma ficar para depois.',
        evidence: `energia ${input.todayEnergy}/10 contra média ${baseline.toFixed(1)}/10 em ${history.length} registros`,
      };
    }
  }

  // 2. Já houve movimento recente: continuar de onde parou custa menos que abrir frente nova.
  const recentlyMoved = activeGoals.find((goal) => (
    goal.lastCompletedActionTitle
    && typeof goal.daysSinceLastCompletion === 'number'
    && goal.daysSinceLastCompletion <= RECENT_DAYS
  ));
  if (recentlyMoved) {
    const when = recentlyMoved.daysSinceLastCompletion === 0
      ? 'hoje'
      : recentlyMoved.daysSinceLastCompletion === 1 ? 'ontem' : `há ${recentlyMoved.daysSinceLastCompletion} dias`;
    return {
      kind: 'continue_goal',
      text: `Você já concluiu "${recentlyMoved.lastCompletedActionTitle}" ${when}. Faz mais sentido continuar dali do que começar outra frente.`,
      evidence: `ação concluída em "${recentlyMoved.title}" ${when}`,
    };
  }

  // 3. Objetivo sem caminho definido. O problema não é falta de vontade, é falta de definição.
  const undefinedGoal = activeGoals.find((goal) => goal.totalActions === 0);
  if (undefinedGoal) {
    return {
      kind: 'undefined_goal',
      text: `"${undefinedGoal.title}" está entre seus objetivos, mas ainda não existe uma definição do que significa concluir isso. Vamos resolver essa parte primeiro.`,
      evidence: `objetivo "${undefinedGoal.title}" sem nenhuma ação definida`,
    };
  }

  return null;
}
