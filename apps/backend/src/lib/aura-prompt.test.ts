import assert from 'node:assert/strict';

import { buildAuraSystemPrompt } from './aura-prompt';

async function run() {
  const onboardingPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    profileSummary: 'Prefere passos curtos quando a energia cai.',
    moodCycleContext: 'Humor em queda suave, energia 2/5.',
    domain: 'onboarding',
  });

  assert.match(onboardingPrompt, /Você é Airia/i);
  assert.match(onboardingPrompt, /Não presuma diagnósticos/i);
  assert.match(onboardingPrompt, /BOAS-VINDAS/i);
  assert.match(onboardingPrompt, /Humor em queda suave/i);
  assert.match(onboardingPrompt, /Prefere passos curtos/i);
  assert.match(onboardingPrompt, /Não invente fatos/i);
  assert.match(onboardingPrompt, /frases genéricas de autoajuda/i);
  assert.match(onboardingPrompt, /bipolaridade/i);
  assert.match(onboardingPrompt, /TCC pratica/i);
  assert.match(onboardingPrompt, /terapia de exposição gradual/i);
  assert.match(onboardingPrompt, /estilo Jarvis/i);
  assert.match(onboardingPrompt, /Não espere palavras de ordem literais o tempo todo/i);

  const checkinPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'checkin',
  });

  assert.match(checkinPrompt, /COORDENADA BIO-PSÍQUICA/i);
  assert.match(checkinPrompt, /ritmo hoje/i);
  assert.doesNotMatch(checkinPrompt, /Usuárias típicas têm TDAH/i);

  const journalLivePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-live' as any,
  });

  assert.match(journalLivePrompt, /DIÁRIO \(PRESENÇA REFLEXIVA\)/i);
  assert.match(journalLivePrompt, /acompanhe o fluxo/i);
  assert.match(journalLivePrompt, /PROIBIDO sugerir metas/i);
  assert.match(journalLivePrompt, /no máximo uma pergunta por mensagem/i);
  assert.match(journalLivePrompt, /colete em micro-passos/i);
  assert.match(journalLivePrompt, /nunca faça múltiplas perguntas/i);
  assert.doesNotMatch(journalLivePrompt, /gere 0 a 3 tarefas/i);

  const journalFinalizePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-finalize' as any,
  });

  assert.match(journalFinalizePrompt, /SÍNTESE DA SESSÃO/i);
  assert.match(journalFinalizePrompt, /espelho calmo/i);
  assert.match(journalFinalizePrompt, /Não faça perguntas no fechamento/i);
  assert.match(journalFinalizePrompt, /guarde apenas o sentimento/i);
  assert.doesNotMatch(journalFinalizePrompt, /acompanhe o fluxo/i);

  const auraCommandPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'aura-command' as any,
  });

  assert.match(auraCommandPrompt, /HUB OPERACIONAL/i);
  assert.match(auraCommandPrompt, /executiva de elite/i);
  assert.match(auraCommandPrompt, /reservei 15 min/i);
  assert.doesNotMatch(auraCommandPrompt, /diário reflexivo/i);

  const homePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home' as any,
  });

  assert.match(homePrompt, /TOUCHPOINT RÁPIDO/i);
  assert.match(homePrompt, /sussurro/i);
  assert.match(homePrompt, /micro-passo físico/i);

  const goalExecutionPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'goal-execution' as any,
  });

  assert.match(goalExecutionPrompt, /ENGENHARIA DE METAS/i);
  assert.match(goalExecutionPrompt, /passo "atômico"/i);
  assert.match(goalExecutionPrompt, /ridiculamente fácil/i);

  const longitudinalPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'longitudinal-insight' as any,
  });

  assert.match(longitudinalPrompt, /MEMÓRIA E PADRÕES/i);
  assert.match(longitudinalPrompt, /cruze dados/i);
  assert.match(longitudinalPrompt, /semana passada/i);
}

run()
  .then(() => {
    console.log('aura-prompt tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
