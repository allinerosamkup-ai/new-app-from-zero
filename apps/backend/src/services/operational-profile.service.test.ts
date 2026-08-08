import assert from 'node:assert/strict';

import { deriveOperationalProfile, OperationalProfileService } from './operational-profile.service';

function fakePrisma(initial: Record<string, unknown> | null = null) {
  const store: { payload: Record<string, unknown> | null } = { payload: initial };
  return {
    store,
    onboardingResponse: {
      findUnique: async () => (store.payload === null ? null : { aiProfilePayload: store.payload }),
      upsert: async ({ update }: any) => {
        store.payload = update.aiProfilePayload;
        return { aiProfilePayload: store.payload };
      },
    },
  };
}

async function run() {
  // ── Derivação ──
  {
    const profile = deriveOperationalProfile({
      blockers: ['start', 'prioritize'],
      openFronts: 7,
    });

    assert.equal(profile.difficultyStarting, 'alta');
    assert.equal(profile.difficultyPrioritizing, 'alta');
    assert.equal(profile.preferredActionSize, 'pequeno');
    assert.equal(
      profile.idealOptionCount,
      1,
      'trava para priorizar com muita frente aberta pede UMA opção; lista longa é mais uma decisão',
    );
    assert.equal(profile.toleranceForAmbiguity, 'baixa');
  }

  {
    const profile = deriveOperationalProfile({
      blockers: ['consistency'],
      openFronts: 2,
      stepSize: 'large',
      listPreference: 'whole_picture',
    });

    assert.equal(profile.difficultyStarting, 'baixa');
    assert.equal(profile.preferredActionSize, 'medio');
    assert.equal(profile.idealOptionCount, 3);
    assert.equal(profile.explainContext, 'medio');
  }

  {
    // Poucas frentes não transforma dificuldade em "alta": o peso vem da soma.
    const profile = deriveOperationalProfile({ blockers: ['start'], openFronts: 1 });
    assert.equal(profile.difficultyStarting, 'moderada');
  }

  {
    // Resposta fora do vocabulário não vira parâmetro.
    const profile = deriveOperationalProfile({ blockers: ['inventado'], openFronts: null });
    assert.equal(profile.difficultyStarting, 'baixa');
    assert.equal(profile.difficultyPrioritizing, 'baixa');
  }

  // ── Persistência ──
  {
    const prisma = fakePrisma();
    assert.equal(await OperationalProfileService.get(prisma, 'u1'), null, 'sem onboarding, sem perfil inventado');

    const saved = await OperationalProfileService.save(prisma, 'u1', {
      blockers: ['start'],
      openFronts: 6,
    });
    assert.equal(saved.difficultyStarting, 'alta');

    const loaded = await OperationalProfileService.get(prisma, 'u1');
    assert.deepEqual(loaded, saved);
  }

  {
    // O mesmo campo guarda o feedback de ações. Gravar perfil não pode apagá-lo.
    const prisma = fakePrisma({ aiActionFeedback: [{ key: 'k', title: 'Ligar para a médica' }] });
    await OperationalProfileService.save(prisma, 'u1', { blockers: ['finish'], openFronts: 3 });

    const payload = prisma.store.payload as Record<string, unknown>;
    assert.ok(Array.isArray(payload.aiActionFeedback), 'feedback de ações preservado');
    assert.ok(payload.operationalProfile, 'perfil gravado');
    assert.ok(payload.operationalProfileAnswers, 'respostas cruas guardadas para reprocessar depois');
  }
}

run()
  .then(() => console.log('operational-profile.service tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
