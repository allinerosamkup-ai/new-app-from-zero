import { z } from 'zod';

/**
 * Schemas usados como structured output da OpenAI ao extrair entidades, fatos,
 * padrões e decisões abertas de uma mensagem do diário/check-in. O service
 * usa estes schemas pra parse seguro do retorno.
 */

export const ExtractedEntitySchema = z.object({
  canonicalName: z.string().min(1).max(120),
  aliases: z.array(z.string().min(1).max(60)).max(8).default([]),
  type: z.enum(['person', 'project', 'event', 'object', 'place', 'habit']),
  status: z.enum(['active', 'resolved', 'paused', 'abandoned']).nullable().optional(),
});

export const ExtractedFactSchema = z.object({
  entityCanonicalName: z.string().min(1).max(120).nullable().optional(),
  statement: z.string().min(5).max(500),
  /** ISO-8601 ou null se desconhecido (service vai usar agora) */
  occurredAt: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const ExtractedPatternSchema = z.object({
  pattern: z.string().min(8).max(280),
  evidenceFactStatements: z.array(z.string()).max(5).default([]),
});

export const ExtractedDecisionSchema = z.object({
  question: z.string().min(5).max(280),
  context: z.string().max(500).nullable().optional(),
});

export const KnowledgeGraphExtractionSchema = z.object({
  entities: z.array(ExtractedEntitySchema).max(10).default([]),
  facts: z.array(ExtractedFactSchema).max(10).default([]),
  patterns: z.array(ExtractedPatternSchema).max(5).default([]),
  decisions: z.array(ExtractedDecisionSchema).max(5).default([]),
});

export type KnowledgeGraphExtraction = z.infer<typeof KnowledgeGraphExtractionSchema>;
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
export type ExtractedPattern = z.infer<typeof ExtractedPatternSchema>;
export type ExtractedDecision = z.infer<typeof ExtractedDecisionSchema>;
