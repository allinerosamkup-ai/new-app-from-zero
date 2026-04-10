import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

  (req as AuthRequest).userId = data.user.id;
  next();
}
