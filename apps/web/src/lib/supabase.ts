import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  // Falha alta e clara em vez de Proxy fallback buggy.
  // Se isso aparecer em produção, build do Docker não recebeu as VITE_* args
  // (verifique compose.yml + --env-file .env.web.build no deploy.sh).
  const msg =
    'Supabase config ausente — VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) precisam estar definidos no build. App não inicia.';
  console.error(msg);
  throw new Error(msg);
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
