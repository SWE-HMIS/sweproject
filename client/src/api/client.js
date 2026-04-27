const TOKEN_KEY = 'hmis_token';

// In dev, VITE_API_URL is unset and we use a relative path so the Vite
// proxy (vite.config.js -> /api -> http://127.0.0.1:4000) handles forwarding.
// In production (Vercel), set VITE_API_URL to the Railway API origin, e.g.
//   VITE_API_URL=https://hmis-api.up.railway.app
// and the built bundle will hit it directly.
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const url = API_BASE && path.startsWith('/') ? `${API_BASE}${path}` : path;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('hmis:auth'));
  }
  const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    const msg = body?.error || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}
