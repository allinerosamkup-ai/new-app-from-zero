import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let AsyncStorage: any;

try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorage = undefined;
}

function missingEnvError(): Error {
  return new Error('Supabase mobile env vars are missing: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

const client =
  supabaseUrl && supabaseAnonKey
      ? createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const supabase: any =
  client ??
  ({
    auth: {
      getSession: async () => {
        throw missingEnvError();
      },
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
      signOut: async () => {
        throw missingEnvError();
      },
    },
    functions: {
      invoke: async () => {
        throw missingEnvError();
      },
    },
    channel: () => ({
      on: () => ({
        subscribe: () => ({
          unsubscribe() {},
        }),
      }),
    }),
    from: () => ({
      select: () => ({
        gte: () => ({
          order: () => ({
            order: async () => {
              throw missingEnvError();
            },
          }),
        }),
      }),
    }),
  } as const);
