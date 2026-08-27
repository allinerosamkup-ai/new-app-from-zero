import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma as sharedPrisma } from '../lib/prisma';
import { recordInitialConsents } from '../services/consent.service';

// Lazy singleton — criado na primeira requisição, quando dotenv já carregou os env vars
let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!_client) {
    // Publishable/anon para verificar o JWT do usuário (getUser).
    // SECRET / SERVICE_ROLE bypassa RLS e não deve ser usado aqui.
    const publishable =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY;
    _client = createClient(
      process.env.SUPABASE_URL!,
      publishable!,
    );
  }
  return _client;
}
