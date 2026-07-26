import type { RoutineCapacity } from '../services/routine-composer.service';

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Estado informado na hora, quando não há check-in salvo.
 *
 * Quem acabou de montar a rotina ainda não tem histórico: sem isso, a semana
 * de alguém que declarou energia 2 sairia igual à de quem declarou 9.
 */
export type DeclaredState = {
  mood: number;
  energy: number;
  focus: number;
};

function fromDeclaredState(state: DeclaredState): RoutineCapacity {
  const { energy, mood, focus } = state;

  if (energy <= 3 || mood <= 3) {
    return {
      level: 'low',
      reason: `Você disse que hoje está com energia ${energy} e humor ${mood} de 10; a primeira semana começa menor pra caber de verdade.`,
    };
  }

  if (energy >= 8 && mood >= 6 && focus >= 6) {
    return {
      level: 'high',
      reason: `Você disse que hoje está com energia ${energy} de 10; a semana aproveita isso sem abrir mais frentes do que você escolheu.`,
    };
  }

  return {
    level: 'balanced',
    reason: `Você disse que hoje está com energia ${energy} e humor ${mood} de 10; a semana mantém carga sustentável.`,
  };
}

export function deriveRoutineCapacity(input: {
  phaseLabel?: string | null;
  energyScore?: number | null;
  recordedAt?: Date | string | null;
  /** Respostas do onboarding guiado. Só valem quando não há check-in recente. */
  declaredState?: DeclaredState | null;
  now?: Date;
}): RoutineCapacity {
  const now = input.now ?? new Date();
  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : null;
  const isRecent = Boolean(
    recordedAt
    && Number.isFinite(recordedAt.getTime())
    && now.getTime() - recordedAt.getTime() <= 72 * 60 * 60 * 1000,
  );

  if (!isRecent) {
    // Check-in salvo tem precedência; na ausência dele, vale o que ela acabou de dizer.
    if (input.declaredState) return fromDeclaredState(input.declaredState);
    return { level: 'balanced', reason: 'Sem check-in recente: a carga foi mantida moderada e reversível.' };
  }

  const phase = normalize(input.phaseLabel);
  const energy = typeof input.energyScore === 'number' ? input.energyScore : null;
  if (energy != null && energy <= 3) {
    return {
      level: 'low',
      reason: `O check-in mais recente mostra energia ${energy} de 10; a rotina foi reduzida sem abandonar o que importa.`,
    };
  }

  if (/\b(desacelerando|recolhimento|pausa|turbulencia)\b/.test(phase)) {
    return {
      level: 'low',
      reason: `O estado mais recente está em ${input.phaseLabel}; a semana protege carga e mantém passos menores.`,
    };
  }

  if (/\b(voo alto|fluindo)\b/.test(phase)) {
    return {
      level: 'high',
      reason: `O estado mais recente está em ${input.phaseLabel}; a rotina aproveita a energia sem abrir frentes além das revisadas.`,
    };
  }

  if (/\b(estavel|retomada)\b/.test(phase)) {
    return {
      level: 'balanced',
      reason: `O estado mais recente está em ${input.phaseLabel}; a rotina mantém avanço com carga sustentável.`,
    };
  }

  if (energy != null && energy >= 8) {
    return {
      level: 'high',
      reason: `O check-in mais recente mostra energia ${energy} de 10, sem abrir frentes além das revisadas.`,
    };
  }

  return {
    level: 'balanced',
    reason: energy != null
      ? `O check-in mais recente mostra energia ${energy} de 10; a rotina mantém carga moderada.`
      : 'O check-in recente não trouxe energia suficiente para ampliar a carga; a rotina permanece moderada.',
  };
}
