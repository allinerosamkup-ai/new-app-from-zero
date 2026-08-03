import assert from 'node:assert/strict';

import {
  CONSENT_TYPES,
  CURRENT_CONSENT_VERSION,
  recordInitialConsents,
  revokeConsent,
  summarizeConsents,
} from './consent.service';

type UpsertCall = { userId: string; consentType: string; version: string; granted: boolean; grantedAt: Date };

function makeRepo(existing: UpsertCall[] = []) {
  const rows = [...existing];
  const updateManyCalls: Array<Record<string, unknown>> = [];
  return {
    rows,
    updateManyCalls,
    async upsert(args: any) {
      const key = args.where.userId_consentType_version;
      const found = rows.find(
        (r) => r.userId === key.userId && r.consentType === key.consentType && r.version === key.version,
      );
      // Espelha o comportamento do Prisma: existindo, aplica `update` (vazio).
      if (found) return found;
      const created = { ...args.create } as UpsertCall;
      rows.push(created);
      return created;
    },
    async findMany() {
      return rows as any;
    },
    async updateMany(args: any) {
      updateManyCalls.push(args.where);
      const hit = rows.filter((r) => r.userId === args.where.userId && r.consentType === args.where.consentType);
      hit.forEach((r) => Object.assign(r, args.data));
      return { count: hit.length };
    },
  };
}

async function run() {
  // A tabela Consent existia e era exportada, mas nada nunca a escrevia — o
  // export saía sempre vazio e o app não conseguia provar consentimento.
  const repo = makeRepo();
  const now = new Date('2026-08-02T10:00:00Z');
  await recordInitialConsents(repo as any, 'user-1', now);

  assert.equal(repo.rows.length, CONSENT_TYPES.length);
  assert.deepEqual(
    repo.rows.map((r) => r.consentType).sort(),
    [...CONSENT_TYPES].sort(),
  );
  assert.ok(repo.rows.every((r) => r.granted === true));
  assert.ok(repo.rows.every((r) => r.version === CURRENT_CONSENT_VERSION));

  // Idempotente: o bootstrap roda a cada processo novo, e reexecutar não pode
  // duplicar nem reescrever a data do primeiro aceite, que é a prova legal.
  await recordInitialConsents(repo as any, 'user-1', new Date('2026-09-01T10:00:00Z'));
  assert.equal(repo.rows.length, CONSENT_TYPES.length, 'reexecutar duplicou consentimento');
  assert.equal(repo.rows[0].grantedAt.toISOString(), now.toISOString(), 'data original foi sobrescrita');

  // Revogação preserva o registro: apagar destruiria a prova do período anterior.
  const revokedAt = new Date('2026-10-01T10:00:00Z');
  const count = await revokeConsent(repo as any, 'user-1', 'privacy_policy', revokedAt);
  assert.equal(count, 1);

  const summary = summarizeConsents(repo.rows as any);
  const privacy = summary.find((s) => s.type === 'privacy_policy')!;
  assert.equal(privacy.granted, false);
  assert.equal(privacy.revokedAt, revokedAt.toISOString());
  assert.equal(privacy.grantedAt, now.toISOString(), 'histórico do aceite foi perdido na revogação');

  // Revogar um tipo não derruba o outro.
  const terms = summary.find((s) => s.type === 'terms_of_use')!;
  assert.equal(terms.granted, true);
}

run()
  .then(() => {
    console.log('consent.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
