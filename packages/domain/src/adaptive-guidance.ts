export type AdaptiveSupportMode =
  | "recovery"
  | "regulation"
  | "steady"
  | "momentum"
  | "protection";

export type AdaptiveGuidance = {
  mode: AdaptiveSupportMode;
  title: string;
  summary: string;
  frictionBudget: "minimal" | "light" | "normal";
  primaryAction: string;
  anchors: string[];
};

export type GentleGamificationSnapshot = {
  streakDays: number;
  consistencyScore: number;
  recoveryPoints: number;
  celebrationLevel: "quiet" | "warm" | "spark";
  missionTitle: string;
  missionReason: string;
  badges: Array<{ id: string; label: string; tone: "soft" | "focus" | "care" }>;
};

type SupportInput = {
  mood?: string | null;
  moodLabelType?: string | null;
  energyScore?: number | null;
  autonomousState?: "stable" | "rising" | "falling" | "alert" | null;
};

type GamificationInput = {
  hadCheckinToday: boolean;
  checkinDates: string[];
  tasksDoneToday: number;
  tasksTotalToday: number;
  supportMode: AdaptiveSupportMode;
};

function normalizeTag(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function resolveAdaptiveGuidance(input: SupportInput): AdaptiveGuidance {
  const mood = normalizeTag(input.mood);
  const moodLabelType = normalizeTag(input.moodLabelType);
  const energy = input.energyScore ?? 3;
  const autonomousState = input.autonomousState ?? null;

  if (
    autonomousState === "alert" ||
    mood === "sobrecarregada" ||
    moodLabelType === "critico" ||
    moodLabelType === "crítico"
  ) {
    return {
      mode: "protection",
      title: "Modo protecao",
      summary: "Hoje o app deve reduzir carga, conter excesso e proteger seu corpo antes de qualquer meta.",
      frictionBudget: "minimal",
      primaryAction: "Escolher so uma tarefa essencial e abrir espaco para pausa real.",
      anchors: [
        "Suspender o que nao for essencial",
        "Proteger sono, comida e agua primeiro",
        "Evitar decisoes impulsivas hoje",
      ],
    };
  }

  if (
    autonomousState === "falling" ||
    mood === "cansada" ||
    energy <= 2
  ) {
    return {
      mode: "recovery",
      title: "Modo recuperacao",
      summary: "A meta do dia nao e render muito. E retomar movimento com o menor atrito possivel.",
      frictionBudget: "minimal",
      primaryAction: "Fazer um micro-passo concreto que leve menos de 10 minutos.",
      anchors: [
        "Uma acao minima vale como vitoria",
        "Autocuidado basico vem antes da produtividade",
        "Nao abrir lista grande de tarefas",
      ],
    };
  }

  if (
    autonomousState === "rising" ||
    mood === "tensa" ||
    mood === "sensivel" ||
    moodLabelType === "sensivel" ||
    moodLabelType === "sensível"
  ) {
    return {
      mode: "regulation",
      title: "Modo regulacao",
      summary: "Hoje vale conter ritmo, proteger foco e evitar excesso de estimulo.",
      frictionBudget: "light",
      primaryAction: "Trocar pressa por blocos curtos com pausas e menos variacao.",
      anchors: [
        "Diminuir numero de frentes abertas",
        "Criar pausas antes de reagir ou decidir",
        "Manter rotina simples e repetivel",
      ],
    };
  }

  if (mood === "focada" && energy >= 4) {
    return {
      mode: "momentum",
      title: "Modo impulso util",
      summary: "Existe janela boa para avancar, desde que a estrutura proteja contra exagero.",
      frictionBudget: "normal",
      primaryAction: "Escolher uma prioridade de impacto e limitar o resto.",
      anchors: [
        "Usar a melhor energia cedo",
        "Nao transformar foco em sobrecarga",
        "Fechar uma coisa antes de abrir outra",
      ],
    };
  }

  return {
    mode: "steady",
    title: "Modo estavel",
    summary: "Hoje o melhor caminho e constancia: fazer o basico bem feito sem aumentar friccao.",
    frictionBudget: "light",
    primaryAction: "Seguir um plano simples com poucas trocas de contexto.",
    anchors: [
      "Priorizar regularidade",
      "Distribuir energia ao longo do dia",
      "Fechar o essencial antes do opcional",
    ],
  };
}

function countRecentStreak(checkinDates: string[]) {
  const unique = Array.from(new Set(checkinDates)).sort().reverse();
  if (unique.length === 0) return 0;

  let streak = 0;
  let cursor = new Date(unique[0]);
  cursor.setHours(0, 0, 0, 0);

  for (const isoDate of unique) {
    const current = new Date(isoDate);
    current.setHours(0, 0, 0, 0);
    if (current.getTime() !== cursor.getTime()) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function buildGentleGamificationSnapshot(input: GamificationInput): GentleGamificationSnapshot {
  const streakDays = countRecentStreak(input.checkinDates);
  const completionRatio = input.tasksTotalToday > 0 ? input.tasksDoneToday / input.tasksTotalToday : 0;
  const consistencyBase = Math.round(((input.hadCheckinToday ? 0.5 : 0) + completionRatio * 0.5) * 100);
  const recoveryBonus =
    input.supportMode === "recovery" || input.supportMode === "protection"
      ? input.tasksDoneToday > 0 || input.hadCheckinToday
        ? 2
        : 0
      : input.tasksDoneToday >= 2
        ? 2
        : input.tasksDoneToday === 1
          ? 1
          : 0;

  const badges: GentleGamificationSnapshot["badges"] = [];

  if (input.hadCheckinToday) {
    badges.push({ id: "checkin", label: "Presenca registrada", tone: "soft" });
  }
  if (streakDays >= 3) {
    badges.push({ id: "ritmo", label: `${streakDays} dias de ritmo`, tone: "focus" });
  }
  if (recoveryBonus >= 2) {
    badges.push({ id: "retomada", label: "Retomada gentil", tone: "care" });
  }

  const missionByMode: Record<AdaptiveSupportMode, { title: string; reason: string }> = {
    protection: {
      title: "Missao do dia: reduzir excesso",
      reason: "Hoje vencer e proteger sua energia antes que o dia te puxe para mais carga.",
    },
    recovery: {
      title: "Missao do dia: micro-retomada",
      reason: "O objetivo e so voltar a se mover com um passo pequeno e concreto.",
    },
    regulation: {
      title: "Missao do dia: baixar o ritmo",
      reason: "Menos aceleracao e mais previsibilidade deixam o dia mais seguro.",
    },
    steady: {
      title: "Missao do dia: manter constancia",
      reason: "Regularidade hoje vale mais do que intensidade.",
    },
    momentum: {
      title: "Missao do dia: avancar sem exagerar",
      reason: "Existe boa energia, mas ela precisa de limite para continuar util.",
    },
  };

  const celebrationLevel =
    recoveryBonus >= 2 || streakDays >= 5 ? "spark" : recoveryBonus >= 1 || streakDays >= 2 ? "warm" : "quiet";

  return {
    streakDays,
    consistencyScore: consistencyBase,
    recoveryPoints: recoveryBonus,
    celebrationLevel,
    missionTitle: missionByMode[input.supportMode].title,
    missionReason: missionByMode[input.supportMode].reason,
    badges,
  };
}
