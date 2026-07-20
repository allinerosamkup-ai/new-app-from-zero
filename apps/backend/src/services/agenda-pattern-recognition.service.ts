import { addDays } from 'date-fns';
import { CanonicalMemoryService } from './canonical-memory.service';

export type AgendaDayProfile = 'day' | 'night' | 'mixed' | 'unknown';
type AgendaBlockObservation = {
  id: string; localDate: Date; startAt: Date; endAt: Date; status?: string; gcalEventId?: string | null;
  temporalPolicy?: string | null; adaptationPermission?: string | null; recurring?: unknown;
};
type AgendaEventObservation = { eventName?: string; createdAt?: Date; properties?: unknown };

export type AgendaStylePattern = {
  version: 1;
  windowDays: 42;
  confirmed: boolean;
  confidence: number;
  freedomScore: number;
  dayProfile: AgendaDayProfile;
  protectedRatio: number;
  importedRatio: number;
  recurringRatio: number;
  scheduleVarianceMinutes: number;
  postponeRate: number;
  snoozeRate: number;
  completionRate: number;
  observedDays: number;
  sampleSize: number;
  stableWindowsByWeekday: Record<string, Array<{ startMinute: number; endMinute: number; samples: number }>>;
  freedomByWeekday: Record<string, number>;
  evidenceDates: string[];
  inferenceSource: 'observed' | 'explicit' | 'mixed' | 'unknown';
};

type ExplicitAgendaSignal = { source: string; text: string };

function ratio(value: number, total: number): number { return total > 0 ? Math.round(Math.max(0, Math.min(1, value / total)) * 1000) / 1000 : 0; }
function dateKey(value: Date): string { return value.toISOString().slice(0, 10); }
function minuteOfDay(value: Date): number { return value.getUTCHours() * 60 + value.getUTCMinutes(); }
function durationMinutes(block: AgendaBlockObservation): number {
  const raw = Math.round((block.endAt.getTime() - block.startAt.getTime()) / 60_000);
  return Math.max(0, Math.min(24 * 60, raw));
}
function recurringEnabled(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as any).enabled === true);
}
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length));
}

function analyzeExplicitSignals(signals: ExplicitAgendaSignal[]): { profile: AgendaDayProfile; freedom: number; confidence: number; sourceCount: number } {
  const useful = signals.filter((signal) => /\b(rotina|agenda|schedule|routine|work|trabalh\w*|shift|turno|horario|horário|autonom\w*|self-employed|free|livre|segunda|sexta|monday|friday|\d{1,2}h|\d{1,2}\s*(?:am|pm))\b/i.test(signal.text));
  const sources = new Set(useful.map((signal) => signal.source));
  const hours = useful.flatMap((signal) => {
    const twentyFour = [...signal.text.matchAll(/\b([01]?\d|2[0-3])h(?:\d{2})?\b/gi)].map((match) => Number(match[1]));
    const twelve = [...signal.text.matchAll(/\b(1[0-2]|0?\d)(?::\d{2})?\s*(am|pm)\b/gi)].map((match) => {
      const hour = Number(match[1]) % 12;
      return match[2].toLowerCase() === 'pm' ? hour + 12 : hour;
    });
    return [...twentyFour, ...twelve];
  });
  const dayHours = hours.filter((hour) => hour >= 6 && hour < 18).length;
  const profile: AgendaDayProfile = hours.length === 0 ? 'unknown'
    : dayHours / hours.length >= 0.7 ? 'day'
      : (hours.length - dayHours) / hours.length >= 0.7 ? 'night' : 'mixed';
  const rigid = useful.filter((signal) => /\b(das?\s+\d{1,2}h|turno|shift|fixed schedule|horario fixo|horário fixo|segunda a sexta|monday to friday)\b/i.test(signal.text)).length;
  const free = useful.filter((signal) => /\b(agenda livre|free schedule|flexible schedule|horario livre|horário livre|autonom\w*|self-employed)\b/i.test(signal.text)).length;
  const freedom = free > rigid ? 0.8 : rigid > 0 ? 0.25 : 0.5;
  return { profile, freedom, confidence: Math.min(0.75, 0.35 + sources.size * 0.18), sourceCount: sources.size };
}

export function analyzeAgendaPattern(input: { blocks: AgendaBlockObservation[]; events: AgendaEventObservation[]; explicitSignals?: ExplicitAgendaSignal[] }): AgendaStylePattern {
  const blocks = input.blocks.filter((block) => block.status !== 'deleted' && block.endAt > block.startAt);
  const explicit = analyzeExplicitSignals(input.explicitSignals ?? []);
  const dates = [...new Set(blocks.map((block) => dateKey(block.localDate)))].sort();
  const starts = blocks.map((block) => minuteOfDay(block.startAt));
  const dayStarts = starts.filter((minute) => minute >= 6 * 60 && minute < 18 * 60).length;
  const nightStarts = starts.length - dayStarts;
  const observedProfile: AgendaDayProfile = starts.length === 0 ? 'unknown'
    : ratio(dayStarts, starts.length) >= 0.7 ? 'day'
      : ratio(nightStarts, starts.length) >= 0.7 ? 'night' : 'mixed';

  const scheduledByDate = new Map<string, number>();
  for (const block of blocks) scheduledByDate.set(dateKey(block.localDate), Math.min(720, (scheduledByDate.get(dateKey(block.localDate)) ?? 0) + durationMinutes(block)));
  const observedFreedom = scheduledByDate.size > 0
    ? [...scheduledByDate.values()].reduce((sum, minutes) => sum + Math.max(0, 1 - minutes / 720), 0) / scheduledByDate.size
    : 0.5;
  // Missing days are unknown, not evidence of freedom.
  const hasObserved = blocks.length > 0;
  const hasExplicit = explicit.sourceCount > 0;
  const freedomScore = Math.round(Math.max(0.05, Math.min(0.95,
    hasObserved && hasExplicit ? observedFreedom * 0.8 + explicit.freedom * 0.2
      : hasObserved ? observedFreedom : explicit.freedom,
  )) * 1000) / 1000;
  const dayProfile = observedProfile !== 'unknown' ? observedProfile : explicit.profile;

  const byWeekday = new Map<number, AgendaBlockObservation[]>();
  for (const block of blocks) {
    const weekday = block.localDate.getUTCDay();
    byWeekday.set(weekday, [...(byWeekday.get(weekday) ?? []), block]);
  }
  const stableWindowsByWeekday: AgendaStylePattern['stableWindowsByWeekday'] = {};
  const freedomByWeekday: Record<string, number> = {};
  for (const [weekday, items] of byWeekday) {
    const startMinutes = items.map((item) => minuteOfDay(item.startAt)).sort((a, b) => a - b);
    const durations = items.map(durationMinutes).sort((a, b) => a - b);
    const medianStart = startMinutes[Math.floor(startMinutes.length / 2)];
    const medianDuration = durations[Math.floor(durations.length / 2)];
    const distinctWeeks = new Set(items.map((item) => {
      const date = new Date(item.localDate);
      const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      return `${date.getUTCFullYear()}-${Math.floor((date.getTime() - first.getTime()) / (7 * 86_400_000))}`;
    })).size;
    if (items.length >= 3 && distinctWeeks >= 3 && standardDeviation(startMinutes) <= 120) {
      stableWindowsByWeekday[String(weekday)] = [{ startMinute: medianStart, endMinute: (medianStart + medianDuration) % (24 * 60), samples: items.length }];
    }
    const dayMinutes = items.reduce((sum, item) => sum + durationMinutes(item), 0) / new Set(items.map((item) => dateKey(item.localDate))).size;
    freedomByWeekday[String(weekday)] = Math.round(Math.max(0.05, 1 - Math.min(720, dayMinutes) / 720) * 1000) / 1000;
  }

  const eventTarget = (event: AgendaEventObservation) => {
    const props = event.properties && typeof event.properties === 'object' ? event.properties as any : {};
    return String(props.blockId ?? props.targetId ?? props.title ?? '');
  };
  const postponed = new Set(input.events.filter((event) => (event.eventName ?? '').includes('postpon')).map(eventTarget).filter(Boolean)).size;
  const snoozed = new Set(input.events.filter((event) => (event.eventName ?? '').includes('snooze')).map(eventTarget).filter(Boolean)).size;
  const completedTargets = new Set([
    ...blocks.filter((block) => block.status === 'completed').map((block) => block.id),
    ...input.events.filter((event) => (event.eventName ?? '').includes('completed')).map(eventTarget).filter(Boolean),
  ]);
  const targetCount = Math.max(1, new Set(blocks.map((block) => block.id)).size);
  const stableWeekdays = Object.keys(stableWindowsByWeekday).length;
  const observedConfidence = Math.round(Math.min(0.95,
    Math.min(1, dates.length / 14) * 0.55
    + Math.min(1, blocks.length / 20) * 0.25
    + Math.min(1, stableWeekdays / Math.max(1, byWeekday.size)) * 0.2,
  ) * 1000) / 1000;
  const confidence = hasObserved && hasExplicit
    ? Math.round(Math.min(0.95, observedConfidence * 0.8 + explicit.confidence * 0.2) * 1000) / 1000
    : hasObserved ? observedConfidence : explicit.confidence;
  const inferenceSource = hasObserved && hasExplicit ? 'mixed' : hasObserved ? 'observed' : hasExplicit ? 'explicit' : 'unknown';

  return {
    version: 1,
    windowDays: 42,
    confirmed: (blocks.length >= 20 && dates.length >= 14 && observedConfidence >= 0.65)
      || (!hasObserved && explicit.sourceCount >= 2 && explicit.confidence >= 0.65),
    confidence,
    freedomScore,
    dayProfile,
    protectedRatio: ratio(blocks.filter((b) => b.temporalPolicy === 'fixed' || b.adaptationPermission === 'protected').length, blocks.length),
    importedRatio: ratio(blocks.filter((b) => Boolean(b.gcalEventId)).length, blocks.length),
    recurringRatio: ratio(blocks.filter((b) => recurringEnabled(b.recurring)).length, blocks.length),
    scheduleVarianceMinutes: standardDeviation(starts),
    postponeRate: ratio(postponed, targetCount),
    snoozeRate: ratio(snoozed, targetCount),
    completionRate: ratio(completedTargets.size, targetCount),
    observedDays: dates.length,
    sampleSize: blocks.length,
    stableWindowsByWeekday,
    freedomByWeekday,
    evidenceDates: dates,
    inferenceSource,
  };
}

export class AgendaPatternRecognitionService {
  private readonly canonical: CanonicalMemoryService;
  private readonly cache = new Map<string, { at: number; pattern: AgendaStylePattern | null }>();
  constructor(private readonly prisma: any, canonical?: CanonicalMemoryService, private readonly clock: () => number = Date.now) {
    this.canonical = canonical ?? new CanonicalMemoryService(prisma);
  }

  async recognize(userId: string, now = new Date(), locale = 'pt-BR'): Promise<AgendaStylePattern | null> {
    const cacheKey = `${userId}:${locale}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.clock() - cached.at < 12 * 60 * 60 * 1000) return cached.pattern;
    const since = addDays(now, -42);
    const [blocks, events, onboarding, narrativeMemories] = await Promise.all([
      this.prisma.timelineBlock?.findMany?.({
        where: { userId, localDate: { gte: since, lte: now } },
        orderBy: { localDate: 'asc' },
        select: { id: true, localDate: true, startAt: true, endAt: true, status: true, gcalEventId: true, temporalPolicy: true, adaptationPermission: true, recurring: true },
      }).catch(() => []) ?? [],
      this.prisma.eventLog?.findMany?.({
        where: { userId, createdAt: { gte: since }, eventName: { in: ['timeline.block_postponed', 'timeline.block_snoozed', 'timeline.block_completed', 'ai.action_feedback'] } },
        orderBy: { createdAt: 'asc' },
        select: { eventName: true, createdAt: true, properties: true },
      }).catch(() => []) ?? [],
      this.prisma.onboardingResponse?.findUnique?.({ where: { userId }, select: { routineText: true, routineSummary: true, aiRoutineSummary: true } }).catch(() => null) ?? null,
      this.prisma.userMemory?.findMany?.({
        where: { userId, lifecycle: 'active', OR: [
          { scope: { startsWith: 'agenda' } }, { scope: { startsWith: 'work' } }, { scope: { startsWith: 'routine' } },
        ] },
        take: 20,
      }).catch(() => []) ?? [],
    ]);
    const onboardingRoutine = [...new Set([onboarding?.routineText, onboarding?.routineSummary, onboarding?.aiRoutineSummary].filter(Boolean))].join('\n');
    const explicitSignals: ExplicitAgendaSignal[] = [
      onboardingRoutine ? { source: 'onboarding', text: onboardingRoutine } : null,
      ...narrativeMemories.map((memory: any) => ({ source: `memory:${memory.id}`, text: String(memory.content ?? '') })),
    ].filter((signal): signal is ExplicitAgendaSignal => Boolean(signal?.text));
    const pattern = analyzeAgendaPattern({ blocks, events, explicitSignals });
    this.cache.set(cacheKey, { at: this.clock(), pattern });
    const provenance = {
      timelineBlockIds: blocks.map((block: any) => block.id),
      eventCount: events.length,
      onboardingRoutineAvailable: Boolean(onboarding?.routineText || onboarding?.routineSummary || onboarding?.aiRoutineSummary),
      narrativeMemoryIds: narrativeMemories.map((memory: any) => memory.id),
      explicitSignalSources: explicitSignals.map((signal) => signal.source),
      observedFrom: since.toISOString(), observedUntil: now.toISOString(),
    };
    if (pattern.confirmed) void (async () => {
      const evidenceDates = pattern.evidenceDates.length >= 3
        ? [pattern.evidenceDates[0], pattern.evidenceDates[Math.floor(pattern.evidenceDates.length / 2)], pattern.evidenceDates.at(-1)!]
        : pattern.evidenceDates;
      const persistenceEvidence = pattern.inferenceSource === 'explicit'
        ? [{ observedDate: dateKey(now), sourceId: explicitSignals.map((signal) => signal.source).sort().join('|'), inferred: false }]
        : evidenceDates.map((observedDate, index) => ({ observedDate, sourceId: `agenda-style:${observedDate}:${index}`, inferred: true }));
      for (const { observedDate, sourceId, inferred } of persistenceEvidence) {
        const localizedProfile = locale.toLowerCase().startsWith('en')
          ? ({ day: 'daytime', night: 'nighttime', mixed: 'mixed', unknown: 'unknown' } as const)[pattern.dayProfile]
          : ({ day: 'diurna', night: 'noturna', mixed: 'mista', unknown: 'indefinida' } as const)[pattern.dayProfile];
        await this.canonical.write({
          userId, kind: 'pattern', scope: 'agenda', canonicalKey: 'agenda.style.current',
          content: locale.toLowerCase().startsWith('en')
            ? `${localizedProfile} schedule; ${Math.round(pattern.freedomScore * 100)}% freedom; ${Math.round(pattern.confidence * 100)}% confidence.`
            : `Agenda ${localizedProfile}; liberdade ${Math.round(pattern.freedomScore * 100)}%; confiança ${Math.round(pattern.confidence * 100)}%.`,
          structuredValue: { ...pattern, provenance }, confidence: pattern.confidence, salience: 0.9,
          locale, actionAuthority: 'none', source: 'agenda_pattern', sourceId,
          observedAt: new Date(`${observedDate}T12:00:00.000Z`), metrics: { sampleSize: pattern.sampleSize, observedDays: pattern.observedDays },
          inferred, validUntil: addDays(now, 14),
        });
      }
    })().catch((error) => console.warn('[agenda-pattern/persist]', error));
    return pattern;
  }
}
