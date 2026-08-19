import assert from 'node:assert/strict';

import { AiriaReadingService } from './airia-reading.service';

const userId = '11111111-1111-4111-8111-111111111111';
const date = '2026-08-13';
const checkins = [
  { id: 'morning', userId, localDate: new Date(`${date}T00:00:00.000Z`), recordedAt: new Date(`${date}T08:00:00.000Z`), updatedAt: new Date(`${date}T08:00:00.000Z`), checkinSlot: 'morning', checkinPurpose: 'window', moodScore: 8, energyScore: 8, stateLabel: 'Voo Alto', stateSummary: 'Alta energia.', aiState: {}, note: null },
  { id: 'midday', userId, localDate: new Date(`${date}T00:00:00.000Z`), recordedAt: new Date(`${date}T13:00:00.000Z`), updatedAt: new Date(`${date}T13:00:00.000Z`), checkinSlot: 'midday', checkinPurpose: 'window', moodScore: 3, energyScore: 3, stateLabel: 'Pausa', stateSummary: 'Queda importante.', aiState: {}, note: null },
  { id: 'evening', userId, localDate: new Date(`${date}T00:00:00.000Z`), recordedAt: new Date(`${date}T21:00:00.000Z`), updatedAt: new Date(`${date}T21:00:00.000Z`), checkinSlot: 'evening', checkinPurpose: 'window', moodScore: 7, energyScore: 6, stateLabel: 'Retomada', stateSummary: 'Recuperação parcial.', aiState: {}, note: null },
];

let savedReading: any;
let savedDecision: any;
const checkinMetadata = new Map<string, any>();
let decisionRows: any[] = [];
const prisma: any = {
  dailyCheckin: {
    findMany: async () => checkins,
    findUnique: async ({ where }: any) => ({ signalMetadata: checkinMetadata.get(where.id) ?? null }),
    update: async ({ where, data }: any) => { checkinMetadata.set(where.id, data.signalMetadata); return {}; },
  },
  journalSession: { findMany: async () => [] },
  objective: { findMany: async () => [{ id: 'objective-1', title: 'Sala pronta', progress: 20, subgoals: [{ id: 'action-1', title: 'Separar os itens da sala por uso', doneWhen: 'os itens estiverem em três grupos de uso', done: false }], milestones: [], updatedAt: new Date(`${date}T09:00:00.000Z`) }] },
  userPattern: { findMany: async () => [] },
  userFact: { findMany: async () => [] },
  airiaReading: {
    upsert: async ({ create, update }: any) => {
      savedReading = { ...(savedReading ?? create), ...update, id: savedReading?.id ?? 'reading-1', userId, localDate: new Date(`${date}T00:00:00.000Z`), createdAt: new Date(), updatedAt: new Date() };
      return savedReading;
    },
    findUnique: async () => null,
  },
  airiaDecision: {
    findUnique: async () => savedDecision ?? null,
    upsert: async ({ create, update }: any) => { savedDecision = { ...(savedDecision ?? create), ...update, id: savedDecision?.id ?? 'decision-1', readingId: 'reading-1' }; return savedDecision; },
    findMany: async () => decisionRows,
    findFirst: async () => savedDecision ? { ...savedDecision, reading: savedReading } : null,
    update: async ({ data }: any) => { savedDecision = { ...savedDecision, ...data }; return savedDecision; },
  },
  eventLog: { create: async () => ({}) },
};

void (async () => {
  const reading = await new AiriaReadingService(prisma).rebuild({ userId, localDate: date, surface: 'checkin' });
  assert.equal(reading.version, 'v1');
  assert.equal(reading.currentState.phase, 'Retomada');
  assert.equal((reading.currentState.intraday as any).observations, 3);
  assert.equal((reading.currentState.intraday as any).direction, 'oscillating');
  assert.equal((reading.currentState.intraday as any).range, 5);
  assert.equal(reading.period.observedDays, 1);
  assert.equal(reading.decision?.title, 'Separar os itens da sala por uso. Pronto quando: os itens estiverem em três grupos de uso.');
  assert.equal(reading.decision?.requiresConfirmation, true);
  const historical = await new AiriaReadingService(prisma).rebuild({ userId, localDate: date, periodFrom: '2026-08-10', periodTo: '2026-08-12', surface: 'insights' });
  assert.equal(historical.currentState.phase, 'Retomada', 'custom period never replaces the latest state');
  assert.equal(historical.period.from, '2026-08-10');
  assert.equal(historical.period.to, '2026-08-12');

  // ── Capacidade: inferida, dita e coerente com o dia oscilante ─────────────
  //
  // Este é o dia do teste-base: 08h 8/8 → 13h 3/3 → 21h 7/6. Nenhuma superfície
  // pode resumir isso como um dia estável, e a capacidade não pode herdar o
  // pico da manhã — o que vale é a última observação, não a média.
  const capacity = reading.capacity as any;
  assert.ok(capacity, 'a leitura precisa trazer a capacidade do dia');
  assert.notEqual(capacity.level, 'alta', 'o 8/8 das 08h não decide o dia às 21h');
  assert.ok(capacity.reason.length > 0);
  assert.match(capacity.reason, /\d/, 'a frase mostra o número que sustentou a conclusão');
  assert.equal(capacity.assumed, false, 'houve sinal — nada aqui é presumido');
  assert.doesNotMatch(capacity.reason, /est[aá]vel/i, 'um dia que oscilou 5 pontos não é estável');
  assert.ok(['quick', 'moderate', 'heavy'].includes(capacity.size));
  assert.ok(capacity.stepMinutes > 0);

  // ── A capacidade inferida volta para o check-in que a originou ────────────
  //
  // `signalMetadata.dayPlan` existia no contrato e nunca era preenchido: era o
  // campo que a tela removida alimentava perguntando. Agora quem preenche é a
  // inferência, e `provenance` diz isso na cara.
  const dayPlan = checkinMetadata.get('evening')?.dayPlan;
  assert.ok(dayPlan, 'a capacidade inferida precisa ser gravada no check-in');
  assert.equal(dayPlan.provenance, 'inferred');
  assert.equal(dayPlan.capacityLevel, capacity.level);
  assert.equal(dayPlan.capacity, capacity.size);
  assert.ok(dayPlan.capacityReason.length <= 240);
  assert.equal(dayPlan.priorityGoalId, 'objective-1', 'a prioridade também é inferida, não perguntada');

  // Capacidade dita numa superfície explícita ganha da inferida: sobrescrever
  // o que a pessoa afirmou seria a Airia discordando de um fato.
  checkinMetadata.set('evening', { dayPlan: { capacity: 'heavy', provenance: 'reported' } });
  await new AiriaReadingService(prisma).rebuild({ userId, localDate: date, surface: 'checkin' });
  assert.equal(checkinMetadata.get('evening').dayPlan.capacity, 'heavy', 'o que ela declarou não é sobrescrito');
  assert.equal(checkinMetadata.get('evening').dayPlan.provenance, 'reported');

  // ── Gravar leitura nunca pode derrubar o check-in ─────────────────────────
  const brokenPrisma = { ...prisma, dailyCheckin: { ...prisma.dailyCheckin, update: async () => { throw new Error('coluna indisponível'); } } };
  const survived = await new AiriaReadingService(brokenPrisma as any).rebuild({ userId, localDate: date, surface: 'checkin' });
  assert.equal(survived.version, 'v1', 'falha ao gravar dayPlan não pode quebrar a leitura');

  // ── Correção de um toque calibra e reabre a proposta ──────────────────────
  const service = new AiriaReadingService(prisma);
  const afterCorrection = await service.feedback({
    userId, decisionId: 'decision-1', status: 'corrigida', surface: 'checkin_result', capacityCorrection: 'down',
  });
  assert.equal(savedDecision.feedback.capacityCorrection, 'down', 'a correção fica gravada');
  assert.equal(savedDecision.status, 'proposta', 'corrigir o tamanho reabre a proposta');
  assert.ok(afterCorrection.capacity, 'a tela recebe a leitura já recalculada');

  // Com a correção de hoje gravada, a próxima leitura do mesmo dia desce um
  // nível — e só um.
  decisionRows = [{ feedback: { capacityCorrection: 'down' }, reading: { localDate: new Date(`${date}T00:00:00.000Z`) } }];
  const recalibrated = await service.rebuild({ userId, localDate: date, surface: 'checkin' });
  const levels = ['protecao', 'baixa', 'media', 'alta'];
  const before = levels.indexOf(capacity.level);
  const after = levels.indexOf((recalibrated.capacity as any).level);
  assert.equal(after, Math.max(0, before - 1), 'a correção desloca exatamente um nível');
  assert.equal((recalibrated.capacity as any).corrected, true);

  console.log('airia-reading.service tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
