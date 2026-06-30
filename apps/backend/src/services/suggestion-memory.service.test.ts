import assert from 'node:assert/strict';

import { SuggestionMemoryService } from './suggestion-memory.service';

async function run() {
  const recent = [
    {
      key: SuggestionMemoryService.buildKey('Enviar uma mensagem objetiva pedindo ajuste de prazo'),
      theme: 'comunicacao',
      text: 'Enviar uma mensagem objetiva pedindo ajuste de prazo',
      sourceSurface: 'journal',
      createdAt: new Date().toISOString(),
    },
    {
      key: SuggestionMemoryService.buildKey('Respirar por 1 minuto antes de responder'),
      theme: 'somatico',
      text: 'Respirar por 1 minuto antes de responder',
      sourceSurface: 'home',
      createdAt: new Date().toISOString(),
    },
  ];

  assert.equal(
    SuggestionMemoryService.isSimilar('Mandar mensagem pedindo ajuste de prazo', recent[0]),
    true,
  );
  assert.equal(
    SuggestionMemoryService.isSimilar('Abrir o calendário e marcar o bloco de foco', recent[0]),
    false,
  );

  const prompt = SuggestionMemoryService.formatForPrompt(recent);
  assert.match(prompt, /MEMORIA RECENTE DE SUGESTOES/i);
  assert.match(prompt, /nao repita/i);
  assert.match(prompt, /retomando a sugestao anterior/i);

  const extracted = SuggestionMemoryService.extractTextsFromSuggestion('home-messages', {
    motivacional: 'Hoje vale reduzir atrito.',
    autocuidado: ['Separar o remédio da noite', 'Separar o remédio da noite'],
    proactive: {
      title: 'Abrir planner',
      desc: 'Isso reduz a confusão do fim do dia.',
    },
  });

  assert.deepEqual(extracted, [
    'Separar o remédio da noite',
    'Abrir planner',
    'Isso reduz a confusão do fim do dia.',
  ]);

  const storedPayloads: any[] = [];
  const prisma = {
    onboardingResponse: {
      findUnique: async () => ({
        aiProfilePayload: {
          recentSuggestionMemory: recent,
          longTermMemory: 'preserve',
        },
      }),
      upsert: async (payload: any) => {
        storedPayloads.push(payload);
      },
    },
  };

  await SuggestionMemoryService.append(prisma, 'user-1', 'checkin', [
    'Abrir o calendário e marcar o bloco de foco',
  ]);

  assert.equal(storedPayloads.length, 1);
  assert.equal(storedPayloads[0].update.aiProfilePayload.longTermMemory, 'preserve');
  assert.equal(storedPayloads[0].update.aiProfilePayload.recentSuggestionMemory[0].sourceSurface, 'checkin');
  assert.equal(storedPayloads[0].update.aiProfilePayload.recentSuggestionMemory[0].theme, 'execucao');
}

run()
  .then(() => {
    console.log('suggestion-memory.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
