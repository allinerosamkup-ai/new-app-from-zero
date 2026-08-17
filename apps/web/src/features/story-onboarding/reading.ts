/**
 * A conta e o espelho — as duas telas em que a Airia devolve a pessoa para ela.
 *
 * Tudo aqui é determinístico e nasce das respostas que ela acabou de dar. Não
 * há chamada de modelo e não pode haver: são as duas telas em que um número
 * errado ou uma frase inventada destrói a confiança inteira do fluxo, e é
 * justamente onde o modelo não acrescenta nada — a conta é aritmética.
 *
 * Duas regras que valem para cada frase deste arquivo:
 *
 *  1. **Nada de rótulo.** Nenhuma frase daqui atribui condição, sigla ou
 *     diagnóstico a ninguém — o produto tem guardrail automático contra isso e a
 *     razão é boa: o público já chega diagnosticado ou com medo de ser. A
 *     leitura é sobre o padrão que ela descreveu, nunca sobre o que ela é.
 *     (O teste `reading.test.ts` varre todas as saídas contra esse vocabulário.)
 *
 *  2. **Reposicionar a culpa, não somar.** O documento de referência manda
 *     fazer a pessoa sentir o peso do problema. Para quem tem depressão ou
 *     ciclotimia, "você desperdiça 4 horas por dia" não vira insight, vira
 *     vergonha — e vergonha alimenta a paralisia que o app existe para quebrar.
 *     Toda frase daqui tira o peso de cima dela e coloca no mecanismo.
 */

export type BlockerId = 'start' | 'prioritize' | 'finish' | 'consistency' | 'remember';

export type StoryAnswers = {
  name: string;
  feeling: string | null;
  blockers: BlockerId[];
  openFronts: number | null;
  drains: string[];
  restorers: string[];
  listPreference: 'one_at_a_time' | 'whole_picture' | null;
  /**
   * Traços permanentes. Não entram na conta nem no espelho — eles não descrevem
   * como a pessoa chegou, decidem quais perguntas o app faz de amanhã em diante.
   * `null` significa "não respondeu", e a regra em toda leitura é que não
   * responder mantém a pergunta visível, nunca esconde dado sem avisar.
   */
  biologicalSex: string | null;
  medication: string | null;
  diagnoses: string[];
};

export const BLOCKER_LABEL: Record<BlockerId, string> = {
  start: 'começar',
  prioritize: 'decidir o que fazer antes',
  finish: 'terminar',
  consistency: 'manter constância',
  remember: 'lembrar',
};

export type Reckoning = {
  /** A frase de cima, curta e factual. */
  headline: string;
  /** A virada: onde o peso realmente está. */
  turn: string;
  /** O dado que sustenta as duas. Fica visível para poder ser conferido. */
  evidence: string;
};

function list(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/**
 * A conta da tela 08 — o primeiro momento de reconhecimento.
 *
 * Devolve `null` quando não há resposta suficiente. A tela some nesse caso, em
 * vez de mostrar uma frase morna: leitura genérica aqui é pior que nenhuma,
 * porque ensina que a leitura do app não vale nada.
 */
export function buildReckoning(answers: StoryAnswers): Reckoning | null {
  const blockers = answers.blockers.filter((id) => BLOCKER_LABEL[id]);
  const fronts = answers.openFronts;
  if (blockers.length === 0 && fronts === null) return null;

  const nomes = blockers.map((id) => BLOCKER_LABEL[id]);
  const travaParaComecar = blockers.includes('start');
  const travaParaPriorizar = blockers.includes('prioritize');
  const muitasFrentes = (fronts ?? 0) >= 5;

  // O caso mais comum e o mais mal interpretado pela própria pessoa: ela acha
  // que é preguiça, e é custo de decisão acumulado.
  if (travaParaPriorizar && muitasFrentes) {
    return {
      headline: `Você marcou ${list(nomes)}, com ${fronts} frentes abertas.`,
      turn: `${fronts} frentes abertas é ${fronts} decisões por dia antes de qualquer coisa acontecer. O gasto não está na tarefa. Está em escolher.`,
      evidence: `com base no que você marcou agora: ${list(nomes)} · ${fronts} frentes abertas`,
    };
  }

  if (travaParaComecar && muitasFrentes) {
    return {
      headline: `Travar para começar com ${fronts} coisas em aberto não é falta de vontade.`,
      turn: 'Quanto mais coisa esperando, mais caro fica o primeiro movimento. Não é você que está devagar: é a fila que está pesada.',
      evidence: `com base no que você marcou agora: ${list(nomes)} · ${fronts} frentes abertas`,
    };
  }

  if (travaParaComecar) {
    return {
      headline: 'O ponto mais caro do seu dia é o primeiro movimento.',
      turn: 'Depois que começa, anda. O problema nunca foi o meio da tarefa — foi a entrada dela.',
      evidence: `com base no que você marcou agora: ${list(nomes)}`,
    };
  }

  if (muitasFrentes) {
    return {
      headline: `Você está segurando ${fronts} frentes ao mesmo tempo.`,
      turn: 'Sua cabeça está sendo usada como lista de tarefas. É por isso que cansa mesmo nos dias em que nada grande aconteceu.',
      evidence: `com base no que você marcou agora: ${fronts} frentes abertas`,
    };
  }

  if (blockers.includes('finish')) {
    return {
      headline: 'Você começa. O que não fecha é o fim.',
      turn: 'Coisa quase pronta ocupa o mesmo espaço na cabeça que coisa não começada — e ainda cobra juros.',
      evidence: `com base no que você marcou agora: ${list(nomes)}`,
    };
  }

  return {
    headline: `O que mais te trava é ${list(nomes)}.`,
    turn: 'Isso é padrão, não caráter. E padrão dá para trabalhar.',
    evidence: `com base no que você marcou agora: ${list(nomes)}`,
  };
}

/**
 * O espelho da tela 14 — as respostas dela, devolvidas em forma de retrato.
 *
 * Cada linha sai de uma resposta. Nenhuma linha é conclusão nova: se ela não
 * disse, não aparece aqui.
 */
export function buildMirror(answers: StoryAnswers): string[] {
  const linhas: string[] = [];

  if (answers.feeling) {
    linhas.push(`Você chegou aqui ${answers.feeling.toLowerCase()}.`);
  }

  const nomes = answers.blockers.filter((id) => BLOCKER_LABEL[id]).map((id) => BLOCKER_LABEL[id]);
  if (nomes.length > 0) {
    linhas.push(`O que trava primeiro é ${list(nomes)}.`);
  }

  if (answers.drains.length > 0) {
    linhas.push(`O que te esvazia: ${list(answers.drains.map((d) => d.toLowerCase()))}.`);
  }

  if (answers.restorers.length > 0) {
    linhas.push(`O que te devolve energia: ${list(answers.restorers.map((r) => r.toLowerCase()))}.`);
  }

  if (answers.listPreference === 'one_at_a_time') {
    linhas.push('E quando a lista é grande, você prefere uma coisa de cada vez.');
  } else if (answers.listPreference === 'whole_picture') {
    linhas.push('E você prefere ver o quadro inteiro antes de escolher.');
  }

  return linhas;
}

/**
 * O resumo do ato 3 — onde ela está e onde pode chegar.
 *
 * A meta de 30 dias é de presença, não de resultado. Prometer um resultado a
 * quem oscila é fabricar a próxima decepção; prometer que o app vai conhecer o
 * ritmo dela é o que a gente realmente entrega.
 */
export function buildOutlook(answers: StoryAnswers, goalTitle: string | null): { now: string; ahead: string } {
  const fronts = answers.openFronts;
  const nomes = answers.blockers.filter((id) => BLOCKER_LABEL[id]).map((id) => BLOCKER_LABEL[id]);

  const now = [
    fronts !== null && fronts > 0 ? `${fronts} frentes abertas` : '',
    nomes.length > 0 ? `trava em ${list(nomes)}` : '',
  ].filter(Boolean).join(', ') || 'ponto de partida registrado';

  const ahead = goalTitle
    ? `"${goalTitle}" andando um passo por vez, e a Airia sabendo qual é o seu ritmo.`
    : 'a Airia sabendo qual é o seu ritmo e ajustando o tamanho do dia a ele.';

  return { now, ahead };
}
