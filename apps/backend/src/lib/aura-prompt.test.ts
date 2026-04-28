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
  assert.match(onboardingPrompt, /NUCLEO FUNCIONAL COMPARTILHADO/i);
  assert.match(onboardingPrompt, /EIXOS CENTRAIS/i);
  assert.match(onboardingPrompt, /PADRÕES/i);
  assert.match(onboardingPrompt, /DECISÕES/i);
  assert.match(onboardingPrompt, /CICLOS DE HUMOR/i);
  assert.match(onboardingPrompt, /MODELO INTERNO DE RESPOSTA ANALÍTICA/i);
  assert.match(onboardingPrompt, /evento real da história criada/i);
  assert.match(onboardingPrompt, /Não use este modelo para comandos operacionais/i);
  assert.match(onboardingPrompt, /menor ação útil possível/i);
  assert.match(onboardingPrompt, /Somática é ferramenta auxiliar/i);
  assert.match(onboardingPrompt, /estilo Jarvis/i);
  assert.match(onboardingPrompt, /Não espere palavras de ordem literais o tempo todo/i);
  assert.doesNotMatch(onboardingPrompt, /Aliança Divergente/i);
  assert.doesNotMatch(onboardingPrompt, /Elton/i);

  const checkinPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'checkin',
    recentSuggestionMemory: 'MEMORIA RECENTE DE SUGESTOES DA AURA:\n- [checkin/execucao] Abrir o planner por 5 minutos',
  });

  assert.match(checkinPrompt, /COORDENADA BIO-PSÍQUICA/i);
  assert.match(checkinPrompt, /ritmo hoje/i);
  assert.match(checkinPrompt, /utilidade funcional/i);
  assert.match(checkinPrompt, /custo oculto/i);
  assert.match(checkinPrompt, /Abrir o planner por 5 minutos/i);
  assert.match(checkinPrompt, /retomando a sugestão anterior/i);
  assert.doesNotMatch(checkinPrompt, /Usuárias típicas têm TDAH/i);

  const journalLivePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-live' as any,
  });

  assert.match(journalLivePrompt, /DIÁRIO \(PRESENÇA REFLEXIVA\)/i);
  assert.match(journalLivePrompt, /acompanhe o fluxo/i);
  assert.match(journalLivePrompt, /HIERARQUIA INTERNA OBRIGATÓRIA/i);
  assert.match(journalLivePrompt, /EIXOS DO DIÁRIO/i);
  assert.match(journalLivePrompt, /FORMATO ADAPTATIVO/i);
  assert.match(journalLivePrompt, /EVENTO REAL vs INTERPRETAÇÃO/i);
  assert.match(journalLivePrompt, /PADRÃO RECORRENTE/i);
  assert.match(journalLivePrompt, /DECISÃO EM JOGO/i);
  assert.match(journalLivePrompt, /MANOBRA CALIBRADA AO CICLO/i);
  assert.match(journalLivePrompt, /BASE DOCUMENTADA, NÃO IMPROVISO/i);
  assert.match(journalLivePrompt, /UTILIDADE DO PROBLEMA/i);
  assert.match(journalLivePrompt, /EFEITO INDIRETO A FAVOR/i);
  assert.match(journalLivePrompt, /TRÍADE INTERNA DE DECISÃO/i);
  assert.match(journalLivePrompt, /SINAIS ANTES DA QUEDA/i);
  assert.match(journalLivePrompt, /evidência concreta/i);
  assert.match(journalLivePrompt, /uma proposta por vez/i);
  assert.match(journalLivePrompt, /isso faz sentido para você/i);
  assert.match(journalLivePrompt, /máximo 1 pergunta/i);
  assert.match(journalLivePrompt, /colete em micro-passos/i);
  assert.match(journalLivePrompt, /PROIBIDO empilhar perguntas/i);
  assert.match(journalLivePrompt, /SOMÁTICA COMO SUPORTE/i);
  assert.match(journalLivePrompt, /função de curto prazo e o custo concreto/i);
  assert.doesNotMatch(journalLivePrompt, /PROIBIDO sugerir metas/i);
  assert.doesNotMatch(journalLivePrompt, /gere 0 a 3 tarefas/i);

  const journalFinalizePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-finalize' as any,
  });

  assert.match(journalFinalizePrompt, /SÍNTESE DA SESSÃO/i);
  assert.match(journalFinalizePrompt, /espelho calmo/i);
  assert.match(journalFinalizePrompt, /Não faça perguntas no fechamento/i);
  assert.match(journalFinalizePrompt, /padrão que apareceu, decisão que ficou em jogo/i);
  assert.match(journalFinalizePrompt, /conversados e validados/i);
  assert.match(journalFinalizePrompt, /Se a pessoa rejeitou/i);
  assert.match(journalFinalizePrompt, /utilidade de curto prazo/i);
  assert.match(journalFinalizePrompt, /Só inclua essa leitura quando a conversa trouxe evidência real/i);
  assert.match(journalFinalizePrompt, /Não use rótulos internos/i);
  assert.doesNotMatch(journalFinalizePrompt, /acompanhe o fluxo/i);

  const auraCommandPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'aura-command' as any,
  });

  assert.match(auraCommandPrompt, /HUB OPERACIONAL/i);
  assert.match(auraCommandPrompt, /executiva de elite/i);
  assert.match(auraCommandPrompt, /reservei 15 min/i);
  assert.match(auraCommandPrompt, /MODO EXECUTOR/i);
  assert.match(auraCommandPrompt, /Comando operacional não é convite para interpretação/i);
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
  assert.match(goalExecutionPrompt, /próxima decisão/i);

  const longitudinalPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'longitudinal-insight' as any,
  });

  assert.match(longitudinalPrompt, /MEMÓRIA E PADRÕES/i);
  assert.match(longitudinalPrompt, /cruze dados/i);
  assert.match(longitudinalPrompt, /semana passada/i);

  // ── CALIBRAÇÃO UNIVERSAL: o novo SUGGESTION_CALIBRATION_CORE deve aparecer em todo prompt ──
  const allPrompts = [
    onboardingPrompt,
    checkinPrompt,
    journalLivePrompt,
    journalFinalizePrompt,
    auraCommandPrompt,
    homePrompt,
    goalExecutionPrompt,
    longitudinalPrompt,
  ];
  for (const p of allPrompts) {
    assert.match(p, /CALIBRAÇÃO DE RESPOSTA E SUGESTÃO/i);
    assert.match(p, /NUNCA GENERALIZE O QUE É ESPECÍFICO/i);
    assert.match(p, /PERGUNTA FINAL NÃO OFERECE OPÇÕES/i);
    assert.match(p, /ESPELHO ANTES DA ANÁLISE/i);
    assert.match(p, /CELEBRE COMPORTAMENTO, NUNCA PESSOA/i);
    assert.match(p, /PROFUNDIDADE ANTES DE SOLUÇÃO/i);
    assert.match(p, /SABER ENCERRAR SEM PERGUNTA/i);
    assert.match(p, /FALADO, NÃO REDIGIDO/i);
    assert.match(p, /SUGESTÃO ANCORADA NO CONTEXTO REAL/i);
    assert.match(p, /PERGUNTE ANTES DE INVENTAR GENÉRICO/i);
    assert.match(p, /HORÁRIO É PISTA INTERNA, NÃO MENCIONE NA FALA/i);
    assert.match(p, /AGENDA ADAPTATIVA/i);
    assert.match(p, /NUNCA SUGIRA AÇÃO PARA HORÁRIO QUE JÁ PASSOU/i);
    assert.match(p, /HORÁRIO ATUAL/i);
    assert.match(p, /USO INTERNO — NÃO MENCIONE NA FALA/i);
    assert.match(p, /Nunca proponha ação para horário que já passou/i);
    assert.match(p, /Minutos importam/i);
    // Anti-genérico operacional + insight↔task
    assert.match(p, /TESTE GENÉRICO OBRIGATÓRIO/i);
    assert.match(p, /LISTA NEGRA — TAREFAS PROIBIDAS/i);
    assert.match(p, /rotação de ombros/i);
    assert.match(p, /INSIGHT E TAREFA COMPARTILHAM ORIGEM/i);
    assert.match(p, /CADA ENTRADA É ÚNICA/i);
    // ALIANCA_DIVERGENTE_CORE — universal, vocabulário interno
    assert.match(p, /NÚCLEO DE RACIOCÍNIO E TOM/i);
    assert.match(p, /TOM = AMIGA PRÓXIMA/i);
    assert.match(p, /O QUE TÁ PASSANDO vs O QUE TÁ TENTANDO/i);
    assert.match(p, /APOIO ≠ AJUDA/i);
    assert.match(p, /PDA — PERCEPÇÃO → DECISÃO → AÇÃO/i);
    assert.match(p, /3 EIXOS DE CALIBRAÇÃO/i);
    assert.match(p, /POSTURA MEMORÁVEL/i);
    assert.match(p, /ESTRUTURA DE RESPOSTA ANALÍTICA EXEMPLAR/i);
  }

  // ── Horário formatado e momento do dia derivado ──
  const morningPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    currentHour: 8,
    currentMinute: 30,
  });
  assert.match(morningPrompt, /08:30 \(manhã\)/);

  const eveningPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    currentHour: 22,
    currentMinute: 5,
  });
  assert.match(eveningPrompt, /22:05 \(noite\)/);

  const afternoonPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    currentHour: 14,
    currentMinute: 0,
  });
  assert.match(afternoonPrompt, /14:00 \(tarde\)/);

  const dawnPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    currentHour: 3,
    currentMinute: 15,
  });
  assert.match(dawnPrompt, /03:15 \(madrugada\)/);
}

run()
  .then(() => {
    console.log('aura-prompt tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
