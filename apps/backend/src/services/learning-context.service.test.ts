import assert from 'node:assert/strict';

import { LearningContextService, type LearningContext } from './learning-context.service';

function run() {
  // 1. formatForPrompt — ctx vazio devolve string vazia
  assert.equal(LearningContextService.formatForPrompt(null), '');
  assert.equal(LearningContextService.formatForPrompt({
    energyByWeekday: [],
    crashHistory: [],
    bestDays: [],
    recurringThemes: [],
  }), '');

  // 2. formatForPrompt — completo cita todos os blocos
  const fullCtx: LearningContext = {
    energyByWeekday: [
      { weekday: 1, avg_mood: 4.5, avg_energy: 4.4, samples: 25 },
      { weekday: 6, avg_mood: 6.8, avg_energy: 5.8, samples: 16 },
    ],
    bestDays: [
      { weekday: 6, good_count: 13 },
      { weekday: 7, good_count: 12 },
    ],
    crashHistory: [
      { crash_date: '2026-05-07', prev_mood: 9, new_mood: 4, mood_delta: -5 },
      { crash_date: '2026-05-06', prev_mood: 8, new_mood: 3, mood_delta: -5 },
    ],
    recurringThemes: [
      { theme: 'app/projeto pessoal', occurrences: 4 },
      { theme: 'relacionamentos', occurrences: 3 },
    ],
  };
  const formatted = LearningContextService.formatForPrompt(fullCtx);

  assert.match(formatted, /segunda 4\.5\/4\.4/);
  assert.match(formatted, /sábado 6\.8\/5\.8/);
  assert.match(formatted, /Melhores dias/);
  assert.match(formatted, /sábado \(13 dias bons\)/);
  assert.match(formatted, /Quedas de humor recentes/);
  assert.match(formatted, /2026-05-07 \(9→4\)/);
  assert.match(formatted, /Temas recorrentes em diários/);
  assert.match(formatted, /app\/projeto pessoal \(4x\)/);

  // 3. Aceita avg_mood como string (vem do Postgres NUMERIC)
  const ctxWithStringNumbers: LearningContext = {
    energyByWeekday: [
      { weekday: 3, avg_mood: '5.14', avg_energy: '4.79', samples: 14 },
    ],
    bestDays: [],
    crashHistory: [],
    recurringThemes: [],
  };
  const fmtStr = LearningContextService.formatForPrompt(ctxWithStringNumbers);
  assert.match(fmtStr, /quarta 5\.1\/4\.8/);

  // 4. Filtra weekdays inválidos
  const ctxInvalid: LearningContext = {
    energyByWeekday: [
      { weekday: 0, avg_mood: 5, avg_energy: 5, samples: 10 },
      { weekday: 8, avg_mood: 4, avg_energy: 4, samples: 5 },
      { weekday: 4, avg_mood: 5.7, avg_energy: 5.2, samples: 12 },
    ],
    bestDays: [],
    crashHistory: [],
    recurringThemes: [],
  };
  const fmtFilter = LearningContextService.formatForPrompt(ctxInvalid);
  assert.doesNotMatch(fmtFilter, /weekday 0|weekday 8/);
  assert.match(fmtFilter, /quinta 5\.7\/5\.2/);

  // 5. Limites máximos respeitados (top 5 themes, top 3 best days, top 3 crashes)
  const ctxBig: LearningContext = {
    energyByWeekday: [],
    bestDays: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, good_count: 10 - i })),
    crashHistory: Array.from({ length: 10 }, (_, i) => ({
      crash_date: `2026-05-0${i + 1}`,
      prev_mood: 8,
      new_mood: 3,
      mood_delta: -5,
    })),
    recurringThemes: Array.from({ length: 8 }, (_, i) => ({
      theme: `tema-${i}`,
      occurrences: 10 - i,
    })),
  };
  const fmtBig = LearningContextService.formatForPrompt(ctxBig);
  // Best days: só 3
  const bestSegments = fmtBig.match(/\(\d+ dias bons\)/g) ?? [];
  assert.equal(bestSegments.length, 3);
  // Crashes: só 3
  const crashSegments = fmtBig.match(/\(\d+→\d+\)/g) ?? [];
  assert.equal(crashSegments.length, 3);
  // Themes: só 5
  const themeSegments = fmtBig.match(/tema-\d/g) ?? [];
  assert.equal(themeSegments.length, 5);
}

run();
console.log('learning-context.service tests passed');
