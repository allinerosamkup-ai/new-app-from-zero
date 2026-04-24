type SuggestionMemoryItem = {
  key: string;
  theme: string;
  text: string;
  sourceSurface: string;
  createdAt: string;
};

const PAYLOAD_KEY = 'recentSuggestionMemory';
const MAX_STORED_SUGGESTIONS = 40;
const DEFAULT_RECENT_LIMIT = 12;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;

    const key = SuggestionMemoryService.buildKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function tokenSet(value: string): Set<string> {
  const stopwords = new Set([
    'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
    'por', 'para', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus', 'voce',
    'voce', 'hoje', 'agora', 'min', 'minutos', 'minuto',
  ]);

  return new Set(
    SuggestionMemoryService.buildKey(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !stopwords.has(token)),
  );
}

function tokenOverlap(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }

  return common / Math.min(left.size, right.size);
}

export class SuggestionMemoryService {
  static buildKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static inferTheme(value: string): string {
    const key = this.buildKey(value);

    if (/\b(ligar|enviar|mandar|mensagem|whatsapp|email|responder|falar|conversar)\b/.test(key)) return 'comunicacao';
    if (/\b(abrir|escrever|listar|separar|pegar|colocar|verificar|agenda|planner|calendario)\b/.test(key)) return 'execucao';
    if (/\b(dormir|sono|deitar|tela|descanso|pausa|recuperacao)\b/.test(key)) return 'recuperacao';
    if (/\b(respirar|corpo|peito|alongar|postura|agua|banho)\b/.test(key)) return 'somatico';
    if (/\b(expor|tentativa|primeiro passo|evitar|medo|ligacao|desconforto)\b/.test(key)) return 'exposicao';
    if (/\b(dinheiro|fluxo|aluguel|pagar|receber|financeiro|cobrar)\b/.test(key)) return 'financeiro';
    if (/\b(casa|quarto|cozinha|roupa|mesa|limpar|arrumar)\b/.test(key)) return 'ambiente';
    if (/\b(meta|projeto|trabalho|foco|tarefa|entregar|pitch)\b/.test(key)) return 'trabalho';

    return 'geral';
  }

  static isSimilar(candidate: string, item: Pick<SuggestionMemoryItem, 'key' | 'theme' | 'text'>): boolean {
    const key = this.buildKey(candidate);
    if (!key) return false;
    if (key === item.key || key.includes(item.key) || item.key.includes(key)) return true;

    const overlap = tokenOverlap(candidate, item.text);
    if (overlap >= 0.62) return true;

    const candidateTheme = this.inferTheme(candidate);
    return candidateTheme === item.theme && overlap >= 0.45;
  }

  static formatForPrompt(items: SuggestionMemoryItem[]): string {
    if (items.length === 0) return '';

    const lines = items.slice(0, DEFAULT_RECENT_LIMIT).map((item) =>
      `- [${item.sourceSurface}/${item.theme}] ${item.text}`,
    );

    return `\nMEMORIA RECENTE DE SUGESTOES DA AURA:\n${lines.join('\n')}\nREGRA: nao repita, nao parafraseie e nao recicle estas sugestoes. Se uma delas continuar sendo a melhor acao, diga explicitamente que esta retomando a sugestao anterior e explique o ajuste concreto.`;
  }

  static extractTextsFromSuggestion(type: string, suggestion: unknown): string[] {
    if (!suggestion) return [];

    if (typeof suggestion === 'string') {
      return uniqueStrings([suggestion]);
    }

    if (Array.isArray(suggestion)) {
      return uniqueStrings(
        suggestion.flatMap((item) => {
          if (typeof item === 'string') return [item];
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return [
              normalizeText(obj.title),
              normalizeText(obj.label),
              ...(Array.isArray(obj.tarefas_sugeridas) ? obj.tarefas_sugeridas.map(normalizeText) : []),
            ];
          }
          return [];
        }),
      );
    }

    if (typeof suggestion === 'object') {
      const payload = suggestion as Record<string, unknown>;
      const values = [
        normalizeText(payload.suggestion),
        normalizeText(payload.action),
        normalizeText(payload.actionTitle),
        normalizeText(payload.tip),
        ...(Array.isArray(payload.autocuidado) ? payload.autocuidado.map(normalizeText) : []),
        ...(Array.isArray(payload.recommendations)
          ? payload.recommendations.map((item) => typeof item === 'string' ? item : normalizeText((item as Record<string, unknown>)?.text))
          : []),
        ...(Array.isArray(payload.actions)
          ? payload.actions.map((item) => normalizeText((item as Record<string, unknown>)?.title))
          : []),
      ];

      if (payload.proactive && typeof payload.proactive === 'object') {
        values.push(normalizeText((payload.proactive as Record<string, unknown>).title));
        values.push(normalizeText((payload.proactive as Record<string, unknown>).desc));
      }

      return uniqueStrings(values);
    }

    return [];
  }

  static filterNovelStrings(values: string[], recent: SuggestionMemoryItem[]): string[] {
    return uniqueStrings(values).filter((value) => !recent.some((item) => this.isSimilar(value, item)));
  }

  static async getRecent(prisma: any, userId: string, limit = DEFAULT_RECENT_LIMIT): Promise<SuggestionMemoryItem[]> {
    const row = await prisma.onboardingResponse.findUnique({
      where: { userId },
      select: { aiProfilePayload: true },
    }).catch(() => null);

    const payload = (row?.aiProfilePayload ?? {}) as Record<string, unknown>;
    const raw = Array.isArray(payload[PAYLOAD_KEY]) ? payload[PAYLOAD_KEY] : [];

    return raw
      .filter((item): item is SuggestionMemoryItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as SuggestionMemoryItem).key === 'string' &&
        typeof (item as SuggestionMemoryItem).text === 'string' &&
        typeof (item as SuggestionMemoryItem).sourceSurface === 'string',
      )
      .slice(0, limit);
  }

  static async append(prisma: any, userId: string, sourceSurface: string, texts: string[]): Promise<void> {
    const cleanTexts = uniqueStrings(texts).filter((text) => text.length >= 8);
    if (cleanTexts.length === 0) return;

    const existing = await prisma.onboardingResponse.findUnique({
      where: { userId },
      select: { aiProfilePayload: true },
    }).catch(() => null);

    const existingPayload = ((existing?.aiProfilePayload ?? {}) as Record<string, unknown>);
    const existingItems = await this.getRecent(prisma, userId, MAX_STORED_SUGGESTIONS);
    const now = new Date().toISOString();
    const nextItems: SuggestionMemoryItem[] = [
      ...cleanTexts.map((text) => ({
        key: this.buildKey(text),
        theme: this.inferTheme(text),
        text,
        sourceSurface,
        createdAt: now,
      })),
      ...existingItems,
    ];

    const seen = new Set<string>();
    const deduped = nextItems.filter((item) => {
      const dedupeKey = `${item.sourceSurface}:${item.key}`;
      if (!item.key || seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    }).slice(0, MAX_STORED_SUGGESTIONS);

    await prisma.onboardingResponse.upsert({
      where: { userId },
      update: {
        aiProfilePayload: {
          ...existingPayload,
          [PAYLOAD_KEY]: deduped,
        },
      },
      create: {
        userId,
        aiProfilePayload: {
          [PAYLOAD_KEY]: deduped,
        },
      },
    }).catch((error: unknown) => {
      console.warn('[SuggestionMemoryService.append] failed:', error);
    });
  }
}

export type { SuggestionMemoryItem };
