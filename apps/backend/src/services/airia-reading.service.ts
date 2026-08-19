import { createHash } from 'crypto';

import type { PrismaClient } from '@app/database';

import {
  inferCapacity,
  toGoalCapacity,
  toStepMinutes,
  type CapacityCorrection,
  type CapacityReading,
} from '../lib/capacity';
import { assessRiskSafety, type RiskSafety } from '../lib/risk-safety';
import { normalizeObjectiveSubgoals } from '../lib/objective-subgoals';
import { validateConcreteAction } from '../lib/action-quality';

const READING_VERSION = 1;
const SLOT_ORDER = ['morning', 'midday', 'evening'] as const;
type Slot = typeof SLOT_ORDER[number];
type AnyRow = Record<string, any>;
export type AiriaDecisionStatus = 'proposta' | 'aceita' | 'corrigida' | 'rejeitada' | 'concluída' | 'substituída';

export type AiriaReadingEnvelope = {
  version: 'v1';
  generatedAt: string;
  /** Quanto cabe hoje, inferido. `null` em leitura gravada antes desta versão. */
  capacity: Record<string, unknown> | null;
  currentState: Record<string, unknown>;
  period: Record<string, unknown>;
  alerts: Array<Record<string, unknown>>;
  riskSafety: RiskSafety;
  decision: Record<string, unknown> | null;
};

function dateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function slotOf(value: unknown): Slot {
  const base = String(value ?? '').split('-')[0];
  return SLOT_ORDER.includes(base as Slot) ? base as Slot : 'midday';
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!numbers.length) return null;
  return Number((numbers.reduce((total, value) => total + value, 0) / numbers.length).toFixed(2));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function parseRisk(value: unknown): RiskSafety | null {
  if (!value || typeof value !== 'object') return null;
  const risk = value as Record<string, unknown>;
  const riskLevel = risk.riskLevel;
  const route = risk.route;
  if (!['none', 'low', 'moderate', 'high', 'crisis'].includes(String(riskLevel))) return null;
  if (!['self_support', 'adapt_day', 'human_support', 'crisis_protocol'].includes(String(route))) return null;
  return {
    riskLevel: riskLevel as RiskSafety['riskLevel'],
    route: route as RiskSafety['route'],
    signals: Array.isArray(risk.signals) ? risk.signals.map(String) : [],
    message: typeof risk.message === 'string' ? risk.message : '',
  };
}

function stableFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function pendingObjectiveActions(objective: AnyRow | null): Array<{ id: string | null; title: string; doneWhen: string }> {
  if (!objective) return [];
  return normalizeObjectiveSubgoals(objective.subgoals)
    .filter((action) => !action.done && action.status !== 'rejected' && action.status !== 'deferred')
    .filter((action) => validateConcreteAction(action).ok)
    .map((action) => ({ id: action.id, title: action.title, doneWhen: action.doneWhen?.trim() ?? '' }))
    .filter((action) => action.doneWhen.length > 0);
}

function pendingObjectiveAction(objective: AnyRow | null, excludedActionId?: string | null): { id: string | null; title: string; doneWhen: string } | null {
  const candidates = pendingObjectiveActions(objective);
  return candidates.find((candidate) => candidate.id !== excludedActionId) ?? null;
}

/**
 * Servidor canônico para o circuito sinais → estado → padrão → capacidade /
 * segurança → proposta → feedback. A média diária só é usada como agregado
 * histórico com peso igual por dia; nunca substitui a série intradiária.
 */
export class AiriaReadingService {
  constructor(private readonly prisma: PrismaClient) {}

  async rebuild(input: { userId: string; localDate: string; periodFrom?: string; periodTo?: string; sourceCheckinId?: string | null; surface?: string }): Promise<AiriaReadingEnvelope> {
    const prisma = this.prisma as any;
    const targetDate = dateOnly(input.localDate);
    const defaultHistoryStart = new Date(targetDate);
    defaultHistoryStart.setUTCDate(defaultHistoryStart.getUTCDate() - 179);
    const requestedStart = input.periodFrom && /^\d{4}-\d{2}-\d{2}$/.test(input.periodFrom) ? dateOnly(input.periodFrom) : defaultHistoryStart;
    const requestedEnd = input.periodTo && /^\d{4}-\d{2}-\d{2}$/.test(input.periodTo) ? dateOnly(input.periodTo) : targetDate;
    const historyStart = requestedStart > targetDate ? targetDate : requestedStart;
    const periodEnd = requestedEnd > targetDate ? targetDate : requestedEnd < historyStart ? targetDate : requestedEnd;

    const [checkins, journals, objectives, patterns] = await Promise.all([
      prisma.dailyCheckin.findMany({
        where: { userId: input.userId, localDate: { gte: historyStart, lte: targetDate } },
        orderBy: [{ localDate: 'asc' }, { recordedAt: 'asc' }],
      }),
      prisma.journalSession.findMany({
        where: { userId: input.userId, localDate: { gte: historyStart, lte: targetDate } },
        select: { id: true, localDate: true, updatedAt: true, summary: true },
        orderBy: { updatedAt: 'desc' },
        take: 180,
      }),
      prisma.objective.findMany({
        where: { userId: input.userId, archived: false, pausedAt: null },
        select: { id: true, title: true, progress: true, subgoals: true, milestones: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }],
        take: 12,
      }),
      prisma.userPattern.findMany({
        where: { userId: input.userId },
        select: { id: true, pattern: true, strength: true, evidenceFactIds: true, lastConfirmedAt: true, updatedAt: true },
        orderBy: [{ strength: 'desc' }, { updatedAt: 'desc' }],
        take: 12,
      }).catch(() => []),
    ]);
    const patternFactIds = (patterns as AnyRow[]).flatMap((pattern) => Array.isArray(pattern.evidenceFactIds) ? pattern.evidenceFactIds : []);
    const patternFacts = patternFactIds.length
      ? await prisma.userFact.findMany({
          where: { userId: input.userId, id: { in: patternFactIds } },
          select: { id: true, occurredAt: true },
        }).catch(() => [])
      : [];
    const patternFactDates = new Map((patternFacts as AnyRow[]).map((fact) => [fact.id, dateKey(fact.occurredAt)]));
    const verifiedPatterns = (patterns as AnyRow[]).filter((pattern) => {
      const evidenceIds = Array.isArray(pattern.evidenceFactIds) ? pattern.evidenceFactIds : [];
      const distinctDays = new Set(evidenceIds.map((id: string) => patternFactDates.get(id)).filter(Boolean));
      return evidenceIds.length >= 3 && distinctDays.size >= 2;
    }).map((pattern) => ({ id: pattern.id, statement: pattern.pattern, strength: pattern.strength, evidenceFactIds: pattern.evidenceFactIds ?? [] }));

    const byDate = new Map<string, AnyRow[]>();
    for (const checkin of checkins as AnyRow[]) {
      const key = dateKey(checkin.localDate);
      const entries = byDate.get(key) ?? [];
      entries.push(checkin);
      byDate.set(key, entries);
    }
    const periodCheckins = (checkins as AnyRow[]).filter((entry) => {
      const day = dateOnly(dateKey(entry.localDate));
      return day >= historyStart && day <= periodEnd;
    });
    const periodByDate = new Map<string, AnyRow[]>();
    for (const checkin of periodCheckins) {
      const key = dateKey(checkin.localDate);
      const entries = periodByDate.get(key) ?? [];
      entries.push(checkin);
      periodByDate.set(key, entries);
    }
    const today = (byDate.get(input.localDate) ?? []).slice().sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
    const latest = today.at(-1) ?? null;
    const first = today[0] ?? null;
    const moodValues = today.map((entry) => numberOrNull(entry.moodScore)).filter((value): value is number => value !== null);
    const energyValues = today.map((entry) => numberOrNull(entry.energyScore)).filter((value): value is number => value !== null);
    const moodDelta = first && latest ? round(latest.moodScore - first.moodScore) : null;
    const energyDelta = first && latest ? round(latest.energyScore - first.energyScore) : null;
    const moodRange = moodValues.length ? Math.max(...moodValues) - Math.min(...moodValues) : 0;
    const energyRange = energyValues.length ? Math.max(...energyValues) - Math.min(...energyValues) : 0;
    const direction = today.length < 2
      ? 'insufficient_samples'
      : (moodRange >= 3 || energyRange >= 3) ? 'oscillating'
        : ((moodDelta ?? 0) + (energyDelta ?? 0)) >= 2 ? 'rising'
          : ((moodDelta ?? 0) + (energyDelta ?? 0)) <= -2 ? 'falling' : 'stable';

    const slotCoverage = Object.fromEntries(SLOT_ORDER.map((slot) => [slot, today.some((entry) => slotOf(entry.checkinSlot) === slot)]));
    const observedDays = [...periodByDate.values()].filter((entries) => entries.length > 0).length;
    const daysWithAllWindows = [...periodByDate.values()].filter((entries) => SLOT_ORDER.every((slot) => entries.some((entry) => slotOf(entry.checkinSlot) === slot))).length;
    const historicalDaily = [...periodByDate.entries()].map(([day, entries]) => ({
      day,
      mood: average(entries.map((entry) => numberOrNull(entry.moodScore))),
      energy: average(entries.map((entry) => numberOrNull(entry.energyScore))),
    }));
    const baselineBySlot = Object.fromEntries(SLOT_ORDER.map((slot) => {
      const entries = periodCheckins.filter((entry: AnyRow) => dateKey(entry.localDate) !== input.localDate && slotOf(entry.checkinSlot) === slot);
      return [slot, { mood: average(entries.map((entry: AnyRow) => entry.moodScore)), energy: average(entries.map((entry: AnyRow) => entry.energyScore)), samples: entries.length }];
    }));
    const coverageScore = Math.min(1, observedDays / 14) * 0.65 + Math.min(1, daysWithAllWindows / 7) * 0.35;
    const confidence = coverageScore >= 0.75 ? 'high' : coverageScore >= 0.4 ? 'medium' : coverageScore > 0 ? 'low' : 'none';
    const patternLifecycle = observedDays >= 2 && periodCheckins.length >= 3 ? (observedDays >= 7 && daysWithAllWindows >= 3 ? 'refined' : 'recurring_signal') : 'hypothesis';
    const storedRisk = latest ? parseRisk((latest.aiState as Record<string, unknown> | null)?.riskSafety) : null;
    const riskSafety = storedRisk ?? assessRiskSafety({
      text: latest?.note ?? '',
      moodScore: latest?.moodScore,
      energyScore: latest?.energyScore,
      sleepScore: latest?.sleepScore,
      irritabilityScore: latest?.irritabilityScore,
    });
    const objective = (objectives as AnyRow[]).find((candidate) => pendingObjectiveAction(candidate)) ?? (objectives as AnyRow[])[0] ?? null;
    const action = pendingObjectiveAction(objective);

    /**
     * Capacidade do dia — inferida, nunca perguntada.
     *
     * As correções anteriores entram aqui: elas calibram a inferência sem
     * virar preferência gravada. Ver `correctionBias` em `lib/capacity.ts`
     * para o contrato de quantas correções viram padrão.
     */
    const corrections = await this.recentCorrections(input.userId, input.localDate);
    const capacity = inferCapacity({
      moodScore: numberOrNull(latest?.moodScore),
      energyScore: numberOrNull(latest?.energyScore),
      phaseLabel: latest?.stateLabel ?? null,
      declaredSleepScore: numberOrNull(latest?.sleepScore),
      declaredSleepHours: numberOrNull(latest?.sleepHours),
      intradayDirection: direction,
      riskRoute: riskSafety.route,
      correction: corrections.today,
      correctionHistory: corrections.history,
      observedAt: latest?.recordedAt ?? null,
      localDate: input.localDate,
    });
    const fingerprint = stableFingerprint({
      version: READING_VERSION,
      checkins: checkins.map((entry: AnyRow) => [entry.id, entry.updatedAt?.toISOString?.() ?? String(entry.updatedAt)]),
      period: [dateKey(historyStart), dateKey(periodEnd)],
      journals: journals.map((entry: AnyRow) => [entry.id, entry.updatedAt?.toISOString?.() ?? String(entry.updatedAt)]),
      objectives: objectives.map((entry: AnyRow) => [entry.id, entry.updatedAt?.toISOString?.() ?? String(entry.updatedAt)]),
      patterns: patterns.map((entry: AnyRow) => [entry.id, entry.updatedAt?.toISOString?.() ?? String(entry.updatedAt)]),
    });
    const sourceSnapshot = {
      checkinIds: today.map((entry) => entry.id),
      journalIds: journals.filter((entry: AnyRow) => dateKey(entry.localDate) === input.localDate).map((entry: AnyRow) => entry.id),
      objectiveIds: objectives.map((entry: AnyRow) => entry.id),
      patternIds: verifiedPatterns.map((entry) => entry.id),
      sourceCheckinId: input.sourceCheckinId ?? latest?.id ?? null,
    };
    const currentState = latest ? {
      checkinId: latest.id,
      observedAt: new Date(latest.recordedAt).toISOString(),
      slot: slotOf(latest.checkinSlot),
      moodScore: latest.moodScore,
      energyScore: latest.energyScore,
      stateLabel: latest.stateLabel ?? null,
      stateSummary: latest.stateSummary ?? null,
      capacity,
    } : { observedAt: null, moodScore: null, energyScore: null, stateLabel: null, stateSummary: 'Ainda não há observação para este dia.', capacity };
    const intraday = {
      sampleCount: today.length,
      windowCoverage: slotCoverage,
      timeline: today.map((entry) => ({ id: entry.id, observedAt: new Date(entry.recordedAt).toISOString(), slot: slotOf(entry.checkinSlot), purpose: entry.checkinPurpose ?? 'window', moodScore: entry.moodScore, energyScore: entry.energyScore })),
      firstToLatest: { moodDelta, energyDelta },
      range: { mood: moodRange, energy: energyRange },
      direction,
      interpretation: today.length === 1 ? 'state_now' : today.length === 2 ? 'change_today' : 'variation_today',
    };
    const historical = {
      from: dateKey(historyStart),
      to: dateKey(periodEnd),
      windowDays: Math.floor((periodEnd.getTime() - historyStart.getTime()) / 86_400_000) + 1,
      observedDays,
      totalCheckins: periodCheckins.length,
      daysWithAllWindows,
      dailyAverage: { mood: average(historicalDaily.map((entry) => entry.mood)), energy: average(historicalDaily.map((entry) => entry.energy)) },
      baselineBySlot,
      confidence: { level: confidence, score: round(coverageScore), lifecycle: patternLifecycle },
      verifiedPatterns,
      limitations: [
        observedDays === 0 ? 'Sem observações ainda.' : null,
        daysWithAllWindows === 0 ? 'Ainda não há dia com cobertura das três janelas.' : null,
      ].filter(Boolean),
    };

    const saved = await prisma.airiaReading.upsert({
      where: { userId_localDate: { userId: input.userId, localDate: targetDate } },
      create: { userId: input.userId, localDate: targetDate, version: READING_VERSION, fingerprint, currentState, intraday, historical, riskSafety, sourceSnapshot, sourceCheckinId: input.sourceCheckinId ?? latest?.id ?? null },
      update: { version: READING_VERSION, fingerprint, currentState, intraday, historical, riskSafety, sourceSnapshot, sourceCheckinId: input.sourceCheckinId ?? latest?.id ?? null },
    });
    const decision = await this.upsertDecision({ reading: saved, objective, action, riskSafety, capacity, intraday, historical, sourceSnapshot, surface: input.surface ?? 'system' });

    /**
     * A capacidade inferida volta para o check-in que a originou.
     *
     * `signalMetadata.dayPlan` existia no contrato desde sempre e nunca era
     * preenchido: era o campo que a tela removida em `fb3d7e5` alimentava
     * perguntando. Agora quem preenche é a inferência, com `provenance`
     * dizendo isso na cara — o dado passa a existir sem a pergunta existir.
     *
     * Escrita best-effort de propósito: gravar leitura é barato, mas nenhum
     * `UPDATE` aqui pode derrubar um check-in que já foi aceito.
     */
    const targetCheckinId = input.sourceCheckinId ?? latest?.id ?? null;
    if (targetCheckinId) {
      await this.persistInferredDayPlan(targetCheckinId, capacity, objective?.id ?? null).catch(() => {});
    }

    return this.serialize(saved, decision);
  }

  /**
   * Correções que a pessoa fez sobre a capacidade proposta.
   *
   * A de hoje desloca a inferência de hoje; as anteriores só viram viés sob o
   * contrato de `correctionBias`. Falha de leitura devolve vazio: sem correção
   * a inferência continua válida, então isto nunca pode quebrar a leitura.
   */
  private async recentCorrections(userId: string, localDate: string): Promise<{ today: CapacityCorrection | null; history: CapacityCorrection[] }> {
    const prisma = this.prisma as any;
    const since = dateOnly(localDate);
    since.setUTCDate(since.getUTCDate() - 13);

    // `try/catch` em vez de `.catch()`: se o método nem existir no cliente, a
    // chamada estoura de forma síncrona e um `.catch` encadeado nunca roda.
    // Correção é calibração — sem ela a inferência continua válida, então
    // nada aqui pode derrubar a leitura do dia.
    let rows: AnyRow[] = [];
    try {
      rows = await prisma.airiaDecision.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { feedback: true, reading: { select: { localDate: true } } },
        orderBy: { createdAt: 'asc' },
        take: 60,
      }) ?? [];
    } catch {
      return { today: null, history: [] };
    }

    const history: CapacityCorrection[] = [];
    let today: CapacityCorrection | null = null;
    for (const row of rows) {
      const feedback = row.feedback && typeof row.feedback === 'object' ? row.feedback as Record<string, unknown> : null;
      const direction = feedback?.capacityCorrection;
      if (direction !== 'up' && direction !== 'down') continue;
      const day = row.reading?.localDate ? dateKey(row.reading.localDate) : null;
      if (!day) continue;
      if (day === localDate) today = { direction, localDate: day };
      else history.push({ direction, localDate: day });
    }
    return { today, history };
  }

  private async persistInferredDayPlan(checkinId: string, capacity: CapacityReading, objectiveId: string | null): Promise<void> {
    const prisma = this.prisma as any;
    const checkin = await prisma.dailyCheckin.findUnique({ where: { id: checkinId }, select: { signalMetadata: true } });
    if (!checkin) return;
    const metadata = checkin.signalMetadata && typeof checkin.signalMetadata === 'object'
      ? { ...(checkin.signalMetadata as Record<string, unknown>) }
      : {};
    const existing = metadata.dayPlan && typeof metadata.dayPlan === 'object' ? metadata.dayPlan as Record<string, unknown> : {};

    // Capacidade dita numa superfície explícita ganha da inferida. Sobrescrever
    // o que a pessoa afirmou seria a Airia discordando de um fato.
    if (existing.provenance === 'reported') return;

    metadata.dayPlan = {
      ...existing,
      capacity: toGoalCapacity(capacity.level),
      capacityLevel: capacity.level,
      capacityReason: capacity.reason.slice(0, 240),
      provenance: 'inferred',
      ...(objectiveId ? { priorityGoalId: objectiveId } : {}),
    };
    await prisma.dailyCheckin.update({ where: { id: checkinId }, data: { signalMetadata: metadata } });
  }

  async get(userId: string, localDate: string): Promise<AiriaReadingEnvelope> {
    const reading = await (this.prisma as any).airiaReading.findUnique({ where: { userId_localDate: { userId, localDate: dateOnly(localDate) } }, include: { decision: true } });
    return reading ? this.serialize(reading, reading.decision) : this.rebuild({ userId, localDate });
  }

  async feedback(input: { userId: string; decisionId: string; status: AiriaDecisionStatus; surface: string; correction?: string | null; note?: string | null; capacityCorrection?: 'up' | 'down' }): Promise<AiriaReadingEnvelope> {
    const prisma = this.prisma as any;
    const decision = await prisma.airiaDecision.findFirst({ where: { id: input.decisionId, userId: input.userId }, include: { reading: true } });
    if (!decision) throw new Error('AIRIA_DECISION_NOT_FOUND');
    const previousCapacity = (decision.reading?.currentState as Record<string, any> | null)?.capacity as CapacityReading | undefined;
    const feedback = {
      ...(decision.feedback && typeof decision.feedback === 'object' ? decision.feedback : {}),
      status: input.status,
      correction: input.correction ?? null,
      note: input.note ?? null,
      surface: input.surface,
      recordedAt: new Date().toISOString(),
      ...(input.capacityCorrection ? {
        capacityCorrection: input.capacityCorrection,
        capacityLevelBefore: previousCapacity?.level ?? null,
      } : {}),
    };
    const updated = await prisma.airiaDecision.update({
      where: { id: decision.id },
      data: { status: input.status, feedback, surface: input.surface, resolvedAt: input.status === 'proposta' ? null : new Date() },
    });
    await prisma.eventLog.create({ data: { userId: input.userId, eventName: 'airia.decision_feedback', properties: { decisionId: decision.id, readingId: decision.readingId, status: input.status, surface: input.surface, capacityCorrection: input.capacityCorrection ?? null } } }).catch(() => {});

    /**
     * Corrigir o tamanho do dia recalcula a leitura na hora e **reabre a
     * proposta** com o novo tamanho.
     *
     * A decisão volta a `proposta` de propósito: `upsertDecision` só recalcula
     * enquanto a decisão está aberta, e sem isso a pessoa apertaria "coube
     * menos" e continuaria vendo a mesma proposta do mesmo tamanho — que é a
     * definição de botão que não faz nada. O feedback fica gravado; o que
     * muda é que a Airia tem uma segunda chance de acertar o tamanho.
     */
    if (input.capacityCorrection || input.status === 'substituída') {
      if (input.capacityCorrection) {
        await prisma.airiaDecision.update({
          where: { id: decision.id },
          data: { status: 'proposta', resolvedAt: null },
        }).catch(() => {});
      }
      return this.rebuild({
        userId: input.userId,
        localDate: dateKey(decision.reading.localDate),
        surface: input.surface,
      });
    }

    return this.serialize(decision.reading, updated);
  }

  private async upsertDecision(input: { reading: AnyRow; objective: AnyRow | null; action: { id: string | null; title: string; doneWhen: string } | null; riskSafety: RiskSafety; capacity: CapacityReading; intraday: Record<string, any>; historical: Record<string, any>; sourceSnapshot: Record<string, unknown>; surface: string }): Promise<AnyRow> {
    const prisma = this.prisma as any;
    const existing = await prisma.airiaDecision.findUnique({ where: { readingId: input.reading.id } });
    const evidence = [
      ...(Array.isArray(input.sourceSnapshot.checkinIds) ? input.sourceSnapshot.checkinIds.map((id) => ({ type: 'checkin', id })) : []),
      ...(Array.isArray(input.sourceSnapshot.patternIds) ? input.sourceSnapshot.patternIds.map((id) => ({ type: 'pattern', id })) : []),
    ];
    const safetyFirst = input.riskSafety.route === 'crisis_protocol' || input.riskSafety.route === 'human_support';
    /**
     * Aqui existia a quinta fórmula de capacidade do app — risco e trajetória
     * apenas, sem olhar energia, humor ou sono. Agora é a mesma inferência de
     * `lib/capacity.ts` que todas as outras superfícies usam, então a proposta
     * do dia não pode mais discordar do que a Home e o Diário dizem sobre o
     * mesmo dia.
     */
    const capacity = input.capacity;
    const previousActionId = existing?.decision && typeof existing.decision === 'object'
      ? ((existing.decision as Record<string, any>).action?.id ?? null)
      : null;
    const action = existing?.status === 'substituída'
      ? pendingObjectiveAction(input.objective, previousActionId) ?? input.action
      : input.action;
    const lowCapacity = capacity.level === 'protecao' || capacity.level === 'baixa';
    const decision = safetyFirst
      ? { type: 'protect', title: 'Priorizar apoio humano agora', explanation: input.riskSafety.message, action: null, destination: null, anchored: true }
      : action
        ? { type: lowCapacity ? 'reduce' : 'act', title: `${action.title.replace(/[.]$/, '')}. Pronto quando: ${action.doneWhen.replace(/[.]$/, '')}.`, explanation: lowCapacity ? 'Escolhi o próximo passo concreto do seu objetivo em um tamanho menor para hoje.' : 'Este é o próximo avanço concreto já vinculado ao seu objetivo.', action: { id: action.id, title: action.title, doneWhen: action.doneWhen }, destination: { objectiveId: input.objective?.id ?? null, route: '/goals' }, anchored: true }
        : { type: 'explain', title: 'Leitura atual sem ação nova', explanation: 'A Airia ainda não tem uma ação ativa ancorada em objetivo ou intenção para propor.', action: null, destination: null, anchored: false };
    if (existing && existing.status !== 'proposta' && existing.status !== 'substituída') return existing;
    const values = { userId: input.reading.userId, objectiveId: input.objective?.id ?? null, surface: input.surface, decision, evidence, validUntil: new Date(`${dateKey(input.reading.localDate)}T23:59:59.999Z`) };
    return prisma.airiaDecision.upsert({ where: { readingId: input.reading.id }, create: { readingId: input.reading.id, status: 'proposta', feedback: {}, ...values }, update: values });
  }

  private serialize(reading: AnyRow, decision: AnyRow | null): AiriaReadingEnvelope {
    const intraday = reading.intraday as Record<string, any>;
    const historical = reading.historical as Record<string, any>;
    const current = reading.currentState as Record<string, any>;
    const riskSafety = reading.riskSafety as RiskSafety;
    const confidence = Number(historical?.confidence?.score ?? 0);
    const alerts: Array<Record<string, unknown>> = riskSafety.riskLevel === 'none'
      ? []
      : [{
          id: `risk:${reading.id}`,
          severity: riskSafety.route === 'crisis_protocol' || riskSafety.route === 'human_support' ? 'critical' : riskSafety.riskLevel === 'moderate' ? 'warning' : 'info',
          title: riskSafety.route === 'crisis_protocol' ? 'Priorizar apoio imediato' : riskSafety.route === 'human_support' ? 'Priorizar apoio humano' : 'Ajustar o ritmo do dia',
          detail: riskSafety.message,
          evidenceIds: (reading.sourceSnapshot?.checkinIds ?? []) as string[],
          route: riskSafety.route,
        }];
    const statusMap: Record<string, 'proposed' | 'accepted' | 'corrected' | 'rejected' | 'done' | 'substituted'> = {
      proposta: 'proposed', aceita: 'accepted', corrigida: 'corrected', rejeitada: 'rejected', concluída: 'done', substituída: 'substituted',
    };
    const decisionData = decision?.decision && typeof decision.decision === 'object' ? decision.decision as Record<string, any> : {};

    /**
     * A capacidade sai no envelope, não em cada tela.
     *
     * Toda superfície que já consome `useAiriaReading` herda a mesma frase sem
     * código novo — que é o ponto: a Home e o resultado do check-in não podem
     * dizer coisas diferentes sobre quanto cabe no mesmo dia.
     *
     * Leituras gravadas antes desta versão não têm o campo; `null` é resposta
     * honesta e a tela sabe não mostrar nada.
     */
    const storedCapacity = current?.capacity && typeof current.capacity === 'object'
      ? current.capacity as CapacityReading
      : null;
    const capacity = storedCapacity ? {
      level: storedCapacity.level,
      size: toGoalCapacity(storedCapacity.level),
      stepMinutes: toStepMinutes(storedCapacity.level),
      reason: storedCapacity.reason,
      basis: (storedCapacity.basis ?? []).map((item) => item.value),
      confidence: storedCapacity.confidence,
      assumed: storedCapacity.assumed,
      corrected: storedCapacity.corrected,
    } : null;

    return {
      version: 'v1',
      generatedAt: new Date(reading.updatedAt).toISOString(),
      capacity,
      currentState: {
        phase: current.stateLabel ?? null,
        confidence,
        observedAt: current.observedAt ?? null,
        moodScore: current.moodScore ?? null,
        energyScore: current.energyScore ?? null,
        intraday: {
          observations: intraday.sampleCount ?? 0,
          direction: intraday.direction ?? 'insufficient_samples',
          range: Math.max(Number(intraday.range?.mood ?? 0), Number(intraday.range?.energy ?? 0)),
          oscillation: intraday.interpretation ?? 'state_now',
        },
      },
      period: {
        from: historical.from ?? dateKey(new Date(new Date(reading.localDate).getTime() - 179 * 86_400_000)),
        to: historical.to ?? dateKey(reading.localDate),
        observedDays: historical.observedDays ?? 0,
        windowDays: historical.windowDays ?? 180,
        coverage: historical.daysWithAllWindows ?? 0,
        confidence,
      },
      alerts,
      riskSafety,
      decision: decision ? {
        id: decision.id,
        status: statusMap[decision.status] ?? 'proposed',
        title: decisionData.title ?? 'Leitura atual',
        reason: decisionData.explanation ?? '',
        objectiveId: decision.objectiveId ?? decisionData.destination?.objectiveId ?? null,
        actionId: decisionData.action?.id ?? null,
        evidenceIds: Array.isArray(decision.evidence) ? decision.evidence.map((item: any) => item?.id).filter(Boolean) : [],
        requiresConfirmation: decision.status === 'proposta',
      } : null,
    };
  }
}
