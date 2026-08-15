const API_DOWN = 'Cannot reach the API on port 4000. Start it with: cd backend && npm run dev';

/** Thin fetch wrapper around the JSON API. */
export async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include', // carries the dashboard session cookie
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch {
    // Network-level failure — no server, DNS, or CORS.
    throw new Error(API_DOWN);
  }

  // An expired or missing dashboard session anywhere sends the UI back to the
  // login gate instead of leaving half-rendered panels behind.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('csl:unauthorized'));
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    // A non-JSON error body means the response came from the Vite proxy, not
    // our API — which almost always means the API process isn't running.
    if (!isJson) throw new Error(API_DOWN);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const apiGet = (path) => apiFetch(path);
export const apiPost = (path, data) =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(data) });
export const apiPatch = (path, data) =>
  apiFetch(path, { method: 'PATCH', body: JSON.stringify(data) });
