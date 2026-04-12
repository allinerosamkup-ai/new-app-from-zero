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

console.log('planner.service tests passed');
