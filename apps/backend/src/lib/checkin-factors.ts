/**
 * Fatores do check-in — rótulo e valência, uma fonte só.
 *
 * O backend mantinha três cópias deste mapa (`checkin.service.ts`, e duas em
 * `index.ts`), e as três estavam erradas do mesmo jeito: listavam ids que não
 * existem na tela (`good_sleep`, `bad_sleep`, `music`, `hobby`) e não listavam
 * os que existem. Como a classificação era `posFactors = tudo que não está em
 * NEGATIVE_IDS`, o efeito era o pior possível — **"Esqueci a medicação",
 * "Dormi pouco (<6h)" e "Pulei refeições" chegavam ao modelo dentro de
 * "Fatores que ajudaram"**, com o id cru no lugar do rótulo.
 *
 * Treze fatores negativos entravam invertidos. Não é ruído de formatação: a
 * Airia lia como benefício aquilo que a pessoa marcou como o que pesou no dia,
 * e propunha a partir disso.
 *
 * A lista espelha `CHECKIN_FACTOR_IDS` em `apps/web/src/routes/checkin-form-model.ts`
 * e os rótulos vêm de `apps/web/src/i18n/locales/pt.json` (`checkin.factors.*`),
 * que é o texto que a pessoa realmente tocou na tela. `checkin-factors.test.ts`
 * trava a paridade: id novo na tela sem entrada aqui quebra o teste.
 */

export type FactorValence = 'positive' | 'negative';

type FactorEntry = { label: string; valence: FactorValence };

export const CHECKIN_FACTORS: Record<string, FactorEntry> = {
  // Sono
  slept_well: { label: 'Dormi bem (7h+)', valence: 'positive' },
  slept_little: { label: 'Dormi pouco (<6h)', valence: 'negative' },
  woke_up_night: { label: 'Acordei no meio da noite', valence: 'negative' },

  // Corpo
  exercise: { label: 'Mexi o corpo', valence: 'positive' },
  no_exercise: { label: 'Fiquei parada o dia todo', valence: 'negative' },
  healthy_meal: { label: 'Me alimentei bem', valence: 'positive' },
  skipped_meals: { label: 'Pulei refeições', valence: 'negative' },
  took_meds: { label: 'Tomei minha medicação', valence: 'positive' },
  forgot_meds: { label: 'Esqueci a medicação', valence: 'negative' },
  fresh_air: { label: 'Ar fresco / saí de casa', valence: 'positive' },

  // Vínculo
  good_talk: { label: 'Boa conversa', valence: 'positive' },
  kind_words: { label: 'Recebi palavras gentis', valence: 'positive' },
  support: { label: 'Me senti apoiada', valence: 'positive' },
  social_drain: { label: 'Interação social me drenou', valence: 'negative' },
  loneliness: { label: 'Solidão', valence: 'negative' },
  relationship_conflict: { label: 'Conflito no relacionamento', valence: 'negative' },

  // Execução
  focused_session: { label: 'Consegui me concentrar', valence: 'positive' },
  hyperfocus_stuck: { label: 'Hiperfoco travado — não consigo parar', valence: 'negative' },
  small_win: { label: 'Pequena vitória', valence: 'positive' },
  finished_task: { label: 'Tarefa concluída', valence: 'positive' },
  feeling_valued: { label: 'Me senti valorizada', valence: 'positive' },
  work_pressure: { label: 'Pressão / prazo apertado', valence: 'negative' },
  plan_changed: { label: 'Planos mudaram de última hora', valence: 'negative' },
  hard_decision: { label: 'Decisão difícil pendente', valence: 'negative' },

  // Estado interno
  dissociated: { label: 'Dissociada / no piloto automático', valence: 'negative' },
  low_dopamine: { label: 'Nada parece interessante', valence: 'negative' },
  stuck: { label: 'Paralisada — não consegui começar', valence: 'negative' },
  overwhelmed: { label: 'Sobrecarga mental', valence: 'negative' },
  self_trust: { label: 'Confiança em mim', valence: 'positive' },
  rest: { label: 'Descanso intencional', valence: 'positive' },
  fiz_algo_gosto: { label: 'Fiz algo que gosto', valence: 'positive' },

  // Vida
  financial_stress: { label: 'Estresse financeiro', valence: 'negative' },
  bad_news: { label: 'Notícia ruim', valence: 'negative' },

  // Ciclo
  pms_symptoms: { label: 'Sintomas de TPM', valence: 'negative' },
  heavy_period: { label: 'Ciclo intenso hoje', valence: 'negative' },
};

export function factorLabel(id: string): string {
  return CHECKIN_FACTORS[id]?.label ?? id;
}

/**
 * Fator desconhecido é tratado como neutro-positivo apenas na ausência total de
 * informação — mas nunca chega aqui em silêncio: o teste de paridade quebra
 * antes, no momento em que um id novo aparece na tela sem entrada neste mapa.
 */
export function isNegativeFactor(id: string): boolean {
  return CHECKIN_FACTORS[id]?.valence === 'negative';
}

/** Separa os fatores marcados em "pesaram" e "ajudaram", já com rótulo. */
export function splitFactors(ids: readonly string[]): { helped: string[]; weighed: string[] } {
  const helped: string[] = [];
  const weighed: string[] = [];
  for (const id of ids) {
    (isNegativeFactor(id) ? weighed : helped).push(factorLabel(id));
  }
  return { helped, weighed };
}
