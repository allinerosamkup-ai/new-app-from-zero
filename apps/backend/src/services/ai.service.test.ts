import assert from 'node:assert/strict';

import { getOpenAiModel } from '../lib/openai-config';
import { AIService } from './ai.service';

async function run() {
  const deltas: string[] = [];
  let capturedMessages: Array<{ role: string; content: string }> = [];
  let capturedSummaryMessages: Array<{ role: string; content: string }> = [];
  let capturedStreamModel = '';
  let capturedSummaryModel = '';

  delete process.env.OPENAI_MODEL;

  const fakeClient = {
    chat: {
      completions: {
        create: async ({ model, messages }: any) => {
          capturedStreamModel = model;
          capturedMessages = messages;
          return {
            async *[Symbol.asyncIterator]() {
              yield {
                choices: [{ delta: { content: 'Olá, ' } }],
              };
              yield {
                choices: [{ delta: { content: 'vamos organizar isso juntas.' } }],
              };
            },
          };
        },
      },
    },
  };

  const result = await AIService.streamJournalReply(
    {
      context: {
        routineSummary: 'Costuma trabalhar melhor no fim da manhã.',
        promptSummary: 'Rotina percebida: Costuma trabalhar melhor no fim da manhã.',
        topThemes: ['trabalho'],
        topPlannerCategories: ['trabalho'],
        userName: 'Ana',
        userProfileSummary: 'Prefere blocos mais leves quando acorda cansada.',
        journalContext: [
          'Mensagem atual: Ontem tive audiência e ainda estou irritada.',
          'Memórias recuperadas/fallback: audiência anterior ativou medo de parecer despreparada.',
          'Planner relevante (usar só se conectar ao relato): Preparar documento da audiência.',
        ].join('\n'),
        checkinToday: {
          moodScore: 3,
          energyScore: 2,
          stateLabel: 'Dia sensível',
        },
        moodCycleContext: 'Humor em queda suave, energia 2/5.',
        recentSuggestionMemory: 'MEMORIA RECENTE DE SUGESTOES DA AURA:\n- [journal/comunicacao] Mandar mensagem pedindo ajuste de prazo',
        activeGoalsContext: 'Meta: Preparar apresentação | próxima ação pendente: abrir roteiro',
        ragContext: 'MEMÓRIAS RELEVANTES:\n[Diário] Energia cai quando acumula reuniões sem intervalo.',
        plannerContext: 'AGENDA DE HOJE:\n· Preparar apresentação — 14:00–15:00 — trabalho',
      },
      history: [
        { role: 'user', content: 'Estou preocupada com minha energia.' },
      ],
      message: 'Hoje eu já comecei atrasada.',
      onDelta: (chunk) => {
        deltas.push(chunk);
      },
    },
    fakeClient as any,
  );

  assert.equal(result, 'Olá, vamos organizar isso juntas.');
  assert.deepEqual(deltas, ['Olá, ', 'vamos organizar isso juntas.']);
  assert.equal(capturedMessages[0]?.role, 'system');
  assert.match(capturedMessages[0]?.content || '', /DIÁRIO \(PRESENÇA REFLEXIVA\)/i);
  assert.match(capturedMessages[0]?.content || '', /Não presuma diagnósticos/i);
  assert.match(capturedMessages[0]?.content || '', /PERSONALIDADE E ALMA/i);
  assert.match(capturedMessages[0]?.content || '', /CICLO DE HUMOR ATUAL/i);
  assert.match(capturedMessages[0]?.content || '', /Humor em queda suave/i);
  assert.match(capturedMessages[0]?.content || '', /Mandar mensagem pedindo ajuste de prazo/i);
  assert.match(capturedMessages[0]?.content || '', /NUCLEO FUNCIONAL COMPARTILHADO/i);
  assert.match(capturedMessages[0]?.content || '', /padrões, decisões e ciclos de humor/i);
  assert.match(capturedMessages[0]?.content || '', /Meta: Preparar apresentação/i);
  assert.match(capturedMessages[0]?.content || '', /Energia cai quando acumula reuniões/i);
  assert.match(capturedMessages[0]?.content || '', /CONTEXTO REFLEXIVO DO DIÁRIO/i);
  assert.match(capturedMessages[0]?.content || '', /Ontem tive audiência/i);
  assert.match(capturedMessages[0]?.content || '', /Preparar documento da audiência/i);
  assert.match(capturedMessages[0]?.content || '', /CRONOLOGIA É SAGRADA/i);
  assert.match(capturedMessages[0]?.content || '', /PROIBIDO PARÁFRASE VAZIA/i);
  assert.match(capturedMessages[0]?.content || '', /PROVA DE CONTEXTO/i);
  assert.doesNotMatch(capturedMessages[0]?.content || '', /escolha só um formato/i);
  assert.match(capturedMessages[0]?.content || '', /máximo 1 pergunta/i);
  assert.match(capturedMessages[0]?.content || '', /colete em micro-passos/i);
  assert.match(capturedMessages[0]?.content || '', /BASE DOCUMENTADA, NÃO IMPROVISO/i);
  assert.match(capturedMessages[0]?.content || '', /utilidade possível do problema/i);
  assert.match(capturedMessages[0]?.content || '', /RESPOSTA EXCELENTE/i);
  assert.match(capturedMessages[0]?.content || '', /PADRÃO AIRIA DE RESPOSTA/i);
  assert.match(capturedMessages[0]?.content || '', /MANOBRA ESPECÍFICA/i);
  assert.match(capturedMessages[0]?.content || '', /SCRIPT PRONTO/i);
  assert.match(capturedMessages[0]?.content || '', /MEMÓRIA ANTES DE PADRÃO/i);
  assert.match(capturedMessages[0]?.content || '', /SINAIS ANTES DA QUEDA/i);
  assert.match(capturedMessages[0]?.content || '', /evidência concreta/i);
  assert.equal(capturedStreamModel, getOpenAiModel());
  assert.equal(capturedMessages[1]?.role, 'user');
  assert.match(capturedMessages[1]?.content || '', /Estou preocupada com minha energia/i);

  const fakeSummaryClient = {
    chat: {
      completions: {
        create: async ({ model, messages }: any) => {
          capturedSummaryModel = model;
          capturedSummaryMessages = messages;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'Hoje ela encostou em um cansaço antigo e conseguiu nomear esse peso com mais delicadeza.',
                    emotions: ['cansaço', 'alívio'],
                    themes: ['trabalho'],
                    suggestions: ['Talvez amanhã caiba começar um pouco mais devagar.'],
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const summary = await AIService.summarizeJournalSession(
    [
      { role: 'user', content: 'Hoje eu senti um peso estranho no corpo.' },
      { role: 'assistant', content: 'Parece um dia de carga mais espessa.' },
    ],
    fakeSummaryClient as any,
  );

  assert.equal(summary.emotions[0], 'cansaço');
  assert.equal(summary.themes[0], 'trabalho');
  assert.equal(capturedSummaryMessages[0]?.role, 'system');
  assert.match(capturedSummaryMessages[0]?.content || '', /RETRATO DO DIA/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /contemplativa e humana/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /padrão que apareceu, decisão concreta em jogo/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /evento real vs história criada/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /utilidade do problema/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /Não invente profundidade/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /Não faça perguntas no fechamento/i);
  assert.match(capturedSummaryMessages[1]?.content || '', /Não escreva como relatório/i);
  assert.equal(capturedSummaryModel, getOpenAiModel());
}

run()
  .then(() => {
    console.log('ai.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
