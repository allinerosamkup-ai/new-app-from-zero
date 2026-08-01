import type { CheckinEntry, MoodOption } from './types';

function normalize(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    : '';
}

export function resolveMoodFromCheckin(
  checkin: Partial<CheckinEntry> | null | undefined,
  fallback: MoodOption,
): MoodOption {
  if (!checkin) return fallback;

  const stateType = normalize(checkin.stateLabelType ?? checkin.emotion);
  if (/sensiv|delicat/.test(stateType)) return 'sensivel';
  if (/cansad|exaust|tired|deplet/.test(stateType)) return 'cansada';
  if (/sobrecarr|agitad|irritad|overload/.test(stateType)) return 'sobrecarregada';
  if (/tens|ansios|anxious/.test(stateType)) return 'tensa';
  if (/focad|radiante|elevated|focused/.test(stateType)) return 'focada';
  if (/equilibr|calm|stable/.test(stateType)) return 'equilibrada';

  const emotions = (checkin.emotions ?? []).map(normalize);
  if (emotions.some((emotion) => /sad|trist|sensiv/.test(emotion))) return 'sensivel';
  if (emotions.some((emotion) => /tired|cansad|exaust/.test(emotion))) return 'cansada';
  if (emotions.some((emotion) => /angry|irritad|agitad/.test(emotion))) return 'sobrecarregada';
  if (emotions.some((emotion) => /anxious|ansios|tens/.test(emotion))) return 'tensa';

  const mood = Number(checkin.humor);
  const energy = Number(checkin.energia);
  if (Number.isFinite(mood) && mood <= 3) return 'sensivel';
  if (Number.isFinite(energy) && energy <= 3) return 'cansada';
  if (Number.isFinite(mood) && Number.isFinite(energy) && mood >= 8 && energy >= 7) return 'focada';
  if (Number.isFinite(mood) && Number.isFinite(energy)) return 'equilibrada';

  return fallback;
}
