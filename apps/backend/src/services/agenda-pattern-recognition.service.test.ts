import assert from 'node:assert/strict';
import { AgendaPatternRecognitionService, analyzeAgendaPattern } from './agenda-pattern-recognition.service';
import { calibrateDayStructureWithPattern } from './adaptive-agenda-engine.service';

function block(day: number, hour: number, duration = 8, extra: Record<string, unknown> = {}) {
  const date = new Date(Date.UTC(2026, 5, day, hour));
  return { id: `b-${day}-${hour}`, localDate: new Date(Date.UTC(2026, 5, day)), startAt: date, endAt: new Date(date.getTime() + duration * 3_600_000), status: 'planned', recurring: { enabled: true }, ...extra };
}

async function run() {
  const day = analyzeAgendaPattern({ blocks: Array.from({ length: 28 }, (_, i) => block(i + 1, 9)), events: [] });
  assert.equal(day.confirmed, true);
  assert.equal(day.dayProfile, 'day');
  assert.ok(day.confidence >= 0.65);
  assert.equal(day.inferenceSource, 'observed');
  assert.equal(analyzeAgendaPattern({ blocks: Array.from({ length: 28 }, (_, i) => block(i + 1, 22)), events: [] }).dayProfile, 'night');
  assert.equal(analyzeAgendaPattern({ blocks: Array.from({ length: 28 }, (_, i) => block(i + 1, i % 2 ? 22 : 9)), events: [] }).dayProfile, 'mixed');
  const sparse = analyzeAgendaPattern({ blocks: [block(1, 9), block(2, 9)], events: [] });
  assert.equal(sparse.confirmed, false);
  assert.ok(sparse.confidence < 0.65);
  assert.notEqual(sparse.freedomScore, 1, 'absence of commitments must not prove full autonomy');
  const explicit = analyzeAgendaPattern({ blocks: [], events: [], explicitSignals: [
    { source: 'onboarding', text: 'Trabalho de segunda a sexta das 10h às 20h.' },
    { source: 'memory', text: 'Minha rotina de trabalho costuma ser das 10h às 20h.' },
  ] });
  assert.equal(explicit.inferenceSource, 'explicit');
  assert.ok(explicit.confidence >= 0.65);
  assert.equal(explicit.sampleSize, 0, 'explicit routine cannot invent blocks');
  const explicitEnglish = analyzeAgendaPattern({ blocks: [], events: [], explicitSignals: [
    { source: 'onboarding', text: 'I work a fixed shift Monday to Friday from 10am to 8pm.' },
    { source: 'memory', text: 'My work schedule is usually 10am to 8pm.' },
  ] });
  assert.equal(explicitEnglish.dayProfile, 'mixed');
  assert.ok(explicitEnglish.confidence >= 0.65);

  const duplicatedEvents = analyzeAgendaPattern({
    blocks: Array.from({ length: 28 }, (_, i) => ({ ...block(i + 1, 9), status: i === 0 ? 'completed' : 'planned' })),
    events: Array.from({ length: 20 }, () => ({ eventName: 'timeline.block_completed', properties: { blockId: 'b-1-9' } })),
  });
  assert.ok(duplicatedEvents.completionRate >= 0 && duplicatedEvents.completionRate <= 1);

  let timelineReads = 0;
  let persistedPatterns = 0;
  const persistedContents: string[] = [];
  const recognition = new AgendaPatternRecognitionService({
    timelineBlock: { findMany: async () => { timelineReads += 1; return Array.from({ length: 28 }, (_, i) => block(i + 1, 9)); } },
    eventLog: { findMany: async () => [] },
    onboardingResponse: { findUnique: async () => null },
    userMemory: { findMany: async () => [] },
  } as any, { write: async (input: any) => { persistedPatterns += 1; persistedContents.push(input.content); return { accepted: true }; } } as any, () => 1_000);
  await recognition.recognize('user-cache', new Date('2026-06-30'), 'en-US');
  await recognition.recognize('user-cache', new Date('2026-06-30'), 'en-US');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(timelineReads, 1, 'recent recognition is cached outside the critical path');
  assert.equal(persistedPatterns, 3, 'cached recognition does not persist/project the same pattern twice');
  assert.match(persistedContents[0], /daytime schedule/);

  const current = { mode: 'open' as const, freedomScore: 100, initiativeLevel: 'lead' as const, scheduledMinutes: 0, protectedMinutes: 0, flexibleMinutes: 0, freeMinutes: 720, protectedAnchors: [] };
  const calibrated = calibrateDayStructureWithPattern(current, { ...day, confidence: 0.8 }, 1);
  assert.ok(calibrated.freedomScore > day.freedomScore * 100, 'current day stays dominant');
  assert.deepEqual(calibrated.protectedAnchors, [], 'pattern never invents an anchor');
  assert.deepEqual(calibrateDayStructureWithPattern(current, { ...day, confidence: 0.64 }, 1), current, 'low confidence does not calibrate');
}

run().then(() => console.log('agenda-pattern-recognition.service tests passed')).catch((error) => { console.error(error); process.exit(1); });
