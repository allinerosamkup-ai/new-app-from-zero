import assert from 'node:assert/strict';

import {
  allowsHabitNotifications,
  getSaoPauloDateContext,
  getSaoPauloDayStartUtc,
  resolveCheckinNudgeTime,
  shouldSendCheckinNudge,
  shouldSendHabitReminderToday,
  shouldSendJournalNudge,
} from './notification-filters';

function run() {
  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'daily', targetCount: 1, completions: [{ completionCount: 1 }] },
      3,
    ),
    false,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'weekly', targetDays: [1, 3], targetCount: 1, completions: [] },
      3,
    ),
    true,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'weekly', targetDays: [1], targetCount: 1, completions: [] },
      3,
    ),
    false,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'monthly', targetCount: 1, completions: [] },
      3,
      1,
    ),
    true,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'monthly', targetCount: 1, completions: [] },
      3,
      29,
    ),
    false,
  );

  assert.equal(
    allowsHabitNotifications({ notificationsOn: true, notificationPreferences: { habits: false } }),
    false,
  );

  assert.equal(
    allowsHabitNotifications({ notificationsOn: true, notificationPreferences: { habits: true } }),
    true,
  );

  assert.deepEqual(
    getSaoPauloDateContext(new Date('2026-04-29T15:00:00.000Z')),
    {
      dateKey: '2026-04-29',
      weekday: 3,
      dayOfMonth: 29,
      dbDate: new Date('2026-04-29T00:00:00.000Z'),
    },
  );

  // ── nudge único diário ──
  assert.deepEqual(getSaoPauloDayStartUtc('2026-06-12'), new Date('2026-06-12T03:00:00.000Z'));

  // Sem amostras suficientes usa o horário preferido; sem preferido usa 09:00
  assert.equal(resolveCheckinNudgeTime({ preferredTime: '08:30', recentCheckinTimes: ['07:00', '07:10'] }), '08:30');
  assert.equal(resolveCheckinNudgeTime({ preferredTime: null, recentCheckinTimes: [] }), '09:00');

  // Com 5+ amostras usa a mediana arredondada a 10min
  assert.equal(
    resolveCheckinNudgeTime({
      preferredTime: '09:00',
      recentCheckinTimes: ['07:58', '08:05', '08:12', '08:03', '08:21'],
    }),
    '08:10',
  );

  // Mediana fora da janela de silêncio é puxada para a borda (07:00–22:00)
  assert.equal(
    resolveCheckinNudgeTime({
      preferredTime: null,
      recentCheckinTimes: ['23:10', '23:00', '22:50', '23:30', '23:20'],
    }),
    '22:00',
  );

  // Check-in feito hoje bloqueia o nudge
  assert.deepEqual(
    shouldSendCheckinNudge({ currentTime: '08:10', nudgeTime: '08:10', hasCheckinToday: true, nudgesSentToday: 0 }),
    { send: false, reason: 'check-in já registrado hoje' },
  );

  // Limite de 1 nudge/dia bloqueia o segundo
  assert.deepEqual(
    shouldSendCheckinNudge({ currentTime: '08:10', nudgeTime: '08:10', hasCheckinToday: false, nudgesSentToday: 1 }),
    { send: false, reason: 'limite diário de nudges atingido' },
  );

  assert.equal(
    shouldSendCheckinNudge({ currentTime: '08:10', nudgeTime: '08:10', hasCheckinToday: false, nudgesSentToday: 0 }).send,
    true,
  );

  // Diário compartilha o mesmo limite diário
  assert.deepEqual(
    shouldSendJournalNudge({ currentTime: '21:00', journalTimes: ['10:00', '21:00'], nudgesSentToday: 1 }),
    { send: false, reason: 'limite diário de nudges atingido' },
  );
  assert.equal(
    shouldSendJournalNudge({ currentTime: '21:00', journalTimes: ['10:00', '21:00'], nudgesSentToday: 0 }).send,
    true,
  );
}

run();
console.log('notification-filters tests passed');
