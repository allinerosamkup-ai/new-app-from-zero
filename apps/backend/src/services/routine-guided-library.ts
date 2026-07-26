/**
 * Biblioteca determinística de escolhas do onboarding guiado.
 *
 * Tudo aqui é opção de botão: a usuária monta a rotina escolhendo cartões,
 * não escrevendo texto. Os ids são estáveis porque viram chave de dedupe e
 * de memória — renomear um label é seguro, trocar um id não é.
 */

export type GuidedOption = {
  id: string;
  label: string;
  emoji: string;
};

export type GuidedCategory = {
  id: string;
  label: string;
  options: GuidedOption[];
};

/** Etapa 2 — "O que já ocupa seus dias?" */
export const LIFE_AREAS: GuidedOption[] = [
  { id: 'work', label: 'Trabalho', emoji: '💼' },
  { id: 'study', label: 'Estudo', emoji: '📚' },
  { id: 'caregiving', label: 'Filhos ou cuidar de alguém', emoji: '🧸' },
  { id: 'home', label: 'Casa', emoji: '🏠' },
  { id: 'health', label: 'Saúde', emoji: '🩺' },
  { id: 'business', label: 'Negócio próprio', emoji: '🚀' },
  { id: 'commute', label: 'Deslocamento', emoji: '🚌' },
  { id: 'variable', label: 'Compromissos variáveis', emoji: '🔀' },
];

/** Etapa 3 — o que drena, organizado por categoria para não virar lista solta. */
export const ENERGY_DRAINS: GuidedCategory[] = [
  {
    id: 'mental',
    label: 'Demandas mentais',
    options: [
      { id: 'drain_many_decisions', label: 'Decidir muita coisa', emoji: '🧠' },
      { id: 'drain_context_switch', label: 'Trocar de tarefa o tempo todo', emoji: '🔄' },
      { id: 'drain_long_focus', label: 'Foco longo sem pausa', emoji: '⏳' },
      { id: 'drain_bureaucracy', label: 'Burocracia e papelada', emoji: '📋' },
    ],
  },
  {
    id: 'social',
    label: 'Interação social',
    options: [
      { id: 'drain_meetings', label: 'Reuniões seguidas', emoji: '👥' },
      { id: 'drain_calls', label: 'Ligações e áudios', emoji: '📞' },
      { id: 'drain_conflict', label: 'Conversa difícil ou conflito', emoji: '⚡' },
      { id: 'drain_crowd', label: 'Lugar cheio de gente', emoji: '🏙️' },
    ],
  },
  {
    id: 'environment',
    label: 'Ambiente',
    options: [
      { id: 'drain_noise', label: 'Barulho', emoji: '🔊' },
      { id: 'drain_mess', label: 'Bagunça em volta', emoji: '🧺' },
      { id: 'drain_heat', label: 'Calor ou desconforto físico', emoji: '🥵' },
    ],
  },
  {
    id: 'body',
    label: 'Corpo e saúde',
    options: [
      { id: 'drain_bad_sleep', label: 'Dormir mal', emoji: '😴' },
      { id: 'drain_pain', label: 'Dor ou sintoma físico', emoji: '🤕' },
      { id: 'drain_skip_meal', label: 'Pular refeição', emoji: '🍽️' },
      { id: 'drain_cycle', label: 'Fase do ciclo', emoji: '🌙' },
    ],
  },
  {
    id: 'home_care',
    label: 'Casa e cuidado',
    options: [
      { id: 'drain_chores', label: 'Tarefas de casa acumuladas', emoji: '🧹' },
      { id: 'drain_caregiving', label: 'Cuidar de outra pessoa', emoji: '🤲' },
      { id: 'drain_errands', label: 'Resolver pendência fora de casa', emoji: '🛒' },
    ],
  },
  {
    id: 'work_study',
    label: 'Trabalho e estudo',
    options: [
      { id: 'drain_deadline', label: 'Prazo apertado', emoji: '⏰' },
      { id: 'drain_boring_task', label: 'Tarefa chata e repetitiva', emoji: '🌀' },
      { id: 'drain_unclear_task', label: 'Não saber por onde começar', emoji: '❓' },
    ],
  },
];

/**
 * Recuperadores que viram bloco de verdade na semana, com duração.
 *
 * Sem isso, "o que te recupera" seria só uma pergunta bonita: a resposta
 * entrava no app e não mudava nada. Só entram os que ocupam tempo — "dormir
 * bem" é resultado, não bloco agendável.
 */
export const RESTORER_BLOCKS: Record<string, { title: string; durationMinutes: number }> = {
  restore_walk: { title: 'Caminhar', durationMinutes: 30 },
  restore_exercise: { title: 'Me mexer', durationMinutes: 30 },
  restore_bath: { title: 'Banho demorado', durationMinutes: 30 },
  restore_music: { title: 'Ouvir música sem fazer mais nada', durationMinutes: 20 },
  restore_series: { title: 'Série ou filme', durationMinutes: 45 },
  restore_reading: { title: 'Ler', durationMinutes: 30 },
  restore_creating: { title: 'Criar alguma coisa', durationMinutes: 45 },
  restore_close_people: { title: 'Ficar com quem eu gosto', durationMinutes: 60 },
  restore_pet: { title: 'Tempo com meu bicho', durationMinutes: 20 },
  restore_nature: { title: 'Sair, tomar sol', durationMinutes: 30 },
  restore_alone: { title: 'Ficar sozinha em silêncio', durationMinutes: 30 },
  restore_nap: { title: 'Cochilo curto', durationMinutes: 25 },
  restore_doing_nothing: { title: 'Não fazer nada sem culpa', durationMinutes: 30 },
  restore_tidy: { title: 'Arrumar o espaço', durationMinutes: 20 },
};

export function findRestorerBlock(id: string): { title: string; durationMinutes: number } | null {
  return RESTORER_BLOCKS[id] ?? null;
}

/** Etapa 3 — o que recupera. */
export const ENERGY_RESTORERS: GuidedCategory[] = [
  {
    id: 'rest',
    label: 'Descanso',
    options: [
      { id: 'restore_sleep', label: 'Dormir bem', emoji: '🛌' },
      { id: 'restore_nap', label: 'Cochilo curto', emoji: '💤' },
      { id: 'restore_alone', label: 'Ficar sozinha em silêncio', emoji: '🤫' },
      { id: 'restore_doing_nothing', label: 'Não fazer nada sem culpa', emoji: '🫧' },
    ],
  },
  {
    id: 'body_care',
    label: 'Corpo',
    options: [
      { id: 'restore_walk', label: 'Caminhar', emoji: '🚶' },
      { id: 'restore_exercise', label: 'Treinar ou se mexer', emoji: '🏃' },
      { id: 'restore_bath', label: 'Banho demorado', emoji: '🛁' },
      { id: 'restore_food', label: 'Comer algo gostoso', emoji: '🍲' },
    ],
  },
  {
    id: 'pleasure',
    label: 'Prazer',
    options: [
      { id: 'restore_music', label: 'Música', emoji: '🎧' },
      { id: 'restore_series', label: 'Série ou filme', emoji: '📺' },
      { id: 'restore_reading', label: 'Ler', emoji: '📖' },
      { id: 'restore_creating', label: 'Criar alguma coisa', emoji: '🎨' },
    ],
  },
  {
    id: 'connection',
    label: 'Conexão',
    options: [
      { id: 'restore_close_people', label: 'Ficar com quem eu gosto', emoji: '💛' },
      { id: 'restore_pet', label: 'Meu bicho', emoji: '🐾' },
      { id: 'restore_nature', label: 'Sair, tomar sol, natureza', emoji: '🌳' },
    ],
  },
  {
    id: 'order',
    label: 'Organização',
    options: [
      { id: 'restore_tidy', label: 'Arrumar o espaço', emoji: '✨' },
      { id: 'restore_plan', label: 'Ver o dia organizado', emoji: '🗂️' },
      { id: 'restore_finish', label: 'Terminar algo que estava pendente', emoji: '✅' },
    ],
  },
];

export type GuidedIntention = GuidedOption & {
  /** Hábitos sugeridos quando essa intenção é escolhida. */
  habitTemplateIds: string[];
  /**
   * Objetivo proposto — direção ampla, vira meta verificável na prévia.
   * `firstStep` é a ação concreta que tira a meta do papel hoje: precisa ter
   * verbo e objeto, e caber em poucos minutos. "Primeiro passo: <a própria
   * meta>" não é ação, é a meta repetida em letra minúscula.
   */
  objective: { title: string; metric: string; target: number; firstStep: string; firstStepMinutes: number } | null;
};

/** Etapa 4 — "O que você quer sustentar ou mudar?" */
export const INTENTIONS: GuidedIntention[] = [
  {
    id: 'body',
    label: 'Cuidar do corpo',
    emoji: '💪',
    habitTemplateIds: ['habit_move', 'habit_water', 'habit_stretch'],
    objective: { title: 'Me mexer com constância', metric: 'treinos concluídos', target: 12, firstStep: 'Separar a roupa de treino e deixar à vista', firstStepMinutes: 10 },
  },
  {
    id: 'sleep',
    label: 'Dormir melhor',
    emoji: '🌙',
    habitTemplateIds: ['habit_sleep_routine', 'habit_screen_off'],
    objective: { title: 'Recuperar meu sono', metric: 'noites dormindo no horário', target: 20, firstStep: 'Escolher a hora de largar a tela hoje', firstStepMinutes: 10 },
  },
  {
    id: 'home',
    label: 'Organizar a casa',
    emoji: '🏠',
    habitTemplateIds: ['habit_tidy_15', 'habit_dishes'],
    objective: null,
  },
  {
    id: 'produce',
    label: 'Produzir ou estudar',
    emoji: '🎯',
    habitTemplateIds: ['habit_focus_block', 'habit_study'],
    objective: { title: 'Avançar no que importa', metric: 'sessões de foco concluídas', target: 20, firstStep: 'Escrever qual é a próxima coisa a avançar', firstStepMinutes: 15 },
  },
  {
    id: 'money',
    label: 'Administrar dinheiro',
    emoji: '💰',
    habitTemplateIds: ['habit_track_spending'],
    objective: { title: 'Entender pra onde vai meu dinheiro', metric: 'semanas com gastos registrados', target: 4, firstStep: 'Anotar os gastos de ontem', firstStepMinutes: 15 },
  },
  {
    id: 'health',
    label: 'Cuidar da saúde',
    emoji: '🩺',
    habitTemplateIds: ['habit_medication', 'habit_checkin'],
    objective: null,
  },
  {
    id: 'relationships',
    label: 'Fortalecer relações',
    emoji: '💛',
    habitTemplateIds: ['habit_reach_out'],
    objective: null,
  },
  {
    id: 'project',
    label: 'Desenvolver um projeto',
    emoji: '🚀',
    habitTemplateIds: ['habit_project_block'],
    objective: { title: 'Tirar meu projeto do papel', metric: 'blocos de projeto concluídos', target: 16, firstStep: 'Escrever em uma frase o que o projeto precisa entregar', firstStepMinutes: 20 },
  },
  {
    id: 'overload',
    label: 'Diminuir sobrecarga',
    emoji: '🫧',
    habitTemplateIds: ['habit_brain_dump', 'habit_pause'],
    objective: null,
  },
  {
    id: 'routine',
    label: 'Criar rotina',
    emoji: '🗓️',
    habitTemplateIds: ['habit_checkin', 'habit_plan_day'],
    objective: null,
  },
];

export type HabitTemplate = {
  id: string;
  title: string;
  emoji: string;
  frequency: 'daily' | 'weekly';
  /** Domingo = 0. Vazio em hábito diário. */
  daysOfWeek: number[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes: number;
  /** Custo de energia — usado para não empilhar hábito pesado em fase baixa. */
  energyCost: 1 | 2 | 3;
};

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { id: 'habit_move', title: 'Me mexer 20 minutos', emoji: '🏃', frequency: 'weekly', daysOfWeek: [1, 3, 5], timeOfDay: 'morning', durationMinutes: 20, energyCost: 3 },
  { id: 'habit_water', title: 'Beber água', emoji: '💧', frequency: 'daily', daysOfWeek: [], timeOfDay: 'anytime', durationMinutes: 5, energyCost: 1 },
  { id: 'habit_stretch', title: 'Alongar', emoji: '🧘', frequency: 'daily', daysOfWeek: [], timeOfDay: 'morning', durationMinutes: 10, energyCost: 1 },
  { id: 'habit_sleep_routine', title: 'Começar a desacelerar pra dormir', emoji: '🌙', frequency: 'daily', daysOfWeek: [], timeOfDay: 'evening', durationMinutes: 15, energyCost: 1 },
  { id: 'habit_screen_off', title: 'Largar a tela antes de deitar', emoji: '📵', frequency: 'daily', daysOfWeek: [], timeOfDay: 'evening', durationMinutes: 10, energyCost: 1 },
  { id: 'habit_tidy_15', title: 'Arrumar 15 minutos', emoji: '🧹', frequency: 'daily', daysOfWeek: [], timeOfDay: 'evening', durationMinutes: 15, energyCost: 2 },
  { id: 'habit_dishes', title: 'Deixar a cozinha limpa', emoji: '🍽️', frequency: 'daily', daysOfWeek: [], timeOfDay: 'evening', durationMinutes: 15, energyCost: 2 },
  { id: 'habit_focus_block', title: 'Um bloco de foco', emoji: '🎯', frequency: 'weekly', daysOfWeek: [1, 2, 3, 4, 5], timeOfDay: 'morning', durationMinutes: 45, energyCost: 3 },
  { id: 'habit_study', title: 'Estudar', emoji: '📚', frequency: 'weekly', daysOfWeek: [1, 2, 3, 4, 5], timeOfDay: 'afternoon', durationMinutes: 40, energyCost: 3 },
  { id: 'habit_track_spending', title: 'Registrar meus gastos', emoji: '💰', frequency: 'daily', daysOfWeek: [], timeOfDay: 'evening', durationMinutes: 5, energyCost: 1 },
  { id: 'habit_medication', title: 'Tomar meu remédio', emoji: '💊', frequency: 'daily', daysOfWeek: [], timeOfDay: 'morning', durationMinutes: 5, energyCost: 1 },
  { id: 'habit_checkin', title: 'Check-in de humor e energia', emoji: '🌡️', frequency: 'daily', daysOfWeek: [], timeOfDay: 'morning', durationMinutes: 5, energyCost: 1 },
  { id: 'habit_reach_out', title: 'Falar com alguém que eu gosto', emoji: '💛', frequency: 'weekly', daysOfWeek: [0, 3], timeOfDay: 'evening', durationMinutes: 20, energyCost: 2 },
  { id: 'habit_project_block', title: 'Trabalhar no meu projeto', emoji: '🚀', frequency: 'weekly', daysOfWeek: [1, 3, 5], timeOfDay: 'afternoon', durationMinutes: 50, energyCost: 3 },
  { id: 'habit_brain_dump', title: 'Esvaziar a cabeça no papel', emoji: '🫧', frequency: 'daily', daysOfWeek: [], timeOfDay: 'evening', durationMinutes: 10, energyCost: 1 },
  { id: 'habit_pause', title: 'Uma pausa de verdade', emoji: '☕', frequency: 'daily', daysOfWeek: [], timeOfDay: 'afternoon', durationMinutes: 15, energyCost: 1 },
  { id: 'habit_plan_day', title: 'Olhar meu dia', emoji: '🗓️', frequency: 'daily', daysOfWeek: [], timeOfDay: 'morning', durationMinutes: 5, energyCost: 1 },
];

const HABIT_TEMPLATE_BY_ID = new Map(HABIT_TEMPLATES.map((template) => [template.id, template]));

export function findHabitTemplate(id: string): HabitTemplate | null {
  return HABIT_TEMPLATE_BY_ID.get(id) ?? null;
}

export function findIntention(id: string): GuidedIntention | null {
  return INTENTIONS.find((intention) => intention.id === id) ?? null;
}

/** Hábitos sugeridos a partir das intenções escolhidas, sem repetir. */
export function suggestHabitsForIntentions(intentionIds: string[]): HabitTemplate[] {
  const seen = new Set<string>();
  const suggested: HabitTemplate[] = [];

  for (const intentionId of intentionIds) {
    const intention = findIntention(intentionId);
    if (!intention) continue;

    for (const templateId of intention.habitTemplateIds) {
      if (seen.has(templateId)) continue;
      const template = findHabitTemplate(templateId);
      if (!template) continue;
      seen.add(templateId);
      suggested.push(template);
    }
  }

  return suggested;
}

/** Catálogo completo servido ao frontend — uma chamada, tudo que a tela precisa. */
export function getGuidedLibrary() {
  return {
    lifeAreas: LIFE_AREAS,
    energyDrains: ENERGY_DRAINS,
    energyRestorers: ENERGY_RESTORERS,
    // `objective` fica no backend — a usuária vê a meta só na prévia, já formatada.
    intentions: INTENTIONS.map(({ objective, ...intention }) => intention),
    habitTemplates: HABIT_TEMPLATES,
  };
}
