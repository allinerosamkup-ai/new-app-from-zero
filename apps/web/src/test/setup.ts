// Minimal Vitest setup for route/component tests.

/**
 * Credenciais falsas de Supabase para o ambiente de teste.
 *
 * `src/lib/supabase.ts` lança no import quando as VITE_* faltam — proteção
 * correta em produção, mas sem isso a suíte só roda em máquina que já tem
 * `.env` local (o arquivo é gitignored). Clone novo e CI quebravam ao importar
 * qualquer rota. Valores fictícios: nenhum teste faz chamada real.
 */
const TEST_ENV: Record<string, string> = {
  VITE_SUPABASE_URL: 'http://localhost:54321',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (!import.meta.env[key]) {
    (import.meta.env as Record<string, unknown>)[key] = value;
  }
}
