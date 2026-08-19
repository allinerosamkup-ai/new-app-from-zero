/**
 * Teste de regressão do bug do split de ações (2026-08-19).
 *
 * O que aconteceu: a criação de "Correr 3 x na semana" caiu no fallback porque
 * a IA estourou o timeout, e o fallback antigo transformou as falas do diário
 * ("Olá tudo bem", "Obrigada", "Sim"...) em ações literais, gravadas como
 * caminho pronto. Este arquivo garante que o fallback novo nunca mais faça
 * isso: passos centrados na meta, executáveis no mundo real, sem raspar o
 * contexto como texto de ação.
 */
import { describe, expect, test } from 'vitest';
import {
  buildFallbackGoalDecomposition,
  isConversationalPhrase,
} from './goal-intelligence.service';
import { filterStatementsForGoal } from '../lib/context-domain';

// A higiene usada pelo orquestrador do caminho: conversa nunca vira ação.
const cleanStatements = (statements: string[] | undefined): string[] =>
  (statements ?? []).filter((statement) => !isConversationalPhrase(statement));

function titles(input: Parameters<typeof buildFallbackGoalDecomposition>[0]): string[] {
  return buildFallbackGoalDecomposition(input).steps.map((step) => step.title);
}

describe('fallback canônico centrado na meta (nunca finge caminho válido)', () => {
  test('regressão: "Correr 3 x na semana" não raspa falas do diário nem vira robô', () => {
    const steps = titles({
      goalTitle: 'Correr 3 x na semana',
      locale: 'pt-BR',
      userStatements: ['Olá tudo bem', 'Obrigada', 'Sim', 'Deixar claro pra mim mesma que terminou', 'Como vc faria isso'],
    });
    const joined = steps.join(' ').toLowerCase();
    expect(steps.some((step) => /^anote\b/i.test(step))).toBe(false);
    expect(joined).not.toContain('olá tudo bem');
    expect(joined).not.toContain('obrigada');
    // Passos físicos efetivos: preparação, logística e a corrida em si.
    expect(steps.some((step) => /t[eê]nis|rot?a|hor[aá]rio|treino|correr|caminhada|cal[eç]a/i.test(step))).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  test('"Cozinhar mais em casa" abre com passos práticos de verdade', () => {
    const steps = titles({ goalTitle: 'Cozinhar mais em casa', locale: 'pt-BR' });
    const joined = steps.join(' ').toLowerCase();
    expect(steps.some((step) => /^anote\b/i.test(step))).toBe(false);
    expect(joined).toMatch(/receita|ingredient|despensa|fog[aã]o|mercado|refeiç[aã]o|cozinh/);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  test('entrada vazia ainda vira caminho mínimo centrado na meta', () => {
    const steps = titles({ goalTitle: 'Ler mais', locale: 'pt-BR', userStatements: [] });
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.some((step) => /^anote\b/i.test(step))).toBe(false);
  });

  test('meta de trabalho sem domínio conhecido também recebe passos executáveis', () => {
    const steps = titles({ goalTitle: 'Entregar o relatório trimestral', locale: 'pt-BR' });
    expect(steps.some((step) => /^anote\b/i.test(step))).toBe(false);
    expect(steps.some((step) => /relat[oó]rio|reuni[aã]o|dados|responder|definir/i.test(step))).toBe(true);
  });
});

describe('higiene de statements (conversa nunca vira ação)', () => {
  const conversational = ['Olá tudo bem', 'Oi, tudo bem?', 'Obrigada', 'obrigado', 'Sim', 'Não', 'Bom dia', 'haha', 'kkk', 'Como vc faria isso'];
  const real = ['Estou separando o tênis para correr hoje', 'Preciso escolher a receita da semana', 'Vou viajar para visitar minha família semana que vem'];

  test('frases de conversação são filtradas da higiene', () => {
    for (const phrase of conversational) {
      expect(isConversationalPhrase(phrase), `${phrase} deveria ser conversação`).toBe(true);
    }
  });

  test('intenções reais NÃO são confundidas com conversação', () => {
    for (const phrase of real) {
      expect(isConversationalPhrase(phrase), `${phrase} NÃO deveria ser conversação`).toBe(false);
    }
  });

  test('cleanStatements remove conversação e preserva intenção', () => {
    const mixed = ['Olá tudo bem', 'Estou separando o tênis para correr hoje', 'Obrigada', 'Preciso escolher a receita da semana'];
    const cleaned = cleanStatements(mixed);
    expect(cleaned).toEqual(['Estou separando o tênis para correr hoje', 'Preciso escolher a receita da semana']);
  });
});

describe('pertinência (filterStatementsForGoal)', () => {
  test('fala de diário fora do contexto da meta fica de fora do material', () => {
    const statements = ['Fui ao mercado ontem', 'Olá tudo bem', 'Hoje corri na corrida do bairro, 30 minutos de treino', 'Obrigada'];
    const { relevant, excluded } = filterStatementsForGoal(statements, 'Corrida 3 x na semana');
    expect(relevant).toContain('Hoje corri na corrida do bairro, 30 minutos de treino');
    expect(relevant).not.toContain('Olá tudo bem');
    expect(relevant).not.toContain('Obrigada');
    // E as falas de conversa ficam registradas como excluídas, com motivo honesto.
    expect(excluded.map((row) => row.statement)).toContain('Olá tudo bem');
    expect(excluded.map((row) => row.statement)).toContain('Obrigada');
  });
});
