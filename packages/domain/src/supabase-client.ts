import { createClient } from '@supabase/supabase-js';

// Detect environment and keys
const isWeb = typeof window !== 'undefined';
const supabaseUrl = isWeb 
  ? (import.meta.env.VITE_SUPABASE_URL as string)
  : (process.env.EXPO_PUBLIC_SUPABASE_URL as string);

const supabaseAnonKey = isWeb
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
  : (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string);

// Universal storage handler
let storage: any;
if (!isWeb) {
  try {
    storage = require('@react-native-async-storage/async-storage').default;
  } catch {
    storage = undefined;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
