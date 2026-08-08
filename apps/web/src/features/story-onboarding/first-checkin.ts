import type { StoryAnswers } from "./reading";

/**
 * O primeiro check-in, montado com o que ela respondeu no onboarding.
 *
 * Antes daqui o fluxo gravava `humor: 5` fixo. Isso é dado inventado entrando no
 * MoodCycleEngine, que mede desvio do baseline pessoal: o primeiro ponto da
 * série é justamente o que ancora esse baseline, e ancorá-lo num número de
 * enfeite desloca toda leitura seguinte. Um app que promete não inventar não
 * pode começar inventando.
 *
 * Nada aqui é chute: cada campo sai de uma resposta dela. O que ela não
 * respondeu simplesmente não vai no payload.
 */

/** Como ela disse que chegou → humor na escala de 1 a 10. */
const HUMOR_POR_ESTADO: Record<string, number> = {
  "Em paz": 8,
  Animada: 8,
  Cansada: 4,
  Acelerada: 5,
  Travada: 4,
  Sensível: 4,
  Confusa: 4,
  Sobrecarregada: 3,
};

/** O mesmo estado, no vocabulário de emoções que o check-in já usa. */
const EMOCAO_POR_ESTADO: Record<string, string> = {
  "Em paz": "calm",
  Animada: "happy",
  Cansada: "tired",
  Acelerada: "agitated",
  Travada: "stressed",
  Sensível: "sensitive",
  Confusa: "anxious",
  Sobrecarregada: "exhausted",
};

/** O que ela disse que cabe hoje → energia. É a mesma pergunta do check-in diário. */
const ENERGIA_POR_CAPACIDADE: Record<string, number> = {
  quick: 3,
  moderate: 5,
  heavy: 8,
};

/** Drenos e recuperadores que têm equivalente no vocabulário do check-in. */
const FATOR_POR_ESCOLHA: Record<string, string> = {
  "Dormir mal": "slept_little",
  "Decisão demais": "overwhelmed",
  Cobrança: "work_pressure",
  Conflito: "relationship_conflict",
  "Trabalho acumulado": "work_pressure",
  "Ficar parada": "no_exercise",
  "Ar livre": "fresh_air",
  Movimento: "exercise",
  "Boa conversa": "good_talk",
  "Terminar algo": "finished_task",
  Dormir: "rest",
  Silêncio: "rest",
};

export type FirstCheckinPayload = {
  humor: number;
  energia: number;
  emotion?: string;
  emotions?: string[];
  factors?: string[];
  note?: string;
};

export function buildFirstCheckin(
  answers: StoryAnswers,
  capacity: string | null,
): FirstCheckinPayload {
  const humor = (answers.feeling ? HUMOR_POR_ESTADO[answers.feeling] : undefined) ?? 5;
  const energia = (capacity ? ENERGIA_POR_CAPACIDADE[capacity] : undefined) ?? humor;
  const emocao = answers.feeling ? EMOCAO_POR_ESTADO[answers.feeling] : undefined;

  const factors = Array.from(new Set(
    [...answers.drains, ...answers.restorers]
      .map((escolha) => FATOR_POR_ESCOLHA[escolha])
      .filter((id): id is string => Boolean(id)),
  ));

  return {
    humor,
    energia,
    ...(emocao ? { emotion: emocao, emotions: [emocao] } : {}),
    ...(factors.length > 0 ? { factors } : {}),
    ...(answers.feeling ? { note: `Primeiro registro, no onboarding: ${answers.feeling.toLowerCase()}.` } : {}),
  };
}
