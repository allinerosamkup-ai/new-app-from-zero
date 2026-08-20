/**
 * Discernimento contextual — separar o que não pertence junto.
 *
 * A Airia deve cruzar dados. Cruzar dados **não é** juntar acontecimentos
 * diferentes só porque são da mesma pessoa e aconteceram perto no tempo.
 *
 * O caso real que originou este módulo: a pessoa escreveu no diário que ficou
 * chateada com uma conversa com a tia, e depois criou um objetivo de trabalho
 * sobre desenvolver um aplicativo. A Airia juntou os dois e devolveu o objetivo
 * profissional como se fosse desdobramento do problema familiar. Isso é
 * `RELATIONSHIP HALLUCINATION`: proximidade temporal lida como relação causal.
 *
 * O anti-fluxo que causava isso era literal no código — `LOAD EVERYTHING → FIND
 * SOMETHING THAT LOOKS RELATED`. Toda fala da pessoa (nota do check-in, diário,
 * conversa com a Airia) era despejada no prompt do objetivo sem nenhum filtro.
 *
 * Este módulo é o filtro. Ele é **determinístico e local**: nenhuma chamada de
 * modelo no caminho quente, porque classificar domínio com LLM custaria uma
 * requisição por fala e a decisão certa aqui é quase sempre óbvia no léxico.
 *
 * Regra que ele implementa (§33.1): antes de relacionar duas informações,
 * existe evidência suficiente de que pertencem ao mesmo contexto? Se não houver,
 * não conectar. Se houver possibilidade sem evidência, manter separado.
 */

export type ContextDomain =
  | 'family'
  | 'work'
  | 'relationship'
  | 'health'
  | 'finance'
  | 'home'
  | 'social'
  | 'study'
  | 'personal'
  | 'other';

/**
 * Léxico por domínio. Palavras que, quando aparecem, indicam de que assunto a
 * frase trata. Deliberadamente conservador: é melhor cair em `other` (que não
 * conecta com nada) do que classificar errado e autorizar um cruzamento falso.
 */
const LEXICON: Array<{ domain: ContextDomain; terms: RegExp }> = [
  {
    domain: 'family',
    terms: /\b(m[ãa]e|pai|tia|tio|av[óo]|av[óo]s|irm[ãa]o?|irm[ãa]|filh[oa]s?|prim[oa]s?|sobrinh[oa]s?|madrasta|padrasto|sogr[ao]|cunhad[oa]|fam[íi]lia|parente|mam[ãa]e|mamãe|papai|p[ãa]i|m[ãa]e do [a-z]+)\b/i,
  },
  {
    domain: 'work',
    terms: /\b(trabalho|emprego|chefe|gerente|cliente|reuni[ãa]o|projeto|entrega|prazo|deadline|escrit[óo]rio|equipe|time|carreira|freela|freelance|app|aplicativo|sistema|c[óo]digo|deploy|lan[çc]amento|startup|neg[óo]cio|empresa|contrato|proposta|apresenta[çc][ãa]o)\b/i,
  },
  {
    domain: 'relationship',
    terms: /\b(namorad[oa]|marido|esposa|parceir[oa]|c[ôo]njuge|relacionamento|namoro|casamento|ex\b|crush|paquera|term(?:inei|inar|inamos))\b/i,
  },
  {
    domain: 'health',
    terms: /\b(m[ée]dic[oa]|consulta|exame|rem[ée]dio|medica[çc][ãa]o|terapia|terapeuta|psic[óo]log[oa]|psiquiatra|dor|doen[çc]a|sintoma|diagn[óo]stico|sono|ins[ôo]nia|corpo|cl[íi]nica|hospital|dentista|nutricionista|corr[ee]|corrida|correndo|corri|caminh[ao]|treino|treinar|academia|exerc[íi]cio|exercitar|alongar|alongamento|bicicleta|pedal|nata[çc][ãa]o|nadar|muscula[çc][ãa]o|yoga|pilates|sa[úu]de|emagrecer|dieta|alimenta[çc][ãa]o|hidrata[çc][ãa]o|energia f[íi]sica|respirar|medita[çc][ãa]o)\b/i,
  },
  {
    domain: 'finance',
    terms: /\b(dinheiro|conta[s]?\s+(?:a\s+)?pagar|boleto|d[íi]vida|sal[áa]rio|pagamento|fatura|cart[ãa]o|banco|or[çc]amento|investimento|gasto[s]?|financeir[oa]|aluguel|imposto)\b/i,
  },
  {
    domain: 'home',
    terms: /\b(casa|apartamento|louça|faxina|limpeza|arrumar\s+a\s+casa|mercado|compras\s+de\s+casa|cozinha|quarto|sala|banheiro|roupa[s]?\s+(?:pra|para)\s+lavar|mudan[çc]a)\b/i,
  },
  {
    domain: 'social',
    terms: /\b(amig[oa]s?|amizade|festa|encontro|role|sair\s+com|anivers[áa]rio|convite|grupo|vizinh[oa]s?)\b/i,
  },
  {
    domain: 'study',
    terms: /\b(estudo|estudar|faculdade|universidade|curso|prova|matr[íi]cula|professor[a]?|aula|tcc|monografia|concurso|vestibular|disciplina)\b/i,
  },
];

/**
 * Classifica uma fala num domínio.
 *
 * Empate entre domínios com a mesma força devolve `other`: se a frase pertence
 * a dois assuntos igualmente, ela não autoriza cruzamento com nenhum dos dois.
 */
export function classifyDomain(text: string | null | undefined): ContextDomain {
  const clean = (text ?? '').trim();
  if (!clean) return 'other';

  const scores = new Map<ContextDomain, number>();
  for (const { domain, terms } of LEXICON) {
    const matches = clean.match(new RegExp(terms.source, 'gi'));
    if (matches && matches.length > 0) scores.set(domain, matches.length);
  }
  if (scores.size === 0) return 'other';

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);

  /**
   * Só vence com margem clara — pelo menos dois termos à frente do segundo.
   *
   * "Minha mãe me ligou no meio da reunião com o cliente" tem dois termos de
   * trabalho contra um de família, e por maioria simples viraria `work`. Mas a
   * frase é sobre as duas coisas, e classificá-la autorizaria cruzá-la com um
   * objetivo profissional. Vantagem de um termo não é evidência; é ruído com
   * sinal de mais. Empate e quase-empate caem em `other`, que não conecta com
   * nada — o custo de não usar uma informação é sempre menor que o de usá-la
   * no contexto errado.
   */
  if (ranked.length > 1 && ranked[0][1] - ranked[1][1] < 2) return 'other';
  return ranked[0][0];
}

/** Nível de relação entre duas informações (§33.7). */
export type RelationLevel = 0 | 1 | 2 | 3 | 4;

export type RelevanceVerdict = {
  level: RelationLevel;
  /** `true` só a partir do nível 2: abaixo disso a informação não entra no prompt. */
  usable: boolean;
  reason: string;
};

/** Sobreposição de termos significativos, ignorando palavras vazias. */
const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'para', 'pra', 'por', 'com', 'que', 'se', 'meu', 'minha', 'eu', 'ele', 'ela',
  'mais', 'menos', 'muito', 'ja', 'já', 'nao', 'não', 'sim', 'the', 'to', 'of', 'my', 'i',
]);

function significantTerms(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
  );
}

/**
 * Decide se uma fala da pessoa pode ser usada como contexto de um objetivo.
 *
 * Os níveis vêm do §33.7. O corte para uso é **nível 2** — múltiplos sinais
 * convergentes. Nível 1 (alguma semelhança, sem evidência) existe de propósito
 * e **não** é usável: é exatamente a faixa onde a alucinação de relação
 * acontece, porque parece conexão e não é.
 */
export function assessRelevance(statement: string, goalTitle: string): RelevanceVerdict {
  const clean = statement.trim();
  const goal = goalTitle.trim();
  if (!clean || !goal) {
    return { level: 0, usable: false, reason: 'sem texto para comparar' };
  }

  const statementDomain = classifyDomain(clean);
  const goalDomain = classifyDomain(goal);

  const statementTerms = significantTerms(clean);
  const goalTerms = significantTerms(goal);
  const shared = [...goalTerms].filter((term) => statementTerms.has(term));

  // Nível 4 — a própria pessoa estabeleceu a conexão citando o objetivo.
  if (shared.length >= 2) {
    return { level: 4, usable: true, reason: `cita o objetivo (${shared.slice(0, 3).join(', ')})` };
  }

  // Nível 3 — mesmo domínio e uma referência em comum.
  if (statementDomain !== 'other' && statementDomain === goalDomain && shared.length >= 1) {
    return { level: 3, usable: true, reason: `mesmo domínio (${goalDomain}) e termo em comum` };
  }

  // Nível 2 — mesmo domínio identificado. Suficiente para entrar como contexto.
  if (statementDomain !== 'other' && statementDomain === goalDomain) {
    return { level: 2, usable: true, reason: `mesmo domínio (${goalDomain})` };
  }

  // Nível 1 — um termo em comum, mas domínios diferentes ou indefinidos. É a
  // faixa perigosa: parece relação e não é. Não entra.
  if (shared.length >= 1) {
    return { level: 1, usable: false, reason: `só um termo em comum, domínios diferentes` };
  }

  // Nível 0 — domínios distintos e nada em comum. O caso da tia e do aplicativo.
  if (statementDomain !== 'other' && goalDomain !== 'other' && statementDomain !== goalDomain) {
    return { level: 0, usable: false, reason: `domínios distintos (${statementDomain} × ${goalDomain})` };
  }

  return { level: 0, usable: false, reason: 'sem evidência de relação' };
}

/**
 * Frases que são conversa pura e não expressam intenção acionável.
 *
 * Misturar "Olá tudo bem", "Obrigada", "Sim" com geração de passos foi
 * exatamente o bug de produção de 19/08/2026: o fallback vestiu diário de
 * roupa de ação. Conversação não entra em contexto de objetivo — nunca.
 */
const CHAT_PHRASES = /^\b(ol[áa]|oi|tudo bem|tudo bom|obrigad[oa]|obrigada aí|valeu|sim|n[aã]o|entendi|ok|certo|hum|hmm|kk\+?|rs|rsrs|haha|hehe|boa|boa noite|bom dia|ol[áa] tudo bem|como vc|pode sim|de boa|show|perfeito|ent[aã]o|s[óe] isso|é isso|isso aí|bjs|beijos|haja vista)\b/i;

function isChatStatement(statement: string): boolean {
  const clean = statement.trim();
  if (!clean) return true;
  if (CHAT_PHRASES.test(clean)) return true;
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5 && /[!?.]$/.test(clean) === false && !/\b(corr|trein|academi|exerc|cozinh|comer|beber|dorm|estud|trabalh|pag|limp|arrum|lig|mand|escrev|anot|l[êe]|verific|separ|escolh|defin|organ|mont|comec|sair|and|fic|sent|dizer|trav[a-zà-ÿ]*)\b/i.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Filtra as falas da pessoa antes de virarem contexto de um objetivo.
 *
 * Devolve também o que ficou de fora e por quê — sem isso, "a Airia não usou
 * meu diário" viraria mistério em vez de decisão registrada.
 *
 * Primeira peneira (não negociável): conversação pura não vira contexto —
 * saudação, agradecimento, confirmação e frase curta sem intenção não dizem
 * nada sobre o objetivo, e foram o vetor do bug de 19/08/2026.
 */
export function filterStatementsForGoal(
  statements: readonly string[],
  goalTitle: string,
): { relevant: string[]; excluded: Array<{ statement: string; reason: string }> } {
  const relevant: string[] = [];
  const excluded: Array<{ statement: string; reason: string }> = [];

  for (const statement of statements) {
    if (isChatStatement(statement)) {
      excluded.push({ statement, reason: 'conversa pura, sem relação com o objetivo' });
      continue;
    }
    const verdict = assessRelevance(statement, goalTitle);
    if (verdict.usable) relevant.push(statement);
    else excluded.push({ statement, reason: verdict.reason });
  }

  return { relevant, excluded };
}
