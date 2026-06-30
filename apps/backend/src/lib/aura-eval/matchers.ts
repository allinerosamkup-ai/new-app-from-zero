import type { AuraEvalExpects } from './cases';

/**
 * Pure deterministic matchers used to score Aura responses against
 * AuraEvalExpects. No I/O. Returns a list of failure messages — empty
 * means the response passed all invariants for the case.
 */

const SENTENCE_TERMINATOR = /[.!?…]+\s+|[.!?…]+$/;
const QUESTION_AT_END = /\?\s*$/;
const CALL_TO_ACTION_HINT =
  /(\b(me\s+conta|me\s+diz|conta|diz|escolhe|topa|topas|topar|começa|comeca|prefere|qual|quando|onde|posso\s+\w+\?|quer\s+que))/i;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const parts = trimmed
    .split(SENTENCE_TERMINATOR)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length || 1;
}

function endsWithQuestion(text: string): boolean {
  const trimmed = text.trim();
  return QUESTION_AT_END.test(trimmed);
}

function endsWithCallToAction(text: string): boolean {
  const trimmed = text.trim();
  const lastSentence = trimmed.split(SENTENCE_TERMINATOR).filter(Boolean).pop() ?? trimmed;
  return CALL_TO_ACTION_HINT.test(lastSentence);
}

export type EvalFailure = {
  invariant: string;
  message: string;
};

export function evaluateResponse(
  response: string,
  expects: AuraEvalExpects,
): EvalFailure[] {
  const failures: EvalFailure[] = [];
  const normalized = normalize(response);

  if (expects.mustInclude) {
    for (const phrase of expects.mustInclude) {
      if (!normalized.includes(normalize(phrase))) {
        failures.push({
          invariant: 'mustInclude',
          message: `expected response to include "${phrase}"`,
        });
      }
    }
  }

  if (expects.mustNotInclude) {
    for (const phrase of expects.mustNotInclude) {
      if (normalized.includes(normalize(phrase))) {
        failures.push({
          invariant: 'mustNotInclude',
          message: `response contained forbidden phrase "${phrase}"`,
        });
      }
    }
  }

  if (expects.mustNotEndWithQuestion && endsWithQuestion(response)) {
    failures.push({
      invariant: 'mustNotEndWithQuestion',
      message: 'response ended with a question (forbidden for this domain)',
    });
  }

  if (expects.mustEndWithQuestionOrCallToAction) {
    if (!endsWithQuestion(response) && !endsWithCallToAction(response)) {
      failures.push({
        invariant: 'mustEndWithQuestionOrCallToAction',
        message: 'response did not end with a question or call to action',
      });
    }
  }

  const sentenceCount = countSentences(response);
  if (expects.maxSentences && sentenceCount > expects.maxSentences) {
    failures.push({
      invariant: 'maxSentences',
      message: `response had ${sentenceCount} sentences, max ${expects.maxSentences}`,
    });
  }
  if (expects.minSentences && sentenceCount < expects.minSentences) {
    failures.push({
      invariant: 'minSentences',
      message: `response had ${sentenceCount} sentences, min ${expects.minSentences}`,
    });
  }

  if (expects.mustReferenceAnchorFromContext) {
    const found = expects.mustReferenceAnchorFromContext.some((anchor) =>
      normalized.includes(normalize(anchor)),
    );
    if (!found) {
      failures.push({
        invariant: 'mustReferenceAnchorFromContext',
        message: `response did not reference any anchor: ${JSON.stringify(
          expects.mustReferenceAnchorFromContext,
        )}`,
      });
    }
  }

  return failures;
}
