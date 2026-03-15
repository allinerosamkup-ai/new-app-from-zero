import axios from 'axios';

/**
 * Serviço base de comunicação com o backend.
 * Centraliza a configuração de URL e headers.
 */
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
