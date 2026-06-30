import axios from 'axios';
import { supabase } from '../lib/supabase';

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://airia.pro';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
