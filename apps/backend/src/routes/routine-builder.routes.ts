import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';

import {
  RoutineClarificationAnswersSchema,
  RoutineCreateSessionSchema,
  RoutineUpdateItemsSchema,
} from '../contracts/routine-builder.contract';
import { RoutineClassifierError } from '../services/routine-classifier.service';
import { RoutineSourceError } from '../services/routine-source-extractor.service';
import type { RoutineBuilderService } from '../services/routine-builder.service';

type RoutineBuilderRouteDependencies = {
  service: Pick<RoutineBuilderService,
    'createSession' | 'getSession' | 'ingestSource' | 'updateItems' | 'answerClarifications' | 'compose' | 'apply'>;
};

const TextSourceSchema = z.object({
  sourceType: z.enum(['text', 'transcript']).default('text'),
  text: z.string().trim().min(1).max(100_000),
});

const SUPPORTED_RAW_MIMES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function userId(req: Request): string {
  const value = (req as Request & { userId?: string }).userId;
  if (!value) throw new Error('unauthorized');
  return value;
}

function errorStatus(error: Error): number {
  if (error.message === 'unauthorized') return 401;
  if (error.message === 'routine_session_not_found') return 404;
  if (error.message.includes('not_ready') || error.message.includes('locked') || error.message.includes('conflict') || error.message.includes('not_waiting')) return 409;
  if (error.message.includes('clarification_answer') || error.message.includes('question_not_found')) return 400;
  if (error instanceof RoutineSourceError) return 400;
  if (error instanceof RoutineClassifierError) return error.code === 'model_unavailable' ? 503 : 422;
  return 500;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'validation_failed',
      message: 'Revise os campos indicados.',
      details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }
  const resolved = error instanceof Error ? error : new Error('routine_builder_failed');
  const status = errorStatus(resolved);
  res.status(status).json({
    error: status === 500 ? 'routine_builder_failed' : resolved.message.split(':')[0],
    message: status === 500 ? 'Não foi possível concluir esta etapa agora.' : resolved.message,
  });
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, _next: NextFunction): void => {
    void handler(req, res).catch((error) => sendError(res, error));
  };
}

function createHeavyOperationLimiter() {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req as Request & { userId?: string }).userId ?? req.ip ?? 'unknown';
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }
    current.count += 1;
    if (current.count > 12) {
      res.status(429).json({ error: 'rate_limited', message: 'Aguarde um instante antes de tentar novamente.' });
      return;
    }
    next();
  };
}

export function createRoutineBuilderRouter(dependencies: RoutineBuilderRouteDependencies): express.Router {
  const router = express.Router();
  const heavyOperationLimiter = createHeavyOperationLimiter();
  const rawSourceParser = express.raw({ type: SUPPORTED_RAW_MIMES, limit: '10mb' });

  router.post('/sessions', asyncRoute(async (req, res) => {
    const input = RoutineCreateSessionSchema.parse(req.body);
    const session = await dependencies.service.createSession(userId(req), input);
    res.status(201).json(session);
  }));

  router.get('/sessions/:sessionId', asyncRoute(async (req, res) => {
    res.json(await dependencies.service.getSession(userId(req), req.params.sessionId));
  }));

  router.post('/sessions/:sessionId/source', heavyOperationLimiter, rawSourceParser, asyncRoute(async (req, res) => {
    const currentUserId = userId(req);
    if (Buffer.isBuffer(req.body)) {
      const mimeType = String(req.headers['content-type'] ?? '').split(';')[0].trim();
      const fileNameHeader = req.headers['x-file-name'];
      const fileName = Array.isArray(fileNameHeader) ? fileNameHeader[0] : fileNameHeader;
      const session = await dependencies.service.ingestSource({
        userId: currentUserId,
        sessionId: req.params.sessionId,
        buffer: req.body,
        mimeType,
        fileName: fileName ? decodeURIComponent(fileName) : null,
        sourceType: 'file',
      });
      res.json(session);
      return;
    }
    const source = TextSourceSchema.parse(req.body);
    const session = await dependencies.service.ingestSource({
      userId: currentUserId,
      sessionId: req.params.sessionId,
      buffer: Buffer.from(source.text, 'utf8'),
      mimeType: 'text/plain',
      sourceType: source.sourceType,
    });
    res.json(session);
  }));

  router.patch('/sessions/:sessionId/items', asyncRoute(async (req, res) => {
    const input = RoutineUpdateItemsSchema.parse(req.body);
    res.json(await dependencies.service.updateItems({
      userId: userId(req),
      sessionId: req.params.sessionId,
      items: input.items,
    }));
  }));

  router.post('/sessions/:sessionId/clarifications', asyncRoute(async (req, res) => {
    const input = RoutineClarificationAnswersSchema.parse(req.body);
    res.json(await dependencies.service.answerClarifications({
      userId: userId(req),
      sessionId: req.params.sessionId,
      answers: input.answers,
    }));
  }));

  router.post('/sessions/:sessionId/compose', heavyOperationLimiter, asyncRoute(async (req, res) => {
    res.json(await dependencies.service.compose(userId(req), req.params.sessionId));
  }));

  router.post('/sessions/:sessionId/apply', asyncRoute(async (req, res) => {
    res.json(await dependencies.service.apply(userId(req), req.params.sessionId));
  }));

  return router;
}
