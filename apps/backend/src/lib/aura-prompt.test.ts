import assert from 'node:assert/strict';

import { buildAuraSystemPrompt } from './aura-prompt';

async function run() {
  const basePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    profileSummary: 'Prefere passos curtos quando a energia cai.',
    moodCycleContext: 'Humor em queda suave nos ultimos 3 dias; energia mais baixa a tarde.',
    contextualMemory: 'RAG: Ana costuma travar quando precisa mandar mensagens para clientes.',
    plannerContext: 'Planner hoje: Revisar proposta da cliente Julia as 15:00. Habito pendente: caminhada curta.',
    activeGoalsContext: 'Meta ativa: Fechar primeira proposta comercial da semana.',
    recentSuggestionMemory: 'MEMORIA RECENTE DE SUGESTOES DA AURA:\n- Revisar proposta antiga',
    reasoningTraceContext: 'RACIOCINIO OPERACIONAL ESTRUTURADO (USO INTERNO - NAO MOSTRAR):\nEvidencias:\n- Agenda pendente: Revisar proposta da cliente Julia\nDecisao: acao | Revisar proposta da cliente Julia\nConfianca: alta',
    domain: 'checkin',
    currentHour: 10,
    currentMinute: 20,
  });

  assert.match(basePrompt, /Você é Airia/i);
  assert.match(basePrompt, /assistente pessoal de humor, energia e agenda adaptativa/i);
  assert.match(basePrompt, /LEITURA TOTAL/i);
  assert.match(basePrompt, /fato atual, relato da pessoa, emocao e energia do momento, humor atual, historico de humor/i);
  assert.match(basePrompt, /memorias RAG relevantes, planner, metas, habitos, tarefas e acoes recentes/i);
  assert.match(basePrompt, /POLITICA DE SUGESTAO CONCRETA/i);
  assert.match(basePrompt, /um proximo movimento principal/i);
  assert.match(basePrompt, /tarefa, compromisso, habito, ajuste de agenda/i);
  assert.match(basePrompt, /Se houver agenda pendente, priorize adaptar, mover, reduzir, quebrar ou confirmar/i);
  assert.match(basePrompt, /Se houver meta ativa sem agenda forte, proponha o menor avanco possivel/i);
  assert.match(basePrompt, /Se houver habito devido, proponha executar, reduzir ou reagendar/i);
  assert.match(basePrompt, /Se so houver memoria antiga e nenhum fato atual/i);
  assert.match(basePrompt, /pergunta curta/i);
  assert.match(basePrompt, /SEGURANCA E GROUNDING/i);
  assert.match(basePrompt, /Memoria RAG e historico de humor sao obrigatorios como lente/i);
  assert.match(basePrompt, /CHECK-IN/i);
  assert.match(basePrompt, /histórico de humor|historico de humor/i);
  assert.match(basePrompt, /nuance especifica do check-in/i);
  assert.match(basePrompt, /10:20 \(manhã\)/);
  assert.match(basePrompt, /RACIOCINIO OPERACIONAL ESTRUTURADO \(USO INTERNO\)/i);
  assert.match(basePrompt, /Decisao: acao \| Revisar proposta da cliente Julia/i);
  assert.match(basePrompt, /NAO MOSTRAR/i);
  assert.match(basePrompt, /RAG: Ana costuma travar/i);
  assert.match(basePrompt, /Revisar proposta da cliente Julia/i);
  assert.match(basePrompt, /Fechar primeira proposta comercial/i);

  assert.doesNotMatch(basePrompt, /Aliança Divergente/i);
  assert.doesNotMatch(basePrompt, /Marca Passo/i);
  assert.doesNotMatch(basePrompt, /Pense Comigo/i);
  assert.doesNotMatch(basePrompt, /Ponto Cego/i);
  assert.doesNotMatch(basePrompt, /Efeito Paralelo/i);
  assert.doesNotMatch(basePrompt, /Elton/i);

  const journalPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-live',
    contextualMemory: 'RAG: quando evita pedir ajuda, costuma perder prazo.',
    moodCycleContext: 'Humor atual sensivel; historico mostra queda depois de sono ruim.',
  });
  assert.match(journalPrompt, /DIARIO AO VIVO/i);
  assert.match(journalPrompt, /objetivo nao e analisar/i);
  assert.match(journalPrompt, /acao concreta/i);
  assert.match(journalPrompt, /pergunta aberta curta/i);

  const commandPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'aura-command',
  });
  assert.match(commandPrompt, /AURA CHAT EXECUTOR/i);
  assert.match(commandPrompt, /criar, marcar, excluir, concluir, reagendar/i);
  assert.match(commandPrompt, /aja como executora/i);
  assert.match(commandPrompt, /dado indispensavel/i);

  const homePrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
  });
  assert.match(homePrompt, /HOME/i);
  assert.match(homePrompt, /Se nao houver ancora operacional suficiente/i);
  assert.match(homePrompt, /Se nao houver ancora operacional suficiente/i);

  const planningPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'planning',
    phase: 'recovering',
    warningFlags: ['rapid_drop'],
  });
  assert.match(planningPrompt, /PLANEJAMENTO/i);
  assert.match(planningPrompt, /manter, mover, reduzir, pausar, quebrar/i);
  assert.match(planningPrompt, /ESTADO ADAPTATIVO DO DIA/i);

  const insightPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'insight',
    forecast7dSummary: 'Tendencia de energia melhor pela manha e queda no fim da tarde.',
    taskMomentum7d: 2,
  });
  assert.match(insightPrompt, /INSIGHTS/i);
  assert.match(insightPrompt, /humor longitudinal, habitos, planner, metas e RAG/i);
  assert.match(insightPrompt, /PREVISAO 7 DIAS/i);
  assert.match(insightPrompt, /MOMENTUM SEMANAL/i);

  const summaryPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-finalize',
  });
  assert.match(summaryPrompt, /FECHAMENTO DO DIARIO/i);
  assert.match(summaryPrompt, /sem nova tarefa inventada/i);
  assert.match(summaryPrompt, /Sugestoes finais so entram se foram conversadas ou aceitas/i);

  const lowCheckinPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'checkin',
    moodCycleContext: 'Historico de humor: queda sustentada depois de duas noites ruins.',
    contextualMemory: 'RAG: ela costuma piorar quando tenta compensar tudo no mesmo dia.',
    plannerContext: 'Agenda pendente: pagar conta da luz. Habito pendente: alongamento de 5 minutos.',
    currentHour: 8,
    currentMinute: 30,
  });
  assert.match(lowCheckinPrompt, /queda sustentada/i);
  assert.match(lowCheckinPrompt, /pagar conta da luz/i);
  assert.match(lowCheckinPrompt, /Habito pendente/i);
  assert.match(lowCheckinPrompt, /versao minima ou protecao de janela/i);

  const onlyMemoryPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    contextualMemory: 'RAG: padrao antigo de evitar conversas dificeis com familia.',
  });
  assert.match(onlyMemoryPrompt, /Se so houver memoria antiga e nenhum fato atual/i);
  assert.match(onlyMemoryPrompt, /pergunte qual e a situacao de hoje antes de criar tarefa/i);

  const eveningPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    currentHour: 22,
    currentMinute: 5,
  });
  assert.match(eveningPrompt, /22:05 \(noite\)/);

  const dawnPrompt = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'home',
    currentHour: 3,
    currentMinute: 15,
  });
  assert.match(dawnPrompt, /03:15 \(madrugada\)/);

  // ─── Fix 1: jargão técnico não pode estar autorizado em VOICE_POLICY ────
  const journalForJargonAudit = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-live',
  });
  // VOICE_POLICY antiga dizia "Acrescente leitura, decisão, manobra ou pergunta concreta" — proibido agora
  assert.doesNotMatch(journalForJargonAudit, /Acrescente leitura, decisao, manobra/i);
  // Nova regra explícita de palavras proibidas precisa estar presente
  assert.match(journalForJargonAudit, /PROIBIDO no texto visivel/i);
  assert.match(journalForJargonAudit, /manobra.*ancora/i);

  // ─── Fix 2: INTERNAL_METHOD_LENS reescrita com 9 regras concretas ──────
  assert.match(journalForJargonAudit, /UM PROBLEMA POR VEZ/);
  assert.match(journalForJargonAudit, /NUNCA costure tres numa resposta so/i);
  assert.match(journalForJargonAudit, /APOIO, NAO SOLUCAO/);
  assert.match(journalForJargonAudit, /PARA QUE, NAO POR QUE/);
  assert.match(journalForJargonAudit, /DIAGNOSTICO INICIAL/);

  // ─── Fix 3: journal-live policy com regras anti-eco/MC/costura ─────────
  assert.match(journalForJargonAudit, /PROIBIDO MULTIPLA ESCOLHA/);
  assert.match(journalForJargonAudit, /PROIBIDO ECOAR/);
  assert.match(journalForJargonAudit, /PROIBIDO COSTURAR DOIS PROBLEMAS/);
  assert.match(journalForJargonAudit, /no maximo 12 palavras/);
  assert.match(journalForJargonAudit, /PROIBIDO VALIDAR SEM MOVIMENTO/);

  // ─── Fix J+K: anti-loop, rotação de modos, few-shot example ────────────
  assert.match(journalForJargonAudit, /ANTI-LOOP DE PERGUNTA/);
  assert.match(journalForJargonAudit, /ROTACAO DE MODOS/);
  assert.match(journalForJargonAudit, /\[LEITURA\].*\[PROVOCACAO\].*\[ACAO\].*\[PERGUNTA\]/s);
  assert.match(journalForJargonAudit, /USE OS FATOS QUE ELA JA DISSE/);
  assert.match(journalForJargonAudit, /EXEMPLO DE TURNO BOM/);
  assert.match(journalForJargonAudit, /Olx, Facebook e Instagram/);
}

run()
  .then(() => {
    console.log('aura-prompt tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
