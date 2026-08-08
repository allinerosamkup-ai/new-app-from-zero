import type { OperationalProfile } from './goal-intelligence.service';

/**
 * Perfil operacional: como esta pessoa funciona, não quem ela é.
 *
 * Sai do onboarding e entra em toda geração de ação. Não é diagnóstico e não
 * vira rótulo visível em lugar nenhum — é só o que muda o FORMATO da resposta:
 * tamanho do passo, quantas opções mostrar, quanto contexto explicar.
 *
 * Por que mora em `aiProfilePayload` e não em colunas próprias: é um JSON de
 * personalização que vai mudar de forma conforme o onboarding evolui, e cada
 * mudança de forma custaria uma migração em produção. O mesmo campo já guarda o
 * feedback de ações pelo mesmo motivo. As chaves são namespaced, então os dois
 * convivem sem se pisar.
 *
 * A distinção que importa aqui: perfil explica COMO entregar. O que entregar
 * continua vindo de fato — objetivo, check-in, fala dela. Perfil nunca inventa
 * conteúdo.
 */

const PAYLOAD_KEY = 'operationalProfile';

/** Respostas cruas do onboarding, do jeito que a tela coleta. */
export type OperationalProfileAnswers = {
  /** O que costuma travar primeiro. Múltipla escolha. */
  blockers?: string[];
  /** Quantas frentes abertas ela declarou. */
  openFronts?: number | null;
  /** Como ela prefere receber uma lista grande. */
  listPreference?: 'one_at_a_time' | 'whole_picture' | null;
  /** Tamanho de passo que ela escolheu. */
  stepSize?: 'small' | 'medium' | 'large' | null;
};

const BLOCKER_IDS = ['start', 'prioritize', 'finish', 'consistency', 'remember'] as const;
export type BlockerId = (typeof BLOCKER_IDS)[number];

function level(hit: boolean, strong: boolean): 'baixa' | 'moderada' | 'alta' {
  if (strong) return 'alta';
  return hit ? 'moderada' : 'baixa';
}

/**
 * Traduz respostas em parâmetros de geração.
 *
 * Determinístico de propósito: isto é um mapa de configuração, não uma leitura
 * que precise de modelo. Mandar para o LLM só adicionaria latência e variação
 * onde a regra é fixa.
 */
export function deriveOperationalProfile(answers: OperationalProfileAnswers): OperationalProfile {
  const blockers = new Set((answers.blockers ?? []).filter((id): id is BlockerId => (
    (BLOCKER_IDS as readonly string[]).includes(id)
  )));
  const fronts = typeof answers.openFronts === 'number' ? answers.openFronts : null;

  const travaParaComecar = blockers.has('start');
  const travaParaPriorizar = blockers.has('prioritize');
  const travaParaTerminar = blockers.has('finish');

  // Muita frente aberta + trava para priorizar é a combinação que mais sofre com
  // lista longa: cada item vira mais uma decisão antes de qualquer movimento.
  const sobrecarregada = travaParaPriorizar && (fronts ?? 0) >= 5;

  const preferredActionSize = answers.stepSize === 'large'
    ? 'medio'
    : answers.stepSize === 'medium'
      ? 'pequeno_medio'
      : travaParaComecar ? 'pequeno' : 'pequeno_medio';

  return {
    preferredActionSize,
    toleranceForAmbiguity: travaParaComecar || travaParaPriorizar ? 'baixa' : 'media',
    idealOptionCount: sobrecarregada || answers.listPreference === 'one_at_a_time' ? 1 : 3,
    difficultyStarting: level(travaParaComecar, travaParaComecar && (fronts ?? 0) >= 5),
    difficultyPrioritizing: level(travaParaPriorizar, sobrecarregada),
    difficultyFinishing: level(travaParaTerminar, false),
    explainContext: answers.listPreference === 'whole_picture' ? 'medio' : 'pouco',
  };
}

function isProfile(value: unknown): value is OperationalProfile {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export class OperationalProfileService {
  /**
   * Lê o perfil. Devolve `null` quando não existe — e null significa "gerar sem
   * personalização", nunca "usar um perfil médio inventado".
   */
  static async get(prisma: any, userId: string): Promise<OperationalProfile | null> {
    const row = await prisma.onboardingResponse?.findUnique?.({
      where: { userId },
      select: { aiProfilePayload: true },
    }).catch(() => null);

    const payload = (row?.aiProfilePayload ?? {}) as Record<string, unknown>;
    const stored = payload[PAYLOAD_KEY];
    return isProfile(stored) ? stored : null;
  }

  /** Grava preservando o resto do payload — o feedback de ações vive no mesmo campo. */
  static async save(
    prisma: any,
    userId: string,
    answers: OperationalProfileAnswers,
  ): Promise<OperationalProfile> {
    const profile = deriveOperationalProfile(answers);

    const existing = await prisma.onboardingResponse?.findUnique?.({
      where: { userId },
      select: { aiProfilePayload: true },
    }).catch(() => null);

    const payload = { ...((existing?.aiProfilePayload ?? {}) as Record<string, unknown>) };
    payload[PAYLOAD_KEY] = profile;
    // Guardado junto para poder reprocessar o perfil quando a regra mudar, sem
    // ter que perguntar tudo de novo.
    payload[`${PAYLOAD_KEY}Answers`] = answers;

    await prisma.onboardingResponse?.upsert?.({
      where: { userId },
      update: { aiProfilePayload: payload },
      create: { userId, aiProfilePayload: payload },
    }).catch(() => null);

    return profile;
  }
}
