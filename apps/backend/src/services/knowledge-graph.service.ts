import { PrismaClient } from '@app/database';
import OpenAI from 'openai';

import { getOpenAiModel } from '../lib/openai-config';
import {
  KnowledgeGraphExtractionSchema,
  type KnowledgeGraphExtraction,
} from '../contracts/knowledge-graph.contract';

const prisma = new PrismaClient();

// Lazy OpenAI — mesmo padrão de aura-command.service.ts / airia-cognitive
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}

const EXTRACTION_SYSTEM_PROMPT = [
  'Você é um extrator estruturado de fatos pra um knowledge graph pessoal.',
  'Receba a fala da usuária + (opcional) a resposta da Aura.',
  'Extraia:',
  '  • ENTIDADES: pessoas, projetos, eventos, objetos, lugares, hábitos mencionados (com nome canônico curto + aliases). Tipo obrigatório.',
  '  • FATOS: declarações verificáveis sobre essas entidades (ex: "Anúncio das camas postado em Olx 12/05, 0 respostas"). Cada fato pode ligar a UMA entidade ou nenhuma.',
  '  • PADRÕES: regularidades observadas no comportamento da pessoa (ex: "Trava ao precisar cobrar resposta", "Vende rápido pelo Olx quando preço alinhado"). Só extraia padrão se houver evidência clara nessa fala — não invente.',
  '  • DECISÕES EM ABERTO: questões que a pessoa precisa responder pra avançar (ex: "Qual preço usar para as camas?").',
  'Seja CONSERVADOR. Não extraia se não tiver certeza. Vazio é melhor que invenção.',
  'Não infira coisas que a pessoa não disse. Não duplique entidades com nomes similares.',
  'RESPONDA APENAS JSON válido conforme o schema. Sem explicação.',
].join('\n');

const KG_EXTRACTION_USER_TEMPLATE = (userMessage: string, assistantReply?: string) => {
  const parts: string[] = [`USUÁRIA: """${userMessage}"""`];
  if (assistantReply) parts.push(`AIRIA RESPONDEU: """${assistantReply}"""`);
  parts.push(
    'Extraia entidades, fatos, padrões e decisões em aberto. Schema JSON:',
    '{',
    '  "entities": [{"canonicalName": string, "aliases": string[], "type": "person"|"project"|"event"|"object"|"place"|"habit", "status": "active"|"resolved"|"paused"|"abandoned"|null}],',
    '  "facts": [{"entityCanonicalName": string|null, "statement": string, "occurredAt": "YYYY-MM-DDTHH:mm:ssZ"|null, "confidence": number}],',
    '  "patterns": [{"pattern": string, "evidenceFactStatements": string[]}],',
    '  "decisions": [{"question": string, "context": string|null}]',
    '}',
  );
  return parts.join('\n');
};

export type KnowledgeGraphCompactContext = {
  entitiesActive: Array<{ canonicalName: string; type: string; status: string | null; lastMentionAt: Date }>;
  factsRecent: Array<{ statement: string; entityName: string | null; occurredAt: Date }>;
  patternsRelevant: Array<{ pattern: string; strength: number }>;
  openDecisions: Array<{ question: string; raisedAt: Date }>;
};

export class KnowledgeGraphService {
  /**
   * Extrai entidades/fatos/padrões/decisões da última mensagem e persiste no
   * grafo do usuário. Roda de forma assíncrona — não bloqueia resposta.
   * Falha silenciosa (loga e continua) pra não atrapalhar UX se OpenAI falhar.
   */
  static async extractFromMessage(
    userId: string,
    userMessage: string,
    options: { assistantReply?: string; source?: 'journal' | 'checkin'; client?: Pick<OpenAI, 'chat'> } = {},
  ): Promise<{ extracted: KnowledgeGraphExtraction | null; saved: boolean }> {
    const source = options.source ?? 'journal';
    const client = options.client ?? getOpenAI();
    try {
      const response = await client.chat.completions.create({
        model: getOpenAiModel(),
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: KG_EXTRACTION_USER_TEMPLATE(userMessage, options.assistantReply) },
        ],
        response_format: { type: 'json_object' },
      } as any);

      const raw = response.choices?.[0]?.message?.content ?? '{}';
      let parsed: KnowledgeGraphExtraction;
      try {
        const json = JSON.parse(raw);
        parsed = KnowledgeGraphExtractionSchema.parse(json);
      } catch (parseErr) {
        console.warn('[knowledge-graph] extracted JSON inválido, ignorando:', parseErr);
        return { extracted: null, saved: false };
      }

      await this.persistExtraction(userId, parsed, source);
      return { extracted: parsed, saved: true };
    } catch (error) {
      console.warn('[knowledge-graph] extract falhou silenciosamente:', error);
      return { extracted: null, saved: false };
    }
  }

  /** Persiste o resultado da extração. Faz upsert em entidades, append em fatos. */
  static async persistExtraction(
    userId: string,
    extraction: KnowledgeGraphExtraction,
    source: string,
  ): Promise<void> {
    const now = new Date();

    // 1. Upsert de entidades — chave única (userId, canonicalName)
    const entityIdByName = new Map<string, string>();
    for (const entity of extraction.entities) {
      const canonical = entity.canonicalName.trim();
      if (!canonical) continue;
      const upserted = await prisma.userEntity.upsert({
        where: { userId_canonicalName: { userId, canonicalName: canonical } },
        create: {
          userId,
          canonicalName: canonical,
          aliases: entity.aliases ?? [],
          type: entity.type,
          status: entity.status ?? 'active',
          firstMentionAt: now,
          lastMentionAt: now,
        },
        update: {
          // Mantém canonicalName; merge de aliases
          aliases: { set: this.mergeAliases(entity.aliases ?? [], canonical) },
          status: entity.status ?? undefined,
          lastMentionAt: now,
        },
      });
      entityIdByName.set(canonical.toLowerCase(), upserted.id);
    }

    // 2. Append de fatos
    for (const fact of extraction.facts) {
      const statement = fact.statement.trim();
      if (!statement) continue;
      const entityId = fact.entityCanonicalName
        ? entityIdByName.get(fact.entityCanonicalName.trim().toLowerCase()) ?? null
        : null;
      const occurredAt = fact.occurredAt ? new Date(fact.occurredAt) : now;
      await prisma.userFact.create({
        data: {
          userId,
          entityId,
          statement,
          source,
          occurredAt: Number.isNaN(occurredAt.getTime()) ? now : occurredAt,
          confidence: fact.confidence ?? 0.8,
        },
      });
    }

    // 3. Padrões — só cria se ainda não existir um padrão idêntico
    for (const pattern of extraction.patterns) {
      const text = pattern.pattern.trim();
      if (!text) continue;
      const existing = await prisma.userPattern.findFirst({
        where: { userId, pattern: text },
      });
      if (existing) {
        // Reforça padrão observado novamente
        await prisma.userPattern.update({
          where: { id: existing.id },
          data: {
            strength: Math.min(1, existing.strength + 0.05),
            lastConfirmedAt: now,
          },
        });
      } else {
        await prisma.userPattern.create({
          data: {
            userId,
            pattern: text,
            evidenceFactIds: [],
            strength: 0.55,
            lastConfirmedAt: now,
          },
        });
      }
    }

    // 4. Decisões em aberto — evita duplicar pergunta idêntica não resolvida
    for (const decision of extraction.decisions) {
      const question = decision.question.trim();
      if (!question) continue;
      const dup = await prisma.userOpenDecision.findFirst({
        where: { userId, question, resolvedAt: null },
      });
      if (dup) continue;
      await prisma.userOpenDecision.create({
        data: {
          userId,
          question,
          context: decision.context ?? null,
          raisedAt: now,
        },
      });
    }
  }

  /**
   * Constrói o contexto compacto pra injetar no prompt da Aura.
   * Limita TUDO a poucos elementos cirúrgicos — 8-12 itens totais.
   */
  static async getRelevantContextForMessage(
    userId: string,
    message: string,
  ): Promise<KnowledgeGraphCompactContext> {
    const normalized = this.normalize(message);

    // 1. Entidades mencionadas: match por nome canônico OU alias dentro da mensagem
    const allEntities = await prisma.userEntity.findMany({
      where: { userId, status: { not: 'abandoned' } },
      orderBy: { lastMentionAt: 'desc' },
      take: 60,
    });
    const matchedEntities = allEntities.filter((e) => {
      const candidates = [e.canonicalName, ...e.aliases];
      return candidates.some((c) => c && normalized.includes(this.normalize(c)));
    });

    // Se nenhuma entidade direta deu match, pega as 5 mais recentes em status active
    const entitiesActive = (matchedEntities.length > 0 ? matchedEntities : allEntities.filter((e) => e.status === 'active'))
      .slice(0, 5)
      .map((e) => ({
        canonicalName: e.canonicalName,
        type: e.type,
        status: e.status,
        lastMentionAt: e.lastMentionAt,
      }));

    // 2. Fatos recentes ligados a essas entidades (ou últimos fatos gerais)
    const entityIds = entitiesActive.length > 0
      ? matchedEntities.slice(0, 5).map((e) => e.id)
      : [];
    const factsRecent = entityIds.length > 0
      ? (await prisma.userFact.findMany({
          where: { userId, entityId: { in: entityIds } },
          orderBy: { occurredAt: 'desc' },
          take: 6,
          include: { entity: { select: { canonicalName: true } } },
        })).map((f) => ({
          statement: f.statement,
          entityName: f.entity?.canonicalName ?? null,
          occurredAt: f.occurredAt,
        }))
      : (await prisma.userFact.findMany({
          where: { userId },
          orderBy: { occurredAt: 'desc' },
          take: 4,
          include: { entity: { select: { canonicalName: true } } },
        })).map((f) => ({
          statement: f.statement,
          entityName: f.entity?.canonicalName ?? null,
          occurredAt: f.occurredAt,
        }));

    // 3. Padrões com força > 0.5
    const patternsRelevant = (await prisma.userPattern.findMany({
      where: { userId, strength: { gt: 0.5 } },
      orderBy: { strength: 'desc' },
      take: 4,
    })).map((p) => ({ pattern: p.pattern, strength: p.strength }));

    // 4. Decisões em aberto
    const openDecisions = (await prisma.userOpenDecision.findMany({
      where: { userId, resolvedAt: null },
      orderBy: { raisedAt: 'desc' },
      take: 4,
    })).map((d) => ({ question: d.question, raisedAt: d.raisedAt }));

    return { entitiesActive, factsRecent, patternsRelevant, openDecisions };
  }

  /** Serializa o contexto compacto em texto pronto pra colar no prompt. */
  static formatContextForPrompt(ctx: KnowledgeGraphCompactContext): string {
    const lines: string[] = [];
    lines.push('🧠 CONTEXTO ESTRUTURADO DA USUÁRIA (use pra RACIOCINAR, NÃO cite literalmente):');

    if (ctx.entitiesActive.length > 0) {
      lines.push('');
      lines.push('PROJETOS/EVENTOS/PESSOAS ATIVOS:');
      for (const e of ctx.entitiesActive) {
        const days = Math.max(0, Math.floor((Date.now() - e.lastMentionAt.getTime()) / 86400000));
        lines.push(`- ${e.canonicalName} (${e.type}${e.status ? `, ${e.status}` : ''}; mencionado há ${days}d)`);
      }
    }

    if (ctx.factsRecent.length > 0) {
      lines.push('');
      lines.push('FATOS RECENTES (ordem do mais recente):');
      for (const f of ctx.factsRecent) {
        const datePart = f.occurredAt.toISOString().slice(0, 10);
        const entityTag = f.entityName ? `[${f.entityName}] ` : '';
        lines.push(`- ${entityTag}${f.statement} (${datePart})`);
      }
    }

    if (ctx.patternsRelevant.length > 0) {
      lines.push('');
      lines.push('PADRÕES OBSERVADOS (força ≥ 0.5):');
      for (const p of ctx.patternsRelevant) {
        lines.push(`- ${p.pattern} (força: ${p.strength.toFixed(2)})`);
      }
    }

    if (ctx.openDecisions.length > 0) {
      lines.push('');
      lines.push('DECISÕES EM ABERTO:');
      for (const d of ctx.openDecisions) {
        const days = Math.max(0, Math.floor((Date.now() - d.raisedAt.getTime()) / 86400000));
        lines.push(`- ${d.question} (aberta há ${days}d)`);
      }
    }

    if (lines.length <= 1) return ''; // nada útil — não polui o prompt
    return lines.join('\n');
  }

  /** Marca uma decisão como resolvida. Usado quando a usuária responde ou age. */
  static async markDecisionResolved(decisionId: string, resolution?: string): Promise<void> {
    await prisma.userOpenDecision.update({
      where: { id: decisionId },
      data: { resolvedAt: new Date(), resolution: resolution ?? null },
    });
  }

  /** Reforça/enfraquece padrão conforme aceitação de ação ligada. */
  static async reinforcePattern(patternId: string, delta: number): Promise<void> {
    const pattern = await prisma.userPattern.findUnique({ where: { id: patternId } });
    if (!pattern) return;
    const next = Math.max(0, Math.min(1, pattern.strength + delta));
    await prisma.userPattern.update({
      where: { id: patternId },
      data: { strength: next, lastConfirmedAt: delta > 0 ? new Date() : pattern.lastConfirmedAt },
    });
  }

  // ─── helpers privados ─────────────────────────────────────────────────

  private static normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static mergeAliases(incoming: string[], canonical: string): string[] {
    const set = new Set<string>();
    for (const a of incoming) {
      const trimmed = a.trim();
      if (trimmed && trimmed.toLowerCase() !== canonical.toLowerCase()) set.add(trimmed);
    }
    return Array.from(set).slice(0, 8);
  }
}
