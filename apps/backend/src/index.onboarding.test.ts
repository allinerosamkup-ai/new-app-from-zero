import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function run() {
  const profileUpserts: any[] = [];
  const onboardingUpserts: any[] = [];
  const preferenceUpserts: any[] = [];

  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    profile: {
      upsert: async (args: any) => {
        profileUpserts.push(args);
        return { id: args.where.id, ...args.update };
      },
    },
    onboardingResponse: {
      upsert: async (args: any) => {
        onboardingUpserts.push(args);
        return { userId: args.where.userId, ...args.update };
      },
    },
    userPreference: {
      upsert: async (args: any) => {
        preferenceUpserts.push(args);
        return { userId: args.where.userId, ...args.update };
      },
    },
  };

  const app = createApp({
    prisma: prisma as any,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
    aiService: {
      generateOnboardingProfile: async () => ({
        profileSummary: 'Perfil inicial gerado com respostas novas do onboarding.',
        routineSummaryNormalized: 'Rotina normalizada a partir das respostas novas.',
        initialStateSummary: 'Estado inicial registrado com base no novo preenchimento.',
        topThemes: ['energia', 'sono'],
        initialSuggestions: ['Fazer check-in de manhã.', 'Revisar energia à noite.', 'Proteger pausas.'],
      }),
    } as any,
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/onboarding/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Nova Alline',
        age: 34,
        currentFeeling: 'Quero refazer tudo com respostas novas.',
        sleepQualityNote: 'Sono irregular, mas melhorando.',
        wakeTime: '08:00',
        sleepTime: '23:30',
        routineText: 'Tenho mais foco de manhã.',
        mainEnergyPressure: 'Reuniões e crises drenam mais energia.',
        primaryGoal: 'Entender meus ciclos',
        supportGoals: ['Organizar rotina', 'Fazer check-in'],
      }),
    });

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.saved, true);

    assert.equal(profileUpserts[0].update.fullName, 'Nova Alline');
    assert.equal(profileUpserts[0].update.onboardingDone, true);
    assert.equal(onboardingUpserts[0].update.currentFeeling, 'Quero refazer tudo com respostas novas.');
    assert.equal(onboardingUpserts[0].update.aiProfileSummary, 'Perfil inicial gerado com respostas novas do onboarding.');
    assert.equal(preferenceUpserts[0].update.wakeTime, '08:00');
    assert.equal(preferenceUpserts[0].update.morningCheckinTime, '08:00');
    assert.equal(preferenceUpserts[0].update.eveningReviewTime, '20:00');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

run()
  .then(() => {
    console.log('index.onboarding tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
