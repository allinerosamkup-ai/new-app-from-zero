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

/** Capacidade do dia — mesma pergunta do check-in diário. */
export const CAPACITY: Choice[] = [
  { id: 'quick', label: 'Algo rápido' },
  { id: 'moderate', label: 'Moderado' },
  { id: 'heavy', label: 'Mais trabalhoso' },
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

/** Ordem das telas. Cada id vira um passo na tela do fluxo. */
export const STORY_STEPS = [
  'welcome',
  'problem',
  'solution',
  'name',
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
] as const;

export type StoryStepId = (typeof STORY_STEPS)[number];

/** Telas que só mostram — sem entrada, avançam num toque. */
export const READ_ONLY_STEPS = new Set<StoryStepId>([
  'welcome', 'problem', 'solution', 'reckoning', 'bridge', 'mirror',
  'understanding', 'path', 'nextAction', 'done', 'building', 'outlook',
]);
