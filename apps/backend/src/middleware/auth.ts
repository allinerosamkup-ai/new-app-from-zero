import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma as sharedPrisma } from '../lib/prisma';
import { recordInitialConsents } from '../services/consent.service';

// Lazy singleton — criado na primeira requisição, quando dotenv já carregou os env vars
let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!_client) {
    // Always use ANON_KEY for user token verification (getUser).
    // SERVICE_ROLE_KEY bypasses RLS and should NOT be used here.
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}

type ProfileRepository = {
  upsert(args: {
    where: { id: string };
    update: Record<string, never>;
    create: { id: string; fullName: string | null };
  }): Promise<unknown>;
};

type AuthProfileUser = {
  id: string;
  user_metadata?: Record<string, unknown>;
};

export function createProfileBootstrapper(
  profileRepository: ProfileRepository,
  // Opcional para não quebrar chamadores existentes (inclusive o teste de
  // bootstrap, que injeta só o repositório de perfil).
  recordConsents?: (userId: string) => Promise<void>,
) {
  const ensured = new Map<string, Promise<void>>();

  return (user: AuthProfileUser): Promise<void> => {
    const existing = ensured.get(user.id);
    if (existing) return existing;

    const rawName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const fullName = typeof rawName === 'string' && rawName.trim()
      ? rawName.trim().slice(0, 80)
      : null;

    const pending = profileRepository.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, fullName },
    }).then(async () => {
      // Consentimento é gravado depois do perfil existir (a FK exige isso) e
      // nunca pode derrubar a autenticação: sem o catch, uma falha ao registrar
      // consentimento tiraria a pessoa do app inteiro.
      if (recordConsents) {
        await recordConsents(user.id).catch((error) => {
          console.error('[auth/consent-bootstrap] Error:', error);
        });
      }
      return undefined;
    }).catch((error) => {
      ensured.delete(user.id);
      throw error;
    });

    ensured.set(user.id, pending);
    return pending;
  };
}

let _bootstrapProfile: ReturnType<typeof createProfileBootstrapper> | null = null;

function getProfileBootstrapper() {
  if (!_bootstrapProfile) {
    // Usa o pool do processo. Um cliente próprio aqui era o pior dos nove: este
    // caminho roda em **toda requisição autenticada**, então mantinha um pool
    // inteiro ocupado em paralelo com o que servia as rotas.
    const prisma = sharedPrisma;
    _bootstrapProfile = createProfileBootstrapper(
      prisma.profile,
      (userId) => recordInitialConsents(prisma.consent, userId, new Date()),
    );
  }
  return _bootstrapProfile;
}

export interface AuthRequest extends Request {
  userId: string;
}

/**
 * Verifica o Bearer token do Supabase e injeta req.userId.
 * Rejeita com 401 se o token for inválido ou ausente.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Ignora auth para o callback do Google, que é uma navegação do browser sem headers customizados
  if (req.path === '/gcal/callback' || req.originalUrl.includes('/api/gcal/callback')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await getClient().auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }

  try {
    await getProfileBootstrapper()(data.user);
  } catch (profileError) {
    console.error('[auth/profile-bootstrap] Error:', profileError);
    res.status(500).json({ error: 'Não foi possível preparar seu perfil agora.' });
    return;
  }

  (req as AuthRequest).userId = data.user.id;
  next();
}
