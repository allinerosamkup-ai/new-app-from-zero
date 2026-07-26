import assert from 'node:assert/strict';

import { RoutineGuidedAnswersSchema } from '../contracts/routine-builder.contract';
import { transformGuidedAnswers } from './routine-guided-transform.service';
import { HABIT_TEMPLATES, INTENTIONS, suggestHabitsForIntentions } from './routine-guided-library';

const TODAY = '2026-07-25';

function answers(overrides: Record<string, unknown> = {}) {
  return RoutineGuidedAnswersSchema.parse({
    lifeAreas: ['work', 'home'],
    availability: [],
    fixedCommitments: [],
    energyDrains: ['drain_meetings'],
    energyRestorers: ['restore_walk'],
    intentions: [],
    selectedHabits: [],
    currentState: { mood: 5, energy: 5, focus: 5, sleepQuality: 'razoável' },
    ...overrides,
  });
}

// Compromisso fixo vira calendário recorrente e imutável.
{
  const items = transformGuidedAnswers({
    answers: answers({
      fixedCommitments: [{ title: 'Trabalho', dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
    }),
    today: TODAY,
  });

  const commitment = items.find((item) => item.kind === 'calendar');
  assert.ok(commitment, 'compromisso fixo deve virar item de calendário');
  assert.equal(commitment?.isFixed, true);
  assert.equal(commitment?.startTime, '09:00');
  assert.deepEqual(commitment?.recurrence?.daysOfWeek, [1]);
}

// Hábito escolhido preserva frequência, dias e duração.
{
  const items = transformGuidedAnswers({
    answers: answers({
      selectedHabits: [{
        templateId: 'habit_move',
        title: 'Me mexer 20 minutos',
        frequency: 'weekly',
        daysOfWeek: [1, 3, 5],
        timesPerWeek: 3,
        timeOfDay: 'morning',
        durationMinutes: 20,
      }],
    }),
    today: TODAY,
  });

  const habit = items.find((item) => item.kind === 'habit');
  assert.equal(habit?.title, 'Me mexer 20 minutos');
  assert.equal(habit?.recurrence?.frequency, 'weekly');
  assert.deepEqual(habit?.recurrence?.daysOfWeek, [1, 3, 5]);
  assert.equal(habit?.durationMinutes, 20);
}

// Objetivo nasce com meta verificável e uma próxima ação ancorada em hoje.
{
  const items = transformGuidedAnswers({
    answers: answers({ intentions: ['produce'] }),
    today: TODAY,
  });

  const goal = items.find((item) => item.kind === 'goal');
  const nextAction = items.find((item) => item.kind === 'task');

  assert.ok(goal, 'intenção com resultado verificável deve virar objetivo');
  assert.match(String(goal?.description), /sessões de foco concluídas/);
  assert.equal(nextAction?.parentItemId, goal?.id);
  assert.equal(nextAction?.date, TODAY);
}

// Intenção sem resultado verificável não vira objetivo vazio.
{
  const items = transformGuidedAnswers({
    answers: answers({ intentions: ['home'] }),
    today: TODAY,
  });

  assert.equal(items.some((item) => item.kind === 'goal'), false);
}

// Área da vida é contexto, nunca obrigação.
{
  const items = transformGuidedAnswers({ answers: answers(), today: TODAY });
  const reference = items.find((item) => item.kind === 'reference');

  assert.equal(reference?.description, 'Trabalho, Casa');
  assert.equal(items.some((item) => item.kind === 'task'), false);
}

// Sem escolha nenhuma, não inventa item.
{
  const items = transformGuidedAnswers({
    answers: answers({ lifeAreas: [], energyDrains: [], energyRestorers: [] }),
    today: TODAY,
  });

  assert.equal(items.length, 0);
}

// Marcar só o que drena e o que recupera já produz rotina — sem área da vida.
{
  const items = transformGuidedAnswers({ answers: answers({ lifeAreas: [] }), today: TODAY });

  assert.equal(items.length, 2);
  assert.ok(items.some((item) => item.title === 'Caminhar'));
  assert.ok(items.some((item) => item.title === 'O que costuma me drenar'));
}

// Sugestão de hábitos não repete entre intenções.
{
  const suggested = suggestHabitsForIntentions(['health', 'routine']);
  const ids = suggested.map((habit) => habit.id);

  assert.ok(ids.includes('habit_checkin'));
  assert.equal(new Set(ids).size, ids.length);
}

// Intenção desconhecida é ignorada em vez de quebrar.
{
  assert.deepEqual(suggestHabitsForIntentions(['nao_existe']), []);
}

// Todo template referenciado por intenção existe na biblioteca.
{
  const known = new Set(HABIT_TEMPLATES.map((template) => template.id));
  const referenced = suggestHabitsForIntentions(
    ['body', 'sleep', 'home', 'produce', 'money', 'health', 'relationships', 'project', 'overload', 'routine'],
  );

  assert.ok(referenced.length > 0);
  for (const habit of referenced) {
    assert.ok(known.has(habit.id), `template ${habit.id} não existe na biblioteca`);
  }
}


// O que recupera vira bloco agendado, não conselho solto.
{
  const items = transformGuidedAnswers({
    answers: answers({ energyRestorers: ['restore_walk'] }),
    today: TODAY,
  });
  const recovery = items.find((item) => item.title === 'Caminhar');

  assert.ok(recovery, 'recuperador escolhido deveria virar bloco');
  assert.equal(recovery!.kind, 'habit');
  assert.equal(recovery!.durationMinutes, 30);
  assert.equal(recovery!.recurrence?.timesPerWeek, 2);
}

// Agenda de autocuidado também lota: no máximo dois blocos de recuperação.
{
  const items = transformGuidedAnswers({
    answers: answers({
      energyRestorers: ['restore_walk', 'restore_bath', 'restore_reading', 'restore_pet'],
    }),
    today: TODAY,
  });
  const recovery = items.filter((item) => item.description?.startsWith('Bloco de recuperação'));

  assert.equal(recovery.length, 2);
}

// Recuperador sem duração própria não vira bloco vazio.
{
  const items = transformGuidedAnswers({
    answers: answers({ energyRestorers: ['restore_sleep'] }),
    today: TODAY,
  });

  assert.ok(!items.some((item) => item.description?.startsWith('Bloco de recuperação')));
}

// O que drena vira contexto nomeado, nunca obrigação.
{
  const items = transformGuidedAnswers({
    answers: answers({ energyDrains: ['drain_meetings', 'drain_noise'] }),
    today: TODAY,
  });
  const drains = items.find((item) => item.title === 'O que costuma me drenar');

  assert.ok(drains);
  assert.equal(drains!.kind, 'reference');
  assert.equal(drains!.description, 'Reuniões seguidas, Barulho');
}

// Sem dreno marcado, nenhum item de contexto de energia é criado.
{
  const items = transformGuidedAnswers({ answers: answers({ energyDrains: [] }), today: TODAY });

  assert.ok(!items.some((item) => item.title === 'O que costuma me drenar'));
}

// Primeiro passo é ação concreta, não a meta repetida.
{
  const items = transformGuidedAnswers({ answers: answers({ intentions: ['body'] }), today: TODAY });
  const goal = items.find((item) => item.kind === 'goal');
  const firstStep = items.find((item) => item.parentItemId === goal?.id);

  assert.ok(goal && firstStep);
  assert.equal(firstStep!.title, 'Separar a roupa de treino e deixar à vista');
  assert.notEqual(firstStep!.title.toLowerCase(), goal!.title.toLowerCase());
  assert.equal(firstStep!.date, TODAY);
}

// Todo objetivo da biblioteca traz primeiro passo com verbo e prazo curto.
{
  for (const intention of INTENTIONS) {
    if (!intention.objective) continue;
    const { firstStep, firstStepMinutes, title } = intention.objective;

    assert.ok(firstStep.length > 10, `${intention.id}: primeiro passo vago`);
    assert.notEqual(firstStep.toLowerCase(), title.toLowerCase());
    assert.ok(firstStepMinutes >= 5 && firstStepMinutes <= 30, `${intention.id}: passo longo demais`);
  }
}

console.log('routine-guided-transform.service.test.ts OK');
