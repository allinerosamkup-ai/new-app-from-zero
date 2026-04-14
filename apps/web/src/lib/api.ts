import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse(response: Response) {
  if (response.ok) return response.status === 204 ? null : response.json();

  if (response.status === 401) {
    // Não deslogamos mais automaticamente para evitar "kick outs" agressivos.
    // O getSession() no getAuthHeaders tentará renovar o token na próxima chamada.
    throw new Error('Sessão expirada ou inválida. Se o erro persistir, tente sair e entrar novamente.');
  }

  let message = `Erro ${response.status}`;
  try {
    const body = await response.json();
    if (body?.error) message = body.error;
    else if (body?.message) message = body.message;
  } catch {
    message = `Erro ${response.status}: ${response.statusText}`;
  }
  throw new Error(message);
}

export const api = {
  async get(endpoint: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, { headers });
    return handleResponse(response);
  },

  async post(endpoint: string, body: unknown) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async patch(endpoint: string, body: unknown) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async put(endpoint: string, body: unknown) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async delete(endpoint: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(response);
  },
};
