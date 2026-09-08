export type ConcreteActionInput = {
  title: unknown;
  doneWhen?: unknown;
  starter?: unknown;
};

export type ConcreteActionVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing_title'
        | 'missing_executable_verb'
        | 'abstract_or_circular_action'
        | 'missing_specific_object'
        | 'missing_done_when'
        | 'robot_fallback_phrase';
    };

/** Frases-robô que a Airia gravou como caminho quando a IA falhou. Não são ação. */
export const ROBOT_FALLBACK_PHRASE =
  /escreva o resultado que fara|escreva o resultado que fará|analise o que impede|defina o menor (proximo |próximo )?passo|analyze what (is )?blocking|write the (result|outcome) that will/i;

export function isRobotFallbackPhrase(value: unknown): boolean {
  const title = typeof value === 'string' ? value : '';
  return ROBOT_FALLBACK_PHRASE.test(title) || ROBOT_FALLBACK_PHRASE.test(normalizeActionText(title));
}
