/**
 * O conteúdo do fluxo, separado da tela que o desenha.
 *
 * Regra de entrada de dados, decidida com a Alline: o máximo possível é toque.
 * Digitar custa caro para quem já chega sem combustível, e cada campo de texto
 * é um ponto onde a pessoa abandona. Só existem dois campos livres no fluxo
 * inteiro — o nome e o objetivo — e o do objetivo vem com atalhos prontos, de
 * modo que dá para atravessar o onboarding inteiro sem teclado.
 */

import type { BlockerId } from './reading';

export type Choice = { id: string; label: string; hint?: string };

/** Como ela chegou. Vira o primeiro dado do espelho. */
export const FEELINGS: Choice[] = [
  { id: 'Cansada', label: 'Cansada' },
  { id: 'Acelerada', label: 'Acelerada' },
  { id: 'Travada', label: 'Travada' },
  { id: 'Sensível', label: 'Sensível' },
  { id: 'Animada', label: 'Animada' },
  { id: 'Confusa', label: 'Confusa' },
  { id: 'Sobrecarregada', label: 'Sobrecarregada' },
  { id: 'Em paz', label: 'Em paz' },
];

/**
 * O que trava primeiro.
 *
 * As opções são propositalmente específicas: o documento de referência insiste
 * que a pessoa precisa ler e pensar "isso é literalmente eu". "Falta de
 * organização" não produz esse reconhecimento; "decido tanto o que fazer antes
 * que o dia acaba" produz.
 */
export const BLOCKERS: Array<Choice & { id: BlockerId }> = [
  { id: 'start', label: 'Começar', hint: 'sei o que fazer, mas não saio do lugar' },
  { id: 'prioritize', label: 'Escolher por onde', hint: 'decido tanto antes que o dia acaba' },
  { id: 'finish', label: 'Terminar', hint: 'começo várias e não fecho nenhuma' },
  { id: 'consistency', label: 'Manter', hint: 'engato uns dias e some' },
  { id: 'remember', label: 'Lembrar', hint: 'só volta na cabeça quando já passou' },
];

/**
 * Os três traços permanentes que decidem quais perguntas o app faz depois.
 *
 * Eles existiam no banco e eram `NULL` para todo mundo: a tela que os coletava
 * ficou atrás de um redirect quando o `/comecar` virou o onboarding único. O
 * preço foi visível — bloco de ciclo menstrual aparecendo para homens, pergunta
 * de medicação feita a quem não toma remédio, e o modo TDAH nunca ligando.
 *
 * Perguntar aqui, uma vez, é o que evita perguntar todo dia para sempre.
 */
export const BIOLOGICAL_SEX_CHOICES: Choice[] = [
  { id: 'female', label: 'Feminino' },
  { id: 'male', label: 'Masculino' },
];

export const MEDICATION_CHOICES: Choice[] = [
  { id: 'yes', label: 'Sim, uso' },
  { id: 'no', label: 'Não uso' },
  { id: 'prefer_not', label: 'Prefiro não dizer' },
];

/**
 * Autorrelato, não diagnóstico — e a Airia nunca devolve isso como rótulo.
 * O que muda é a conduta: TDAH declarado liga a leitura de hiperfoco, e as
 * demais calibram o tom. "Prefiro não dizer" é resposta legítima e não penaliza
 * nada; por isso aparece como escolha opcional dentro de `traits`, sem abrir
 * uma etapa extra no onboarding canônico.
 */
export const DIAGNOSIS_CHOICES: Choice[] = [
  { id: 'adhd', label: 'TDAH' },
  { id: 'bipolar_ii', label: 'Bipolaridade tipo II' },
  { id: 'cyclothymia', label: 'Ciclotimia' },
  { id: 'cyclical_depression', label: 'Depressão cíclica ou sazonal' },
  { id: 'prefer_not_to_say', label: 'Prefiro não dizer' },
];

/** Quantas frentes abertas. Faixas, não número exato — ninguém conta. */
export const OPEN_FRONTS: Array<Choice & { value: number }> = [
  { id: '1-2', label: '1 ou 2', value: 2 },
  { id: '3-4', label: 'Umas 3 ou 4', value: 4 },
  { id: '5-7', label: 'Umas 5 a 7', value: 6 },
  { id: '8+', label: 'Perdi a conta', value: 9 },
];

export const DRAINS: Choice[] = [
  { id: 'Cobrança', label: 'Cobrança' },
  { id: 'Barulho e gente', label: 'Barulho e gente' },
  { id: 'Decisão demais', label: 'Decisão demais' },
  { id: 'Dormir mal', label: 'Dormir mal' },
  { id: 'Conflito', label: 'Conflito' },
  { id: 'Bagunça em volta', label: 'Bagunça em volta' },
  { id: 'Trabalho acumulado', label: 'Trabalho acumulado' },
  { id: 'Ficar parada', label: 'Ficar parada' },
];

export const RESTORERS: Choice[] = [
  { id: 'Ar livre', label: 'Ar livre' },
  { id: 'Silêncio', label: 'Silêncio' },
  { id: 'Movimento', label: 'Movimento' },
  { id: 'Boa conversa', label: 'Boa conversa' },
  { id: 'Terminar algo', label: 'Terminar algo' },
  { id: 'Música', label: 'Música' },
  { id: 'Dormir', label: 'Dormir' },
  { id: 'Fazer algo com as mãos', label: 'Fazer algo com as mãos' },
];

export const LIST_PREFERENCE: Choice[] = [
  { id: 'one_at_a_time', label: 'Uma coisa de cada vez', hint: 'a lista inteira me trava' },
  { id: 'whole_picture', label: 'O quadro inteiro', hint: 'preciso ver tudo pra escolher' },
];

/**
 * Atalhos de objetivo.
 *
 * Existem para que ninguém precise digitar no clímax. São categorias amplas de
 * propósito: o motor de interpretação lida bem com objetivo amplo — pergunta ou
 * infere — e amplo demais é problema dele resolver, não dela.
 */
export const GOAL_SHORTCUTS: Choice[] = [
  { id: 'Deixar um cômodo da casa pronto para uso', label: 'Organizar um espaço da casa' },
  { id: 'Colocar as pendências do trabalho em dia', label: 'Pôr o trabalho em dia' },
  { id: 'Organizar minhas finanças', label: 'Organizar as finanças' },
  { id: 'Voltar a me mexer com alguma regularidade', label: 'Voltar a me mexer' },
  { id: 'Retomar uma coisa que eu larguei no meio', label: 'Retomar algo largado' },
  { id: 'Cuidar de uma pendência de saúde', label: 'Resolver algo de saúde' },
];

export const COMMITMENT: Choice[] = [
  { id: 'high', label: 'Muito. Quero que mude.' },
  { id: 'medium', label: 'Bastante, no meu ritmo.' },
  { id: 'low', label: 'Só estou olhando por enquanto.' },
];

/** Resposta da Airia ao grau de compromisso. Afirma sem cobrar. */
export const COMMITMENT_REPLY: Record<string, string> = {
  high: 'Então a gente combina assim: eu seguro o tamanho do dia, você aparece. Nos dias ruins eu diminuo, não desisto.',
  medium: 'É o ritmo certo. Constância vale mais que intensidade, e eu prefiro que você volte amanhã a que você se arrebente hoje.',
  low: 'Olhar já é alguma coisa. Fica à vontade — quando quiser começar, o caminho vai estar montado do jeito que você deixou.',
};

/**
 * Vocabulário legado que o renderer ainda reconhece para respostas retomadas.
 * `STORY_STEPS` abaixo é a única sequência apresentada em novos onboardings.
 */
export const STORY_STEP_IDS = [
  'welcome',
  'problem',
  'solution',
  'name',
  // Os três traços vêm logo depois do nome, ainda em "Pra começar": é o que
  // decide quais perguntas o app faz de hoje em diante, e perguntar depois
  // significaria já ter perguntado errado por dias.
  'traits',
  'diagnoses',
  'feeling',
  'blockers',
  'fronts',
  'reckoning',
  'bridge',
  'drains',
  'restorers',
  'preference',
  'mirror',
  'goal',
  'understanding',
  'path',
  'checkin',
  'nextAction',
  'done',
  'building',
  'outlook',
  'commitment',
  'offer',
] as const;

export type StoryStepId = (typeof STORY_STEP_IDS)[number];

/**
 * Caminho ativo: apresentação breve, duas preferências que realmente mudam as
 * perguntas futuras, estado atual, um objetivo e entrada no produto. As demais
 * telas de narrativa e diagnóstico continuariam ampliando o funil sem melhorar
 * o primeiro check-in, os padrões, o diário ou os objetivos.
 */
export const STORY_STEPS: StoryStepId[] = [
  'welcome',
  'name',
  'traits',
  'feeling',
  'goal',
  'understanding',
  'nextAction',
  'building',
  'offer',
];

/** Telas que só mostram — sem entrada, avançam num toque. */
export const READ_ONLY_STEPS = new Set<StoryStepId>([
  'welcome', 'problem', 'solution', 'reckoning', 'bridge', 'mirror',
  'understanding', 'path', 'checkin', 'nextAction', 'done', 'building', 'outlook',
  'offer',
]);
