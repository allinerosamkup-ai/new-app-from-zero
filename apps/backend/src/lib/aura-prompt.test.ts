import assert from 'node:assert/strict';

import { buildAuraSystemPrompt } from './aura-prompt';

async function run() {
  const onboardingPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    profileSummary: 'Prefere passos curtos quando a energia cai.',
    moodCycleContext: 'Humor em queda suave, energia 2/5.',
    domain: 'onboarding',
  });

  assert.match(onboardingPrompt, /Você é Aura/i);
  assert.match(onboardingPrompt, /Não presuma diagnósticos/i);
  assert.match(onboardingPrompt, /ONBOARDING/i);
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

  assert.match(checkinPrompt, /CHECK-IN/i);
  assert.match(checkinPrompt, /próximas horas/i);
  assert.doesNotMatch(checkinPrompt, /Usuárias típicas têm TDAH/i);

  const journalLivePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-live' as any,
  });

  assert.match(journalLivePrompt, /DIÁRIO AO VIVO/i);
  assert.match(journalLivePrompt, /não encerre a conversa/i);
  assert.match(journalLivePrompt, /não sugira tarefas/i);
  assert.doesNotMatch(journalLivePrompt, /gere 0 a 3 tarefas/i);

  const journalFinalizePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-finalize' as any,
  });

  assert.match(journalFinalizePrompt, /FINALIZAÇÃO DO DIÁRIO/i);
  assert.match(journalFinalizePrompt, /resuma a sessão/i);
  assert.match(journalFinalizePrompt, /gere 0 a 3 tarefas/i);
  assert.doesNotMatch(journalFinalizePrompt, /não encerre a conversa/i);

  const auraCommandPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'aura-command' as any,
  });

  assert.match(auraCommandPrompt, /COPILOTO OPERACIONAL/i);
  assert.match(auraCommandPrompt, /interprete pedidos diretos/i);
  assert.match(auraCommandPrompt, /encaminhe para planner, checklist, metas ou agenda/i);
  assert.doesNotMatch(auraCommandPrompt, /diário reflexivo/i);

  const homePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home' as any,
  });

  assert.match(homePrompt, /HOME/i);
  assert.match(homePrompt, /presenca breve/i);
  assert.match(homePrompt, /acao proativa/i);

  const goalExecutionPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'goal-execution' as any,
  });

  assert.match(goalExecutionPrompt, /EXECUÇÃO DE METAS/i);
  assert.match(goalExecutionPrompt, /proximos passos fisicos/i);
  assert.match(goalExecutionPrompt, /destino mais executavel/i);

  const longitudinalPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'longitudinal-insight' as any,
  });

  assert.match(longitudinalPrompt, /INTELIGENCIA LONGITUDINAL/i);
  assert.match(longitudinalPrompt, /padroes, transicoes e seguimentos/i);
  assert.match(longitudinalPrompt, /acompanhamento/i);
}

run()
  .then(() => {
    console.log('aura-prompt tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
