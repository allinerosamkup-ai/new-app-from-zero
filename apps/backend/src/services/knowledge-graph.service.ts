import { PrismaClient } from '@app/database';
import OpenAI from 'openai';

import { getOpenAiModel } from '../lib/openai-config';
import { CanonicalMemoryService } from './canonical-memory.service';
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
    options: {
      assistantReply?: string; source?: 'journal' | 'checkin' | 'aura'; client?: Pick<OpenAI, 'chat'>;
      allowDecisions?: boolean; locale?: string;
      canonicalMemoryService?: Pick<CanonicalMemoryService, 'write'>;
      prismaClient?: any;
      sourceId?: string;
      observedAt?: Date;
    } = {},
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

      await this.persistExtraction(userId, parsed, {
        source,
        locale: options.locale ?? 'pt-BR',
        allowDecisions: options.allowDecisions ?? true,
        canonicalMemoryService: options.canonicalMemoryService,
        prismaClient: options.prismaClient,
        sourceId: options.sourceId,
        observedAt: options.observedAt,
      });
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
    options: {
      source: string; locale: string; allowDecisions: boolean;
      canonicalMemoryService?: Pick<CanonicalMemoryService, 'write'>;
      prismaClient?: any;
      sourceId?: string;
      observedAt?: Date;
    },
  ): Promise<void> {
    const { source, locale, allowDecisions } = options;
    const now = options.observedAt ?? new Date();
    const db = options.prismaClient ?? prisma;
    const canonical = options.canonicalMemoryService ?? new CanonicalMemoryService(db);
    const memoryKey = (prefix: string, text: string) => `${prefix}.${this.normalize(text).replace(/\s+/g, '.').slice(0, 120)}`;

    // 1. Upsert de entidades — chave única (userId, canonicalName)
    const entityIdByName = new Map<string, string>();
    for (const entity of extraction.entities) {
      const canonical = entity.canonicalName.trim();
      if (!canonical) continue;
      const upserted = await db.userEntity.upsert({
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
    for (const [factIndex, fact] of extraction.facts.entries()) {
      const statement = fact.statement.trim();
      if (!statement) continue;
      const entityId = fact.entityCanonicalName
        ? entityIdByName.get(fact.entityCanonicalName.trim().toLowerCase()) ?? null
        : null;
      const occurredAt = fact.occurredAt ? new Date(fact.occurredAt) : now;
      const canonicalResult = await canonical.write({
        userId, kind: 'fact', scope: entityId ? 'entity' : 'life', canonicalKey: memoryKey('fact', statement),
        content: statement, confidence: fact.confidence ?? 0.8, salience: 0.6, actionAuthority: 'none',
        source, sourceId: `${options.sourceId ?? source}:fact:${factIndex}`, observedAt: Number.isNaN(occurredAt.getTime()) ? now : occurredAt, locale,
      }).catch((error) => { console.warn('[knowledge-graph/canonical-fact]', error); return null; });
      if (!canonicalResult) continue;
      // Sem data explícita, a primeira observação canônica é a identidade
      // temporal estável da projeção. Assim um retry posterior repara ou
      // reutiliza o mesmo fato, em vez de criar outro só porque `now` mudou.
      const projectionOccurredAt = fact.occurredAt
        ? (Number.isNaN(occurredAt.getTime()) ? now : occurredAt)
        : (canonicalResult.memory?.firstSeenAt ?? now);
      const existingFact = await db.userFact.findFirst?.({
        where: {
          userId,
          statement,
          source,
          occurredAt: projectionOccurredAt,
        },
      });
      if (existingFact) continue;
      await db.userFact.create({
        data: {
          userId,
          entityId,
          statement,
          source,
          occurredAt: projectionOccurredAt,
          confidence: fact.confidence ?? 0.8,
        },
      });
    }

    // 3. Padrões — só cria se ainda não existir um padrão idêntico
    for (const [patternIndex, pattern] of extraction.patterns.entries()) {
      const text = pattern.pattern.trim();
      if (!text) continue;
      const evidence = pattern.evidenceFactStatements.length > 0 ? pattern.evidenceFactStatements : [text];
      let hasNewEvidence = false;
      let canonicalSucceeded = false;
      for (const [index, statement] of evidence.entries()) {
        const result = await canonical.write({
          userId, kind: 'pattern', scope: 'life', canonicalKey: memoryKey('pattern', text), content: text,
          confidence: 0.55, salience: 0.65, actionAuthority: 'none', inferred: true,
          source, sourceId: `${options.sourceId ?? source}:pattern:${patternIndex}:${index}`, observedAt: now, statement, locale,
        }).catch((error) => { console.warn('[knowledge-graph/canonical-pattern]', error); return null; });
        canonicalSucceeded = canonicalSucceeded || Boolean(result);
        hasNewEvidence = hasNewEvidence || Boolean(result?.evidenceCreated);
      }
      if (!canonicalSucceeded) continue;
      const existing = await db.userPattern.findFirst({ where: { userId, pattern: text } });
      if (existing) {
        if (hasNewEvidence) await db.userPattern.update({ where: { id: existing.id }, data: { strength: Math.min(1, existing.strength + 0.05), lastConfirmedAt: now } });
      } else {
        await db.userPattern.create({ data: { userId, pattern: text, evidenceFactIds: [], strength: 0.55, lastConfirmedAt: now } });
      }
    }

    // 4. Decisões em aberto — evita duplicar pergunta idêntica não resolvida
    for (const [decisionIndex, decision] of (allowDecisions ? extraction.decisions : []).entries()) {
      const question = decision.question.trim();
      if (!question) continue;
      // Consultar a projeção antes da escrita canônica é essencial: uma
      // reexecução da extração original não pode recriar como ativa uma
      // decisão que a usuária já resolveu.
      const dup = await db.userOpenDecision.findFirst({ where: { userId, question } });
      if (dup?.resolvedAt) continue;
      const canonicalResult = await canonical.write({
        userId, kind: 'decision', scope: 'open_decision', canonicalKey: memoryKey('decision', question),
        content: question, structuredValue: { context: decision.context ?? null, open: true }, confidence: 0.9,
        salience: 0.75, actionAuthority: 'none', source, sourceId: `${options.sourceId ?? source}:decision:${decisionIndex}`, observedAt: now, locale,
      }).catch((error) => { console.warn('[knowledge-graph/canonical-decision]', error); return null; });
      if (!canonicalResult) continue;
      if (dup) continue;
      await db.userOpenDecision.create({
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

    // 3. Padrões com força > 0.35, com decaimento temporal (padrões antigos pesam menos)
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const rawPatterns = await prisma.userPattern.findMany({
      where: { userId, strength: { gt: 0.35 } },
      orderBy: { strength: 'desc' },
      take: 8,
    });
    const patternsRelevant = rawPatterns
      .map((p) => {
        const ageMs = nowMs - p.lastConfirmedAt.getTime();
        const decayFactor = Math.max(0.1, 1 - ageMs / ninetyDaysMs); // Mínimo 10% após 90 dias
        return { pattern: p.pattern, strength: p.strength * decayFactor };
      })
      .filter(p => p.strength > 0.3)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4);

    // 4. Decisões em aberto. Prioriza ANTIGAS (>= 7d) — sinal de que precisa
    //    cutucar a usuária pra resolver. Mistura 2 antigas + 2 recentes.
    const allOpen = await prisma.userOpenDecision.findMany({
      where: { userId, resolvedAt: null },
      orderBy: { raisedAt: 'asc' },
      take: 20,
    });
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const stale = allOpen.filter((d) => d.raisedAt.getTime() < sevenDaysAgo).slice(0, 2);
    const fresh = allOpen.filter((d) => d.raisedAt.getTime() >= sevenDaysAgo).slice(-2);
    const openDecisions = [...stale, ...fresh].map((d) => ({
      question: d.question,
      raisedAt: d.raisedAt,
    }));

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
      lines.push('DECISÕES EM ABERTO (cutuque proativamente as marcadas com ⏰):');
      for (const d of ctx.openDecisions) {
        const days = Math.max(0, Math.floor((Date.now() - d.raisedAt.getTime()) / 86400000));
        const stale = days >= 7 ? '⏰ ' : '';
        lines.push(`- ${stale}${d.question} (aberta há ${days}d)`);
      }
    }

    if (lines.length <= 1) return ''; // nada útil — não polui o prompt
    return lines.join('\n');
  }

  /** Marca uma decisão como resolvida. Usado quando a usuária responde ou age. */
  static async markDecisionResolved(
    decisionId: string,
    resolution?: string,
    options: { prismaClient?: any; now?: Date } = {},
  ): Promise<void> {
    const db = options.prismaClient ?? prisma;
    const now = options.now ?? new Date();
    const synchronize = async (tx: any) => {
      const decision = await tx.userOpenDecision.findUnique({ where: { id: decisionId } });
      if (!decision) {
        // Mantém a semântica anterior de lançar o erro Prisma para um id
        // inexistente, sem simular sucesso.
        await tx.userOpenDecision.update({
          where: { id: decisionId },
          data: { resolvedAt: now, resolution: resolution ?? null },
        });
        return;
      }

      const resolvedAt = decision.resolvedAt ?? now;
      const resolvedWith = decision.resolution ?? resolution ?? null;
      if (!decision.resolvedAt) {
        await tx.userOpenDecision.update({
          where: { id: decisionId },
          data: { resolvedAt, resolution: resolvedWith },
        });
      }

      const canonicalDecisions = await tx.userMemory.findMany({
        where: {
          userId: decision.userId,
          kind: 'decision',
          scope: 'open_decision',
          content: decision.question,
        },
      });
      for (const memory of canonicalDecisions) {
        if (memory.lifecycle === 'retracted' && memory.structuredValue?.open === false) continue;
        await tx.userMemory.update({
          where: { id: memory.id },
          data: {
            structuredValue: {
              ...(memory.structuredValue ?? {}),
              context: memory.structuredValue?.context ?? decision.context ?? null,
              open: false,
              resolution: resolvedWith,
              resolvedAt: resolvedAt.toISOString(),
            },
            lifecycle: 'retracted',
            negativeState: 'completed',
            targetType: 'open_decision',
            targetId: decisionId,
            actionAuthority: 'none',
            lastSeenAt: resolvedAt,
          },
        });
      }
    };

    if (db.$transaction) {
      await db.$transaction((tx: any) => synchronize(tx));
    } else {
      await synchronize(db);
    }
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
