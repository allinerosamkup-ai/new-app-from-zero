import assert from 'node:assert/strict';

import { PlannerAIService } from './planner-ai.service';
import {
  PlannerAISuggestionRequestSchema,
  PlannerAISuggestionResponseSchema,
} from '../contracts/planner.contract';

async function run() {
  // 1. Schema valida request mínimo
  const minRequest = PlannerAISuggestionRequestSchema.parse({
    date: '2026-05-14',
    energyState: { label: 'Estável' },
  });
  assert.equal(minRequest.energyState.suggestedIntensity, 'M');
  assert.deepEqual(minRequest.existingBlocks, []);

  // 2. Schema valida response com defaults
  const minResponse = PlannerAISuggestionResponseSchema.parse({});
  assert.deepEqual(minResponse.schedule, []);
  assert.deepEqual(minResponse.adjustedExisting, []);

  // 3. getSuggestions retorna sucesso quando OpenAI devolve JSON válido
  let capturedSystem = '';
  let capturedUser = '';
  const fakeClient = {
    chat: {
      completions: {
        create: async ({ messages }: any) => {
          capturedSystem = messages.find((m: any) => m.role === 'system')?.content ?? '';
          capturedUser = messages.find((m: any) => m.role === 'user')?.content ?? '';
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  schedule: [
                    {
                      startTime: '10:00',
                      endTime: '11:00',
                      title: 'Pintar uma parede da sala',
                      category: 'pessoal',
                      intensity: 'M',
                      isRoutine: false,
                      reasoning: 'Você mencionou pintura travada e está com energia M hoje.',
                      confidence: 0.75,
                    },
                  ],
                  adjustedExisting: [
                    { id: 'block-1', action: 'KEEP', reason: 'Compromisso firme.', confidence: 0.9 },
                  ],
                  adjustments: ['Manter ritmo leve até a tarde.'],
                  warnings: [],
                }),
              },
            }],
          };
        },
      },
    },
  };

  const result = await PlannerAIService.getSuggestions(
    {
      date: '2026-05-14',
      existingBlocks: [
        { id: 'block-1', title: 'Reunião com Julia', startTime: '14:00', endTime: '15:00', category: 'trabalho', intensity: 'M', status: 'planned' },
      ],
      energyState: { label: 'Estável', suggestedIntensity: 'M', avgMood: 4, avgEnergy: 4 },
      currentHour: 9,
      currentMinute: 30,
      phase: 'estavel',
    },
    {
      userName: 'Alinê',
      knowledgeGraphContext: '🧠 entidade: pintura da sala (project, active)',
    },
    fakeClient as any,
  );

  assert.equal(result.schedule.length, 1);
  assert.equal(result.schedule[0].title, 'Pintar uma parede da sala');
  assert.equal(result.adjustedExisting.length, 1);
  assert.equal(result.adjustedExisting[0].action, 'KEEP');
  assert.match(capturedSystem, /ORGANIZAÇÃO DO DIA/i);
  assert.match(capturedSystem, /Você gera SUGESTÕES \(não comandos\)/);
  assert.match(capturedSystem, /pintura da sala/);
  assert.match(capturedUser, /AGENDA ATUAL DO DIA/);
  assert.match(capturedUser, /block-1/);
  assert.match(capturedUser, /Reunião com Julia/);

  // 4. Filtra adjustedExisting com IDs que não vieram no input
  const fakeClient2 = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                schedule: [],
                adjustedExisting: [
                  { id: 'block-real', action: 'KEEP', reason: 'compromisso firme do dia', confidence: 0.8 },
                  { id: 'block-fantasma', action: 'CANCEL', reason: 'bloco inventado pela IA', confidence: 0.6 },
                ],
                adjustments: [],
                warnings: [],
              }),
            },
          }],
        }),
      },
    },
  };
  const filtered = await PlannerAIService.getSuggestions(
    {
      date: '2026-05-14',
      existingBlocks: [{ id: 'block-real', title: 'X', startTime: '10:00', endTime: '11:00', category: 'trabalho', intensity: 'M', status: 'planned' }],
      energyState: { label: 'Estável', suggestedIntensity: 'M' },
    },
    {},
    fakeClient2 as any,
  );
  assert.equal(filtered.adjustedExisting.length, 1, 'block-fantasma deveria ter sido filtrado');
  assert.equal(filtered.adjustedExisting[0].id, 'block-real');

  // 5. Âncoras protegidas só podem receber KEEP, mesmo se o modelo tentar mutá-las.
  const protectedResult = await PlannerAIService.getSuggestions(
    {
      date: '2026-05-14',
      existingBlocks: [{
        id: 'block-protected',
        title: 'Reunião externa',
        startTime: '10:00',
        endTime: '11:00',
        category: 'trabalho',
        intensity: 'P',
        status: 'planned',
        temporalPolicy: 'fixed',
        adaptationPermission: 'protected',
      }],
      energyState: { label: 'Baixa energia', suggestedIntensity: 'L' },
    },
    {},
    {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify({
              schedule: [],
              adjustedExisting: [{
                id: 'block-protected',
                action: 'CANCEL',
                reason: 'A energia caiu bastante hoje.',
                confidence: 0.9,
              }],
              adjustments: [],
              warnings: [],
            }) } }],
          }),
        },
      },
    } as any,
  );
  assert.equal(protectedResult.adjustedExisting[0]?.action, 'KEEP');
  assert.match(protectedResult.adjustedExisting[0]?.reason ?? '', /protegido|fixo/i);

  // 6. JSON inválido → devolve vazio (não derruba)
  const fakeBroken = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: 'isso não é JSON' } }] }),
      },
    },
  };
  const safeResult = await PlannerAIService.getSuggestions(
    { date: '2026-05-14', existingBlocks: [], energyState: { label: 'X', suggestedIntensity: 'M' } },
    {},
    fakeBroken as any,
  );
  assert.deepEqual(safeResult.schedule, []);
  assert.deepEqual(safeResult.adjustedExisting, []);

  // 7. Dedup de schedule por startTime idêntico
  const fakeDup = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                schedule: [
                  { startTime: '10:00', endTime: '10:30', title: 'Tarefa primeira', category: 'trabalho', intensity: 'M', isRoutine: false, reasoning: 'razao A primeira', confidence: 0.7 },
                  { startTime: '10:00', endTime: '10:45', title: 'Tarefa duplicada', category: 'trabalho', intensity: 'M', isRoutine: false, reasoning: 'razao duplicada B', confidence: 0.7 },
                  { startTime: '11:00', endTime: '11:30', title: 'Tarefa terceira', category: 'trabalho', intensity: 'L', isRoutine: false, reasoning: 'razao terceira C', confidence: 0.7 },
                ],
                adjustedExisting: [],
                adjustments: [],
                warnings: [],
              }),
            },
          }],
        }),
      },
    },
  };
  const dedup = await PlannerAIService.getSuggestions(
    { date: '2026-05-14', existingBlocks: [], energyState: { label: 'X', suggestedIntensity: 'M' } },
    {},
    fakeDup as any,
  );
  assert.equal(dedup.schedule.length, 2, 'duplicata por startTime deve ser filtrada');
  assert.equal(dedup.schedule[0].title, 'Tarefa primeira');
  assert.equal(dedup.schedule[1].title, 'Tarefa terceira');
}

run()
  .then(() => console.log('planner-ai.service tests passed'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
