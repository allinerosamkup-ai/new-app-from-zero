import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha alta e clara em vez de Proxy fallback buggy.
  // Se isso aparecer em produção, build do Docker não recebeu as VITE_* args
  // (verifique compose.yml + --env-file .env.web.build no deploy.sh).
  const msg =
    'Supabase config ausente — VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidos no build. App não inicia.';
  console.error(msg);
  // Lança quando alguém realmente usa, com mensagem clara, em vez de "is not a function"
  throw new Error(msg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
