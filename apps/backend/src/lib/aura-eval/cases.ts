import type { AuraPromptDomain } from '../aura-prompt';

/**
 * Aura eval cases — fixtures used by the eval runner to score real OpenAI
 * responses against deterministic invariants. Each case is small and
 * self-contained.
 *
 * Adding a case:
 *   1. Pick a domain (planning, home, journal-live, journal-finalize,
 *      aura-command, checkin).
 *   2. Provide minimal moodCycleContext + recent context (text the prompt
 *      builder accepts).
 *   3. Provide the userMessage that the Aura must respond to.
 *   4. Define `expects` invariants. Prefer multiple cheap invariants over
 *      one big subjective check.
 *
 * Invariants run by `matchers.ts`:
 *   - mustInclude: response must contain ALL strings (case-insensitive).
 *   - mustNotInclude: response must NOT contain ANY of these strings.
 *   - mustNotEndWithQuestion: last sentence must not be a question
 *     (used for journal-finalize).
 *   - mustEndWithQuestionOrCallToAction: last sentence must end with
 *     '?' OR an imperative verb pattern.
 *   - maxSentences / minSentences: hard length window.
 *   - mustReferenceAnchorFromContext: response must mention at least one
 *     of the provided anchor phrases (proves grounding).
 *   - mustNotInventTask: response must not propose a new task that wasn't
 *     mentioned in the context (heuristic via the anchor list).
 */

export type AuraEvalExpects = {
  mustInclude?: string[];
  mustNotInclude?: string[];
  mustNotEndWithQuestion?: boolean;
  mustEndWithQuestionOrCallToAction?: boolean;
  maxSentences?: number;
  minSentences?: number;
  mustReferenceAnchorFromContext?: string[];
};

export type AuraEvalCase = {
  id: string;
  domain: AuraPromptDomain;
  /** Notes on what this case is protecting against. */
  rationale: string;
  promptInputs: {
    userName?: string;
    profileSummary?: string;
    moodCycleContext?: string;
    plannerContext?: string;
    journalContext?: string;
    activeGoalsContext?: string;
    recentSuggestionMemory?: string;
    extraInstructions?: string[];
  };
  history?: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
  expects: AuraEvalExpects;
};

export const AURA_EVAL_CASES: AuraEvalCase[] = [
  // ───── HOME ─────
  {
    id: 'home/grounded-anchor',
    domain: 'home',
    rationale:
      'Home só pode propor ação se houver âncora real do dia. Aqui há tarefa pendente real.',
    promptInputs: {
      userName: 'Alline',
      moodCycleContext: 'Fase: Desacelerando. Energia 4/10. Humor 5/10.',
      plannerContext: 'Pendente hoje: "Responder email do contador" às 14h.',
    },
    userMessage: 'O que faço com esse fim de tarde meio caído?',
    expects: {
      maxSentences: 5,
      mustReferenceAnchorFromContext: ['email', 'contador', '14h', 'desacelerando'],
      mustNotInclude: ['investidor', 'demo', 'pitch'],
    },
  },
  {
    id: 'home/no-anchor-asks-instead',
    domain: 'home',
    rationale:
      'Sem âncora operacional, Home não inventa tarefa — pergunta o fato que falta.',
    promptInputs: {
      userName: 'Alline',
      moodCycleContext: 'Fase: Estável. Energia 6/10. Humor 6/10.',
      plannerContext: 'Sem compromissos pendentes hoje.',
    },
    userMessage: 'Bom dia.',
    expects: {
      maxSentences: 4,
      mustEndWithQuestionOrCallToAction: true,
      mustNotInclude: ['vou criar uma tarefa', 'agendei', 'marquei na sua agenda'],
    },
  },

  // ───── PLANNING ─────
  {
    id: 'planning/low-energy-reduces-load',
    domain: 'planning',
    rationale:
      'Energia baixa → reduzir escopo, não empilhar. Compromissos reais antes de novidade.',
    promptInputs: {
      moodCycleContext: 'Fase: Recolhimento. Energia 2/10. Humor 4/10.',
      plannerContext: '3 blocos pendentes: "Reunião 11h", "Revisar PR 14h", "Academia 19h".',
    },
    userMessage: 'Como organizar isso aqui?',
    expects: {
      mustReferenceAnchorFromContext: ['reunião', 'PR', 'academia', 'recolhimento'],
      mustNotInclude: ['adicione mais', 'vamos incluir tarefas extras'],
      maxSentences: 8,
    },
  },
  {
    id: 'planning/high-energy-asks-for-limit',
    domain: 'planning',
    rationale:
      'Energia alta sem limite vira queima. Aura propõe foco com borda, não maratona.',
    promptInputs: {
      moodCycleContext: 'Fase: Voo Alto. Energia 9/10. Humor 8/10.',
      plannerContext: 'Pendente: "Spec do feature X", "Onboarding de cliente novo".',
    },
    userMessage: 'Tô a mil, quero matar 10 coisas hoje. Por onde começo?',
    expects: {
      mustReferenceAnchorFromContext: ['spec', 'feature x', 'onboarding'],
      maxSentences: 8,
    },
  },

  // ───── JOURNAL-LIVE ─────
  {
    id: 'journal-live/short-acknowledgment-no-list',
    domain: 'journal-live',
    rationale:
      'Diário ao vivo é conversa. Não pode abrir com lista nem cabeçalho.',
    promptInputs: {
      moodCycleContext: 'Fase: Turbulência. Humor 3/10.',
    },
    userMessage: 'Brigamos de novo. Me sinto a pior pessoa do mundo.',
    expects: {
      maxSentences: 6,
      mustNotInclude: ['1.', '2.', '3.', '- ', '* ', 'PASSO 1', 'CHECKLIST'],
    },
  },
  {
    id: 'journal-live/separates-fact-from-conclusion',
    domain: 'journal-live',
    rationale:
      'Quando há catastrofização, separar fato de conclusão sem soar como terapeuta de manual.',
    promptInputs: {
      moodCycleContext: 'Fase: Desacelerando.',
    },
    userMessage:
      'Meu chefe respondeu meu email só com "ok". Tenho certeza que ele tá puto e vai me demitir.',
    expects: {
      maxSentences: 7,
      mustNotInclude: ['você tem ansiedade', 'distorção cognitiva', 'TCC', 'diagnóstico'],
    },
  },

  // ───── JOURNAL-FINALIZE ─────
  {
    id: 'journal-finalize/no-question-no-new-task',
    domain: 'journal-finalize',
    rationale:
      'Fechamento NUNCA termina com pergunta nem inventa tarefa nova.',
    promptInputs: {
      moodCycleContext: 'Fase: Estável.',
      journalContext:
        'Sessão de hoje: cansaço pela manhã, ligou pra mãe, decidiu pausar academia hoje.',
    },
    userMessage: '[Finalizar sessão de diário]',
    expects: {
      mustNotEndWithQuestion: true,
      mustNotInclude: [
        'vou criar uma tarefa',
        'que tal adicionar',
        'sugiro marcar na agenda',
      ],
      mustReferenceAnchorFromContext: ['cansaço', 'mãe', 'academia'],
    },
  },
  {
    id: 'journal-finalize/keeps-rejected-suggestions-out',
    domain: 'journal-finalize',
    rationale:
      'Rejeição vira bloqueio, não sugestão de fechamento.',
    promptInputs: {
      journalContext:
        'Conversa: pessoa rejeitou explicitamente "ligar para psicóloga hoje". Aceitou "respirar 5 min antes de dormir".',
    },
    userMessage: '[Finalizar sessão de diário]',
    expects: {
      mustInclude: ['respirar'],
      mustNotInclude: ['ligar para psicóloga', 'agendar consulta hoje'],
      mustNotEndWithQuestion: true,
    },
  },

  // ───── AURA-COMMAND ─────
  {
    id: 'aura-command/executes-not-explains',
    domain: 'aura-command',
    rationale:
      'Comando claro = executar curto, não explicar metodologia.',
    promptInputs: {
      moodCycleContext: 'Fase: Fluindo.',
    },
    userMessage: 'cria uma tarefa pra hoje 18h: comprar pão',
    expects: {
      maxSentences: 4,
      mustReferenceAnchorFromContext: ['pão', 'pao', '18h'],
      mustNotInclude: [
        'método',
        'metodologia',
        'vou explicar como funciona',
        'nome de metodologia interna',
      ],
    },
  },
  {
    id: 'aura-command/asks-only-missing-fact',
    domain: 'aura-command',
    rationale:
      'Se faltar dado essencial, perguntar APENAS o indispensável.',
    promptInputs: {
      moodCycleContext: 'Fase: Estável.',
    },
    userMessage: 'agenda uma reunião com a Carol',
    expects: {
      maxSentences: 3,
      mustEndWithQuestionOrCallToAction: true,
    },
  },

  // ───── CHECKIN ─────
  {
    id: 'checkin/cites-concrete-nuance',
    domain: 'checkin',
    rationale:
      'Análise deve citar nuance concreta, não resumir números.',
    promptInputs: {
      moodCycleContext:
        'Check-in agora: humor 4, energia 3, sono 5, irritabilidade 7. Nota: "Acordei com dor de cabeça e mensagem mal resolvida do meu pai."',
    },
    userMessage: '[Avaliar check-in]',
    expects: {
      mustReferenceAnchorFromContext: ['dor de cabeça', 'pai', 'irritabilidade'],
      mustNotInclude: [
        'sua média de humor é',
        'em uma escala de 1 a 10',
        'parabéns por preencher',
      ],
      maxSentences: 8,
    },
  },
  {
    id: 'checkin/low-energy-protects-window',
    domain: 'checkin',
    rationale:
      'Energia baixa pede proteção de janela ou versão mínima, não maratona.',
    promptInputs: {
      moodCycleContext: 'Check-in agora: humor 4, energia 2, sono 4. Nota: "muito cansada, tem call importante 16h".',
      plannerContext: 'Pendente: call 16h.',
    },
    userMessage: '[Avaliar check-in]',
    expects: {
      mustReferenceAnchorFromContext: ['call', '16h', 'cansada'],
      mustNotInclude: ['adicione mais tarefas', 'vamos encher o dia'],
      maxSentences: 8,
    },
  },
];
