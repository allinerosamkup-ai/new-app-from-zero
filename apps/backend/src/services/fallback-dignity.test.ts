/**
 * Teste de regressão do bug do split de ações (2026-08-19).
 *
 * O que aconteceu: a criação de "Correr 3 x na semana" caiu no fallback porque
 * a IA estourou o timeout, e o fallback antigo transformou as falas do diário
 * ("Olá tudo bem", "Obrigada", "Sim"...) em ações literais, gravadas como
 * caminho pronto. Este arquivo garante que o fallback novo nunca mais faça
 * isso: passos centrados na meta, executáveis no mundo real, sem raspar o
 * contexto como texto de ação.
 *
 * Usa `node:assert/strict`, o mesmo padrão do restante dos testes do backend
 * (executados por `node scripts/run-tests.mjs` com ts-node-transpile-only).
 */
import assert from 'node:assert/strict';
import {
  buildFallbackGoalDecomposition,
  isConversationalPhrase,
} from './goal-intelligence.service';
import { filterStatementsForGoal } from '../lib/context-domain';

// A higiene usada pelo orquestrador do caminho: conversa nunca vira ação.
const cleanStatements = (statements: string[] | undefined): string[] =>
  (statements ?? []).filter((statement) => !isConversationalPhrase(statement));

function titles(
  input: Parameters<typeof buildFallbackGoalDecomposition>[0],
): string[] {
  return buildFallbackGoalDecomposition(input).steps.map((step) => step.title);
}

// ---------------------------------------------------------------
// Fallback canônico centrado na meta (nunca finge caminho válido)
// ---------------------------------------------------------------

// Regressão: "Correr 3 x na semana" não raspa falas do diário nem vira robô.
(() => {
  const steps = titles({
    goalTitle: 'Correr 3 x na semana',
    userStatements: [
      'Olá tudo bem',
      'Obrigada',
      'Sim',
      'Deixar claro pra mim mesma que terminou',
      'Como vc faria isso',
    ],
  });
  const joined = steps.join(' ').toLowerCase();
  assert.ok(
    !steps.some((step) => /^anote\b/i.test(step)),
    'nenhum passo deveria começar com "anote"',
  );
  assert.ok(!joined.includes('olá tudo bem'), 'diário não deve virar ação');
  assert.ok(!joined.includes('obrigada'), 'diário não deve virar ação');
  // Passos físicos efetivos: preparação, logística e a corrida em si.
  assert.ok(
    steps.some((step) =>
      /t[eê]nis|rot?a|hor[aá]rio|treino|correr|caminhada|cal[eç]a/i.test(step),
    ),
    `esperava passos físicos de corrida, recebi: ${steps.join('; ')}`,
  );
  assert.ok(steps.length >= 3, 'pelo menos 3 passos práticos');
})();

// "Cozinhar mais em casa" abre com passos práticos de verdade.
(() => {
  const steps = titles({ goalTitle: 'Cozinhar mais em casa' });
  const joined = steps.join(' ').toLowerCase();
  assert.ok(
    !steps.some((step) => /^anote\b/i.test(step)),
    'nenhum passo deveria começar com "anote"',
  );
  assert.match(
    joined,
    /receita|ingredient|despensa|fog[aã]o|mercado|refeiç[aã]o|cozinh/,
    'esperava passos de cozinha',
  );
  assert.ok(steps.length >= 3, 'pelo menos 3 passos práticos');
})();

// Entrada vazia ainda vira caminho mínimo centrado na meta.
(() => {
  const steps = titles({ goalTitle: 'Ler mais', userStatements: [] });
  assert.ok(steps.length >= 2, 'pelo menos 2 passos');
  assert.ok(
    !steps.some((step) => /^anote\b/i.test(step)),
    'nenhum passo deveria começar com "anote"',
  );
})();

// Meta de trabalho sem domínio conhecido também recebe passos executáveis.
(() => {
  const steps = titles({ goalTitle: 'Entregar o relatório trimestral' });
  assert.ok(
    !steps.some((step) => /^anote\b/i.test(step)),
    'nenhum passo deveria começar com "anote"',
  );
  assert.ok(
    steps.some((step) =>
      /relat[oó]rio|reuni[aã]o|dados|responder|definir/i.test(step),
    ),
    'esperava passos práticos de trabalho',
  );
})();

// ---------------------------------------------------------------
// Higiene de statements (conversa nunca vira ação)
// ---------------------------------------------------------------

const conversational = [
  'Olá tudo bem',
  'Oi, tudo bem?',
  'Obrigada',
  'obrigado',
  'Sim',
  'Não',
  'Bom dia',
  'haha',
  'kkk',
  'Como vc faria isso',
];
const real = [
  'Estou separando o tênis para correr hoje',
  'Preciso escolher a receita da semana',
  'Vou viajar para visitar minha família semana que vem',
];

for (const phrase of conversational) {
  assert.equal(
    isConversationalPhrase(phrase),
    true,
    `${phrase} deveria ser conversação`,
  );
}
for (const phrase of real) {
  assert.equal(
    isConversationalPhrase(phrase),
    false,
    `${phrase} NÃO deveria ser conversação`,
  );
}

// cleanStatements remove conversação e preserva intenção.
(() => {
  const mixed = [
    'Olá tudo bem',
    'Estou separando o tênis para correr hoje',
    'Obrigada',
    'Preciso escolher a receita da semana',
  ];
  const cleaned = cleanStatements(mixed);
  assert.deepEqual(cleaned, [
    'Estou separando o tênis para correr hoje',
    'Preciso escolher a receita da semana',
  ]);
})();

// ---------------------------------------------------------------
// Pertinência (filterStatementsForGoal)
// ---------------------------------------------------------------

(() => {
  const statements = [
    'Fui ao mercado ontem',
    'Olá tudo bem',
    'Hoje corri na corrida do bairro, 30 minutos de treino',
    'Obrigada',
  ];
  const { relevant, excluded } = filterStatementsForGoal(
    statements,
    'Corrida 3 x na semana',
  );
  assert.ok(relevant.includes('Hoje corri na corrida do bairro, 30 minutos de treino'));
  assert.ok(!relevant.includes('Olá tudo bem'));
  assert.ok(!relevant.includes('Obrigada'));
  // E as falas de conversa ficam registradas como excluídas, com motivo honesto.
  assert.ok(excluded.map((row) => row.statement).includes('Olá tudo bem'));
  assert.ok(excluded.map((row) => row.statement).includes('Obrigada'));
})();
