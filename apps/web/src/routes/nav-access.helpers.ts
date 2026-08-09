// Onboarding em camadas (Onda 4 / UI): a barra inferior destrava por uso.
// Hoje só o Planner ainda depende de uso; o resto do produto está sempre lá.

// "planner" continua na união e nas regras mesmo estando desligado no produto:
// a ocultação acontece na camada de cima (config/features.ts), então religar é
// uma linha e não mexe aqui.
export type NavKey = "home" | "goals" | "planner" | "aura" | "insights" | "journal";

// Objetivos sempre liberado: é o núcleo do app agora, não faz sentido esperar
// check-in para a pessoa poder criar uma meta.
//
// **Padrões entrou nesta lista em 2026-08-09.** Ficava escondido até o 3º
// check-in, e a intenção era boa — leitura de padrão sem base é leitura falsa.
// O efeito na tela era outro: uma aba do produto simplesmente não existia, sem
// nada explicando por quê, e some sem aviso é indistinguível de defeito. Foi
// exatamente assim que a dona do produto leu ("você tirou o botão Padrões").
//
// O detalhe que fecha o caso: `insights-page.tsx` **já tem** o estado vazio
// certo — "você tem N check-ins; com 3 a Airia começa a mostrar leitura mais
// útil", com a prévia do que aparece em 3, 7 e 30 dias. Esse texto foi escrito
// para quem tem menos de 3 check-ins e era inalcançável justamente para essa
// pessoa. A aba presente ensina o que falta; a aba ausente não ensina nada.
const ALWAYS_UNLOCKED: readonly NavKey[] = ["home", "goals", "aura", "journal", "insights"];
const ALL_NAV: readonly NavKey[] = ["home", "goals", "planner", "aura", "insights", "journal"];

// Planner precisa de pelo menos 1 check-in pra calibrar. Continua sendo o único
// item por uso, e hoje está desligado no produto de qualquer forma.
const PLANNER_MIN_CHECKINS = 1;

export function resolveUnlockedNav(opts: { checkinCount: number; isNewUser: boolean }): Set<NavKey> {
  if (!opts.isNewUser) {
    return new Set<NavKey>(ALL_NAV);
  }
  const unlocked = new Set<NavKey>(ALWAYS_UNLOCKED);
  if (opts.checkinCount >= PLANNER_MIN_CHECKINS) unlocked.add("planner");
  return unlocked;
}
