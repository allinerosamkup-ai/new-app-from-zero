import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Inicialização segura para evitar que o app quebre se as variáveis estiverem ausentes no build/runtime
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : new Proxy({} as any, {
      get: () => {
        // Se alguém tentar acessar o supabase sem as env vars, avisamos no console em vez de dar crash fatal
        console.warn('Supabase: Tentativa de acesso sem VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY configurados.');
        return () => ({
          auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
          from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
        });
      }
    });
