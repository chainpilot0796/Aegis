import { useMemo } from 'react';
import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001';

export function useApi() {
  const api = useMemo(() => {
    const instance = axios.create({ baseURL: BASE_URL });

    return {
      get: (url, config) => instance.get(url, config).then((r) => r.data),
      post: (url, data, config) => instance.post(url, data, config).then((r) => r.data),
    };
  }, []);

  return api;
}
