import assert from 'node:assert/strict';

import { createProfileBootstrapper } from './auth';

async function run() {
  const calls: any[] = [];
  const bootstrap = createProfileBootstrapper({
    upsert: async (args: any) => {
      calls.push(args);
      return { id: args.where.id };
    },
  });

  const user = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_metadata: { full_name: 'Teste integrado Airia' },
  };

  await Promise.all([bootstrap(user), bootstrap(user)]);

  assert.equal(calls.length, 1, 'one authenticated user is bootstrapped once per process');
  assert.deepEqual(calls[0], {
    where: { id: user.id },
    update: {},
    create: { id: user.id, fullName: 'Teste integrado Airia' },
  });

  let attempts = 0;
  const retryable = createProfileBootstrapper({
    upsert: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('database unavailable');
      return {};
    },
  });

  await assert.rejects(() => retryable({ id: '660e8400-e29b-41d4-a716-446655440000' }));
  await retryable({ id: '660e8400-e29b-41d4-a716-446655440000' });
  assert.equal(attempts, 2, 'a failed bootstrap can be retried');
}

run()
  .then(() => console.log('auth profile bootstrap tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
