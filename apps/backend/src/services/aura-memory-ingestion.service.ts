import type { AuraCommandHistoryMessage } from '../contracts/aura-command.contract';
import { CanonicalMemoryService, type CanonicalMemoryKind } from './canonical-memory.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import type { MemoryService } from './memory.service';

export type AuraExtractedMemory = {
  kind: CanonicalMemoryKind;
  scope: string;
  canonicalKey: string;
  content: string;
  structuredValue?: Record<string, unknown>;
  confidence?: number;
  salience?: number;
  inferred?: boolean;
};

export type AuraMemoryExtractor = {
  extract(input: { message: string; assistantReply?: string; history: AuraCommandHistoryMessage[]; locale: string }): Promise<AuraExtractedMemory[]>;
};

export class AuraMemoryIngestionService {
  private readonly canonical: Pick<CanonicalMemoryService, 'write'>;
  private readonly vector: Pick<MemoryService, 'store'>;
  private readonly extractor: AuraMemoryExtractor;
  private readonly graphExtract: (userId: string, message: string, reply?: string, options?: { allowDecisions: boolean; locale: string; isVenting: boolean; sourceId: string; observedAt: Date }) => Promise<unknown>;

  constructor(deps: {
    canonical: Pick<CanonicalMemoryService, 'write'>;
    vector: Pick<MemoryService, 'store'>;
    extractor: AuraMemoryExtractor;
    graphExtract?: (userId: string, message: string, reply?: string, options?: { allowDecisions: boolean; locale: string; isVenting: boolean; sourceId: string; observedAt: Date }) => Promise<unknown>;
  }) {
    this.canonical = deps.canonical;
    this.vector = deps.vector;
    this.extractor = deps.extractor;
    this.graphExtract = deps.graphExtract ?? ((userId, message, reply, options) => KnowledgeGraphService.extractFromMessage(userId, message, {
      assistantReply: reply,
      source: 'aura',
      allowDecisions: options?.allowDecisions,
      locale: options?.locale,
      canonicalMemoryService: this.canonical,
      sourceId: options?.sourceId,
      observedAt: options?.observedAt,
    }));
  }

  async ingest(input: {
    userId: string;
    messageId: string;
    message: string;
    assistantReply?: string;
    history: AuraCommandHistoryMessage[];
    locale?: string;
    allowDecisions?: boolean;
  }): Promise<void> {
    const locale = input.locale ?? 'pt-BR';
    const allowDecisions = input.allowDecisions === true;
    const recentWindow = input.history.slice(-4).map((item) => `${item.role}: ${item.content}`).join('\n');
    const rawContext = [recentWindow, `user: ${input.message}`, input.assistantReply ? `assistant: ${input.assistantReply}` : ''].filter(Boolean).join('\n');
    const observedAt = new Date();
    const validUntil = new Date(observedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const contextWrite = this.canonical.write({
      userId: input.userId,
      kind: 'context',
      scope: 'aura',
      canonicalKey: `aura.turn.${input.messageId}`,
      content: input.message,
      structuredValue: { recentWindow: recentWindow || null, conversationalContext: true },
      confidence: 1,
      salience: 0.45,
      locale,
      actionAuthority: 'none',
      source: 'aura',
      sourceId: input.messageId,
      observedAt,
      validUntil,
    });
    const vectorWrite = contextWrite
      .catch(() => null)
      .then((contextResult) => this.vector.store({
        userId: input.userId,
        contentType: 'aura',
        contentId: input.messageId,
        memoryId: contextResult?.memory?.id,
        content: rawContext,
        metadata: { locale, source: 'aura', actionAuthority: 'none', observedAt: observedAt.toISOString() },
        validUntil,
      }));

    const extractedWrite = (async () => {
      const extracted = await this.extractor.extract({ message: input.message, assistantReply: input.assistantReply, history: input.history, locale });
      const allowed = allowDecisions ? extracted : extracted.filter((item) => item.kind !== 'decision');
      await Promise.allSettled(allowed.map((item, index) => this.canonical.write({
        ...item,
        userId: input.userId,
        locale,
        actionAuthority: 'none',
        source: 'aura',
        sourceId: `${input.messageId}:${index}`,
        observedAt: new Date(),
      })));
    })();

    await Promise.allSettled([
      contextWrite,
      vectorWrite,
      extractedWrite,
      this.graphExtract(input.userId, input.message, input.assistantReply, { allowDecisions, locale, isVenting: !allowDecisions, sourceId: input.messageId, observedAt: new Date() }),
    ]);
  }
}

/** Production extractor intentionally delegates structured extraction to the
 * existing knowledge graph. The canonical raw context remains available even
 * when OpenAI is offline; promoted facts/patterns arrive through the KG dual-write. */
export const conservativeAuraExtractor: AuraMemoryExtractor = {
  async extract() { return []; },
};
