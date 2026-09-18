import { createClient } from '@supabase/supabase-js';

const isWeb = typeof window !== 'undefined';
const supabaseUrl = isWeb
  ? (import.meta.env.VITE_SUPABASE_URL as string)
  : (process.env.EXPO_PUBLIC_SUPABASE_URL as string);

const supabasePublishableKey = isWeb
  ? ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string)
  : ((process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) as string);

let storage: any;
if (!isWeb) {
  try {
    storage = require('@react-native-async-storage/async-storage').default;
  } catch {
    storage = undefined;
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
