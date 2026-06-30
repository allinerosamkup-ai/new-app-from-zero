// Onboarding em camadas (Onda 4 / UI): a barra inferior destrava por uso.
// Semana 1 mostra só o essencial (Hoje, Airia, Diário); Planner e Padrões
// entram conforme a pessoa registra check-ins. Usuária estabelecida vê tudo.

export type NavKey = "home" | "planner" | "aura" | "insights" | "journal";

const ALWAYS_UNLOCKED: readonly NavKey[] = ["home", "aura", "journal"];
const ALL_NAV: readonly NavKey[] = ["home", "planner", "aura", "insights", "journal"];

// Planner precisa de pelo menos 1 check-in pra calibrar; Padrões (Insights) só
// fazem sentido com base mínima — alinhado ao corte do engine (3 check-ins).
const PLANNER_MIN_CHECKINS = 1;
const INSIGHTS_MIN_CHECKINS = 3;

export function resolveUnlockedNav(opts: { checkinCount: number; isNewUser: boolean }): Set<NavKey> {
  if (!opts.isNewUser) {
    return new Set<NavKey>(ALL_NAV);
  }
  const unlocked = new Set<NavKey>(ALWAYS_UNLOCKED);
  if (opts.checkinCount >= PLANNER_MIN_CHECKINS) unlocked.add("planner");
  if (opts.checkinCount >= INSIGHTS_MIN_CHECKINS) unlocked.add("insights");
  return unlocked;
}
