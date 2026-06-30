import assert from 'node:assert/strict';

import { PlannerService } from './planner.service';

{
  assert.equal(PlannerService.resolveSuggestedAgendaDate('2026-04-12', 17), '2026-04-12');
  assert.equal(PlannerService.resolveSuggestedAgendaDate('2026-04-12', 18), '2026-04-13');
  assert.equal(PlannerService.resolveSuggestedAgendaDate('2026-04-12', 22), '2026-04-13');
}

{
  const slot = PlannerService.findSuggestedSlot({
    intensity: 'P',
    category: 'trabalho',
    durationMinutes: 60,
    busyWindows: [],
  });

  assert.deepEqual(slot, { startTime: '08:00', endTime: '09:00' });
}

{
  const slot = PlannerService.findSuggestedSlot({
    intensity: 'L',
    category: 'autocuidado',
    durationMinutes: 30,
    busyWindows: [],
  });

  assert.deepEqual(slot, { startTime: '14:00', endTime: '14:30' });
}

{
  const slot = PlannerService.findSuggestedSlot({
    intensity: 'P',
    category: 'trabalho',
    durationMinutes: 60,
    busyWindows: [{ startTime: '08:00', endTime: '10:00' }],
  });

  assert.deepEqual(slot, { startTime: '10:00', endTime: '11:00' });
}

{
  const slot = PlannerService.findSuggestedSlot({
    intensity: 'M',
    category: 'pessoal',
    durationMinutes: 45,
    busyWindows: [
      { startTime: '08:00', endTime: '12:00' },
      { startTime: '12:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '20:00' },
    ],
  });

  assert.equal(slot, null);
}

{
  const windows = PlannerService.normalizeBusyWindows([
    { startTime: '07:00', endTime: '09:00' },
    { startTime: '19:30', endTime: '21:00' },
    { startTime: 'bad', endTime: '10:00' },
  ]);

  assert.deepEqual(windows, [
    { startTime: '08:00', endTime: '09:00' },
    { startTime: '19:30', endTime: '20:00' },
  ]);
}

{
  const blocks = PlannerService.scheduleAgendaSuggestions({
    targetDate: '2026-04-13',
    busyWindows: [{ startTime: '08:00', endTime: '10:00' }],
    blocks: [
      {
        horario_inicio: '23:00',
        horario_fim: '23:45',
        tipo: 'trabalho',
        label: 'Foco protegido',
        tarefas_sugeridas: ['Responder proposta', 'Responder proposta'],
        razao_ia: 'Cabe melhor quando sua energia ainda esta alta.',
        intensity: 'P',
      },
      {
        horario_inicio: '23:30',
        horario_fim: '23:45',
        tipo: 'autocuidado',
        label: 'Respiro',
        tarefas_sugeridas: ['Alongar ombros'],
        razao_ia: 'Baixa carga.',
        intensity: 'L',
      },
    ],
  });

  assert.deepEqual(blocks.map((block) => ({
    local_date: block.local_date,
    horario_inicio: block.horario_inicio,
    horario_fim: block.horario_fim,
    tarefas_sugeridas: block.tarefas_sugeridas,
  })), [
    {
      local_date: '2026-04-13',
      horario_inicio: '10:00',
      horario_fim: '10:45',
      tarefas_sugeridas: ['Responder proposta'],
    },
    {
      local_date: '2026-04-13',
      horario_inicio: '14:00',
      horario_fim: '14:15',
      tarefas_sugeridas: ['Alongar ombros'],
    },
  ]);
}

{
  const blocks = PlannerService.normalizeSuggestedTimelineBlocks({
    blocks: [
      {
        title: 'Sugestao gerada de madrugada',
        startTime: '04:00',
        endTime: '05:00',
        category: 'trabalho',
        intensity: 'P',
        status: 'planned',
        isAiSuggested: true,
      },
    ],
    busyWindows: [{ startTime: '08:00', endTime: '10:00' }],
  });

  assert.equal(blocks[0].startTime, '10:00');
  assert.equal(blocks[0].endTime, '11:00');
}

{
  const blocks = PlannerService.normalizeSuggestedTimelineBlocks({
    blocks: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Sugestao editada pela usuaria',
        startTime: '04:00',
        endTime: '05:00',
        category: 'pessoal',
        intensity: 'M',
        status: 'planned',
        isAiSuggested: true,
      },
    ],
    busyWindows: [],
  });

  assert.equal(blocks[0].startTime, '04:00');
  assert.equal(blocks[0].endTime, '05:00');
}

{
  const baseDate = new Date('2026-05-10T00:00:00.000Z');
  const start = PlannerService.parseTimeToDate(baseDate, '23:30');
  const end = PlannerService.parseTimeToDate(baseDate, '23:59');

  assert.equal(start.toISOString(), '2026-05-10T23:30:00.000Z');
  assert.equal(end.toISOString(), '2026-05-10T23:59:00.000Z');
}

{
  const baseDate = new Date('2026-05-10T00:00:00.000Z');
  const start = PlannerService.parseTimeToDate(baseDate, '00:15');

  assert.equal(start.toISOString(), '2026-05-10T00:15:00.000Z');
}

// ─── Sprint Frente 3: detectConflicts com suggestedResolutions ────────────
{
  // Caso 1: bloco P (id=A) sobrepõe bloco L (id=B) — sugere DOWNGRADE_INTENSITY no L
  const conflicts1 = PlannerService.detectConflicts([
    { id: 'A', title: 'Apresentação cliente', startAt: '2026-05-14T09:00:00Z', endAt: '2026-05-14T10:30:00Z', intensity: 'P' },
    { id: 'B', title: 'Café com Maria',       startAt: '2026-05-14T10:00:00Z', endAt: '2026-05-14T10:30:00Z', intensity: 'L' },
  ]);
  assert.equal(conflicts1.length, 1);
  assert.equal(conflicts1[0].overlapMinutes, 30);
  assert.equal(conflicts1[0].block1Id, 'A');
  assert.equal(conflicts1[0].block2Id, 'B');
  const downgrade = conflicts1[0].suggestedResolutions?.find((r) => r.type === 'DOWNGRADE_INTENSITY');
  assert.ok(downgrade, 'deve ter resolução DOWNGRADE_INTENSITY');
  assert.equal(downgrade?.targetBlockId, 'B', 'downgrade no bloco menos intenso');

  // Caso 2: blocos com mesma intensidade — sugere MOVE_BLOCK_LATER no maior título
  const conflicts2 = PlannerService.detectConflicts([
    { id: 'X', title: 'Tarefa um',  startAt: '2026-05-14T09:00:00Z', endAt: '2026-05-14T10:00:00Z', intensity: 'M' },
    { id: 'Y', title: 'Tarefa dois muito mais longa', startAt: '2026-05-14T09:30:00Z', endAt: '2026-05-14T10:30:00Z', intensity: 'M' },
  ]);
  const move = conflicts2[0].suggestedResolutions?.find((r) => r.type === 'MOVE_BLOCK_LATER');
  assert.ok(move, 'deve ter resolução MOVE_BLOCK_LATER quando intensidades iguais');
  assert.equal(move?.targetBlockId, 'Y');

  // Caso 3: AI-suggested vence prioridade no MOVE_LATER
  const conflicts3 = PlannerService.detectConflicts([
    { id: 'real', title: 'Compromisso firmado', startAt: '2026-05-14T14:00:00Z', endAt: '2026-05-14T15:00:00Z', intensity: 'M', isAiSuggested: false },
    { id: 'ai',   title: 'Sugestão',            startAt: '2026-05-14T14:30:00Z', endAt: '2026-05-14T15:30:00Z', intensity: 'M', isAiSuggested: true },
  ]);
  const move3 = conflicts3[0].suggestedResolutions?.find((r) => r.type === 'MOVE_BLOCK_LATER');
  assert.equal(move3?.targetBlockId, 'ai', 'AI-suggested move antes do firmado');

  // Caso 4: POSTPONE_TOMORROW sempre presente
  for (const c of [conflicts1, conflicts2, conflicts3]) {
    const postpone = c[0].suggestedResolutions?.find((r) => r.type === 'POSTPONE_TOMORROW');
    assert.ok(postpone, 'POSTPONE_TOMORROW sempre presente');
  }

  // Caso 5: sem conflito → array vazio
  const noConflicts = PlannerService.detectConflicts([
    { id: 'A', title: 'X', startAt: '2026-05-14T09:00:00Z', endAt: '2026-05-14T10:00:00Z', intensity: 'M' },
    { id: 'B', title: 'Y', startAt: '2026-05-14T11:00:00Z', endAt: '2026-05-14T12:00:00Z', intensity: 'M' },
  ]);
  assert.equal(noConflicts.length, 0);
}

console.log('planner.service tests passed');
